const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'POST required' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')
  const authHeader = request.headers.get('Authorization')
  const accessToken = authHeader?.replace(/^Bearer\s+/i, '')
  if (!supabaseUrl || !supabaseKey || !accessToken) return json({ error: 'Not authenticated' }, 401)

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: supabaseKey, Authorization: `Bearer ${accessToken}` } })
  if (!userResponse.ok) return json({ error: 'Not authenticated' }, 401)

  const { to_number: toNumber, candidate_id: candidateId } = await request.json()
  if (!toNumber) return json({ error: 'to_number is required' }, 400)
  const digits = String(toNumber).replace(/[^0-9]/g, '')
  const normalizedNumber = digits.length === 10 ? `+91${digits}` : String(toNumber).trim()
  if (!/^\+91[6-9]\d{9}$/.test(normalizedNumber)) return json({ error: 'Please use a valid Indian mobile number' }, 400)

  const authId = Deno.env.get('PLIVO_AUTH_ID')
  const authToken = Deno.env.get('PLIVO_AUTH_TOKEN')
  const fromNumber = Deno.env.get('PLIVO_FROM_NUMBER')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!authId || !authToken || !fromNumber || !serviceRoleKey) return json({ error: 'Calling secrets are not configured' }, 500)

  const dbHeaders = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' }
  const callInsert = await fetch(`${supabaseUrl}/rest/v1/calls`, { method: 'POST', headers: { ...dbHeaders, Prefer: 'return=representation' }, body: JSON.stringify({ candidate_id: candidateId || null, provider: 'plivo', status: 'queued' }) })
  const callRows = await callInsert.json()
  if (!callInsert.ok || !callRows?.[0]?.id) return json({ error: 'Could not create the call tracking record' }, 500)
  const callId = callRows[0].id

  const answerUrl = `${supabaseUrl}/functions/v1/plivo-answer${candidateId ? `?candidate_id=${encodeURIComponent(candidateId)}` : ''}`
  const hangupUrl = `${supabaseUrl}/functions/v1/plivo-hangup?call_id=${encodeURIComponent(callId)}`
  const form = new URLSearchParams({ from: fromNumber, to: normalizedNumber, answer_url: answerUrl, answer_method: 'POST', hangup_url: hangupUrl, hangup_method: 'POST' })
  const plivoResponse = await fetch(`https://api.plivo.com/v1/Account/${authId}/Call/`, {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`${authId}:${authToken}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  })
  const result = await plivoResponse.json()
  if (!plivoResponse.ok) {
    await fetch(`${supabaseUrl}/rest/v1/calls?id=eq.${callId}`, { method: 'PATCH', headers: dbHeaders, body: JSON.stringify({ status: 'failed', failure_reason: result?.error || 'Plivo could not start the call' }) })
    return json({ error: result?.error || 'Plivo could not start the call' }, plivoResponse.status)
  }
  await fetch(`${supabaseUrl}/rest/v1/calls?id=eq.${callId}`, { method: 'PATCH', headers: dbHeaders, body: JSON.stringify({ provider_call_id: result.request_uuid, status: 'queued' }) })
  return json({ ok: true, request_uuid: result.request_uuid, message: 'Test call started' })
})
