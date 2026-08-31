const xmlResponse = (xml: string) => new Response(xml, { headers: { 'Content-Type': 'application/xml' } })

Deno.serve(async (request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const streamUrl = Deno.env.get('KURAL_STREAM_URL')
  const url = new URL(request.url)
  const candidateId = url.searchParams.get('candidate_id')
  const callId = url.searchParams.get('call_id')

  // Keep a simple fallback so the phone setup remains testable before the bridge is hosted.
  if (!supabaseUrl || !serviceRoleKey || !streamUrl || !candidateId || !callId) {
    return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?><Response><Speak language="en-US" voice="WOMAN">Hello. This is a test call from Kural AI Screening. Your AI screening call setup is working.</Speak><Hangup/></Response>`)
  }

  const headers = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` }
  const candidateResponse = await fetch(`${supabaseUrl}/rest/v1/candidates?id=eq.${encodeURIComponent(candidateId)}&select=id,full_name,preferred_language,campaign_id,campaigns(name,primary_language,company_name,company_disclosure,caller_name)`, { headers })
  const candidateRows = await candidateResponse.json()
  const candidate = candidateRows?.[0]
  if (!candidate) return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?><Response><Speak language="en-US">We could not load the candidate record. Goodbye.</Speak><Hangup/></Response>`)

  const campaignId = candidate.campaign_id
  const questionsResponse = campaignId
    ? await fetch(`${supabaseUrl}/rest/v1/screening_questions?campaign_id=eq.${encodeURIComponent(campaignId)}&is_active=eq.true&select=id,question_text,required,sort_order&order=sort_order.asc`, { headers })
    : null
  const questions = questionsResponse ? await questionsResponse.json() : []
  const campaign = candidate.campaigns
  const language = candidate.preferred_language || campaign?.primary_language || 'English'
  const extraHeaders = [
    `callId=${encodeURIComponent(callId)}`,
    `candidateId=${encodeURIComponent(candidateId)}`,
    `language=${encodeURIComponent(language)}`,
    `callerName=${encodeURIComponent(campaign?.caller_name || 'Kural AI')}`,
    `companyDisclosure=${encodeURIComponent(campaign?.company_disclosure || 'if_asked')}`,
    `companyName=${encodeURIComponent(campaign?.company_name || '')}`,
    `questions=${encodeURIComponent(JSON.stringify(questions || []))}`,
  ].join(';')

  const safeHeaders = extraHeaders.replace(/[<>\"']/g, '')
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Stream bidirectional="true" keepCallAlive="true" contentType="audio/x-mulaw;rate=8000" extraHeaders="${safeHeaders}">${streamUrl}</Stream></Response>`
  return xmlResponse(xml)
})
