const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'POST required' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const callId = new URL(request.url).searchParams.get('call_id')
  if (!supabaseUrl || !serviceRoleKey || !callId) return json({ error: 'Callback is not configured' }, 400)

  const body = await request.formData()
  const get = (name: string) => String(body.get(name) || '')
  const status = get('CallStatus').toLowerCase()
  const duration = Number(get('Duration') || get('BillDuration') || 0)
  const statusMap: Record<string, string> = { 'in-progress': 'in_progress', completed: 'completed', 'no-answer': 'no_answer', busy: 'busy', failed: 'failed' }
  const callStatus = statusMap[status] || 'failed'
  const headers = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' }

  const callResponse = await fetch(`${supabaseUrl}/rest/v1/calls?id=eq.${encodeURIComponent(callId)}&select=id,candidate_id,transcript`, { headers })
  const callRows = await callResponse.json()
  if (!callResponse.ok || !callRows?.[0]) return json({ error: 'Call record not found' }, 404)
  const call = callRows[0]

  await fetch(`${supabaseUrl}/rest/v1/calls?id=eq.${encodeURIComponent(callId)}`, { method: 'PATCH', headers, body: JSON.stringify({ status: callStatus, duration_seconds: duration, ended_at: new Date().toISOString(), failure_reason: get('HangupCauseName') || null }) })

  const candidateResponse = await fetch(`${supabaseUrl}/rest/v1/candidates?id=eq.${encodeURIComponent(call.candidate_id)}&select=campaign_id,preferred_language`, { headers })
  const candidateRows = await candidateResponse.json()
  const candidate = candidateRows?.[0]
  // A call that connected but ended before the voice agent saved answers is "incomplete", not "screened".
  // The bridge writes the transcript only after every question has been answered.
  const screeningFinished = Boolean(call.transcript)
  const candidateStatus = callStatus === 'completed' ? (screeningFinished ? 'completed' : 'screening_incomplete') : callStatus === 'busy' ? 'no_answer' : callStatus
  if (candidate) await fetch(`${supabaseUrl}/rest/v1/candidates?id=eq.${encodeURIComponent(call.candidate_id)}`, { method: 'PATCH', headers, body: JSON.stringify({ status: candidateStatus }) })
  await fetch(`${supabaseUrl}/rest/v1/usage_events?on_conflict=call_id`, { method: 'POST', headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ call_id: callId, campaign_id: candidate?.campaign_id || null, provider: 'plivo', minutes: Math.ceil(duration / 60 * 100) / 100, estimated_cost: null }) })

  if (candidate?.campaign_id) {
    const campaignCandidatesResponse = await fetch(`${supabaseUrl}/rest/v1/candidates?campaign_id=eq.${encodeURIComponent(candidate.campaign_id)}&select=status`, { headers })
    const campaignCandidates = await campaignCandidatesResponse.json()
    const terminalStatuses = ['completed', 'no_answer', 'failed', 'screening_incomplete', 'shortlisted', 'rejected', 'contact_later']
    const allFinished = campaignCandidates.length > 0 && campaignCandidates.every((item: { status: string }) => terminalStatuses.includes(item.status))
    if (allFinished) {
      const anyCompleted = campaignCandidates.some((item: { status: string }) => ['completed', 'shortlisted'].includes(item.status))
      await fetch(`${supabaseUrl}/rest/v1/campaigns?id=eq.${encodeURIComponent(candidate.campaign_id)}`, { method: 'PATCH', headers, body: JSON.stringify({ status: anyCompleted ? 'completed' : 'error' }) })
    }
  }
  return json({ ok: true })
})
