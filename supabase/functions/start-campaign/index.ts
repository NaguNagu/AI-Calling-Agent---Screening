const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
const normalizeIndianNumber = (value: string) => {
  const digits = String(value || '').replace(/[^0-9]/g, '')
  const normalized = digits.length === 10 ? `+91${digits}` : digits.length === 11 && digits.startsWith('0') ? `+91${digits.slice(1)}` : digits.length === 12 && digits.startsWith('91') ? `+${digits}` : String(value || '').trim()
  return /^\+91[6-9]\d{9}$/.test(normalized) ? normalized : null
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'POST required' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')
  const accessToken = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!supabaseUrl || !supabaseKey || !accessToken) return json({ error: 'Not authenticated' }, 401)
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: supabaseKey, Authorization: `Bearer ${accessToken}` } })
  if (!userResponse.ok) return json({ error: 'Not authenticated' }, 401)

  const { campaign_id: campaignId } = await request.json()
  if (!campaignId) return json({ error: 'campaign_id is required' }, 400)
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authId = Deno.env.get('PLIVO_AUTH_ID')
  const authToken = Deno.env.get('PLIVO_AUTH_TOKEN')
  const fromNumber = Deno.env.get('PLIVO_FROM_NUMBER')
  if (!serviceRoleKey || !authId || !authToken || !fromNumber) return json({ error: 'Calling secrets are not configured' }, 500)

  const dbHeaders = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' }
  const campaignResponse = await fetch(`${supabaseUrl}/rest/v1/campaigns?id=eq.${encodeURIComponent(campaignId)}&select=id,status`, { headers: dbHeaders })
  const campaigns = await campaignResponse.json()
  if (!campaignResponse.ok || !campaigns?.[0]) return json({ error: 'Campaign not found' }, 404)
  if (campaigns[0].status === 'in_progress') return json({ error: 'This campaign is already in progress' }, 409)

  const candidateResponse = await fetch(`${supabaseUrl}/rest/v1/candidates?campaign_id=eq.${encodeURIComponent(campaignId)}&status=in.(not_contacted,failed,no_answer,screening_incomplete)&select=id,mobile_number`, { headers: dbHeaders })
  const candidates = await candidateResponse.json()
  if (!candidateResponse.ok) return json({ error: 'Could not load campaign candidates' }, 500)
  if (!candidates.length) return json({ ok: false, skipped: true, message: 'No new contacts were ready to call. Completed contacts were skipped.' })

  await fetch(`${supabaseUrl}/rest/v1/campaigns?id=eq.${encodeURIComponent(campaignId)}`, { method: 'PATCH', headers: dbHeaders, body: JSON.stringify({ status: 'in_progress' }) })
  let started = 0
  let failed = 0
  for (const candidate of candidates) {
    const toNumber = normalizeIndianNumber(candidate.mobile_number)
    if (!toNumber) {
      failed += 1
      await fetch(`${supabaseUrl}/rest/v1/candidates?id=eq.${encodeURIComponent(candidate.id)}`, { method: 'PATCH', headers: dbHeaders, body: JSON.stringify({ status: 'failed' }) })
      continue
    }
    const callInsert = await fetch(`${supabaseUrl}/rest/v1/calls`, { method: 'POST', headers: { ...dbHeaders, Prefer: 'return=representation' }, body: JSON.stringify({ candidate_id: candidate.id, provider: 'plivo', status: 'queued' }) })
    const callRows = await callInsert.json()
    const callId = callRows?.[0]?.id
    if (!callId) { failed += 1; continue }
    const answerUrl = `${supabaseUrl}/functions/v1/plivo-answer?call_id=${encodeURIComponent(callId)}&candidate_id=${encodeURIComponent(candidate.id)}`
    const hangupUrl = `${supabaseUrl}/functions/v1/plivo-hangup?call_id=${encodeURIComponent(callId)}`
    const form = new URLSearchParams({ from: fromNumber, to: toNumber, answer_url: answerUrl, answer_method: 'POST', hangup_url: hangupUrl, hangup_method: 'POST' })
    const plivoResponse = await fetch(`https://api.plivo.com/v1/Account/${authId}/Call/`, { method: 'POST', headers: { Authorization: `Basic ${btoa(`${authId}:${authToken}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form })
    const result = await plivoResponse.json()
    if (!plivoResponse.ok) {
      failed += 1
      await fetch(`${supabaseUrl}/rest/v1/calls?id=eq.${encodeURIComponent(callId)}`, { method: 'PATCH', headers: dbHeaders, body: JSON.stringify({ status: 'failed', failure_reason: result?.error || 'Plivo could not start the call' }) })
      await fetch(`${supabaseUrl}/rest/v1/candidates?id=eq.${encodeURIComponent(candidate.id)}`, { method: 'PATCH', headers: dbHeaders, body: JSON.stringify({ status: 'failed' }) })
    } else {
      started += 1
      await fetch(`${supabaseUrl}/rest/v1/calls?id=eq.${encodeURIComponent(callId)}`, { method: 'PATCH', headers: dbHeaders, body: JSON.stringify({ provider_call_id: result.request_uuid }) })
      await fetch(`${supabaseUrl}/rest/v1/candidates?id=eq.${encodeURIComponent(candidate.id)}`, { method: 'PATCH', headers: dbHeaders, body: JSON.stringify({ status: 'calling' }) })
    }
  }
  if (!started) await fetch(`${supabaseUrl}/rest/v1/campaigns?id=eq.${encodeURIComponent(campaignId)}`, { method: 'PATCH', headers: dbHeaders, body: JSON.stringify({ status: 'error' }) })
  return json({ ok: started > 0, started, failed, message: `${started} call(s) started${failed ? `, ${failed} failed` : ''}. Completed contacts were skipped.` })
})
