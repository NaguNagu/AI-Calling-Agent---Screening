Deno.serve((_request) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Speak language="en-US" voice="WOMAN">Hello. This is a test call from Kural AI Screening. Your AI screening call setup is working.</Speak><Hangup/></Response>`
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } })
})
