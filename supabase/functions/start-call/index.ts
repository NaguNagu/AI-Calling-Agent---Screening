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

  const authId = Deno.env.get('PLIVO_AUTH_ID')
  const authToken = Deno.env.get('PLIVO_AUTH_TOKEN')
  const fromNumber = Deno.env.get('PLIVO_FROM_NUMBER')
  if (!authId || !authToken || !fromNumber) return json({ error: 'Plivo secrets are not configured' }, 500)

  const answerUrl = `${supabaseUrl}/functions/v1/plivo-answer${candidateId ? `?candidate_id=${encodeURIComponent(candidateId)}` : ''}`
  const form = new URLSearchParams({ from: fromNumber, to: String(toNumber), answer_url: answerUrl, answer_method: 'POST' })
  const plivoResponse = await fetch(`https://api.plivo.com/v1/Account/${authId}/Call/`, {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`${authId}:${authToken}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  })
  const result = await plivoResponse.json()
  if (!plivoResponse.ok) return json({ error: result?.error || 'Plivo could not start the call' }, plivoResponse.status)
  return json({ ok: true, request_uuid: result.request_uuid, message: 'Test call started' })
})
