import 'dotenv/config'
import http from 'node:http'
import { WebSocket, WebSocketServer } from 'ws'

const PORT = Number(process.env.PORT || 8787)
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SARVAM_API_KEY = process.env.SARVAM_API_KEY
const DEFAULT_LANGUAGE = 'English'
const languageCodes = { English: 'en-IN', Tamil: 'ta-IN', Hindi: 'hi-IN' }

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SARVAM_API_KEY) {
  console.warn('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or SARVAM_API_KEY. The bridge will start but calls cannot be processed.')
}

const dbHeaders = { apikey: SUPABASE_SERVICE_ROLE_KEY || '', Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY || ''}`, 'Content-Type': 'application/json' }

async function db(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, { ...options, headers: { ...dbHeaders, ...(options.headers || {}) } })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.message || body?.hint || `Supabase request failed (${response.status})`)
  return body
}

function parseHeaders(value = '') {
  return Object.fromEntries(value.split(';').map((pair) => {
    const index = pair.indexOf('=')
    return index === -1 ? [pair, ''] : [pair.slice(0, index), decodeURIComponent(pair.slice(index + 1))]
  }).filter(([key]) => key))
}

function muLawToPcm16(input) {
  const output = Buffer.alloc(input.length * 2)
  for (let i = 0; i < input.length; i += 1) {
    const value = (~input[i]) & 0xff
    const sign = value & 0x80
    const exponent = (value >> 4) & 0x07
    const mantissa = value & 0x0f
    let sample = ((mantissa << 3) + 0x84) << exponent
    sample = sign ? 0x84 - sample : sample - 0x84
    output.writeInt16LE(Math.max(-32768, Math.min(32767, sample)), i * 2)
  }
  return output
}

function pcm16ToMuLaw(input) {
  const output = Buffer.alloc(Math.floor(input.length / 2))
  for (let i = 0; i < output.length; i += 1) {
    let sample = input.readInt16LE(i * 2)
    const sign = sample < 0 ? 0x80 : 0
    if (sample < 0) sample = -sample
    sample = Math.min(sample, 32635) + 132
    let exponent = 7
    for (let mask = 0x4000; (sample & mask) === 0 && exponent > 0; mask >>= 1) exponent -= 1
    const mantissa = (sample >> (exponent + 3)) & 0x0f
    output[i] = ~(sign | (exponent << 4) | mantissa) & 0xff
  }
  return output
}

function wavToMuLaw(wavBase64) {
  const wav = Buffer.from(wavBase64, 'base64')
  const dataOffset = wav.indexOf(Buffer.from('data'))
  if (dataOffset < 0) throw new Error('Sarvam returned audio without a WAV data chunk')
  const dataLength = wav.readUInt32LE(dataOffset + 4)
  const pcm = wav.subarray(dataOffset + 8, dataOffset + 8 + dataLength)
  return pcm16ToMuLaw(pcm)
}

async function speak(text, language) {
  const response = await fetch('https://api.sarvam.ai/text-to-speech', {
    method: 'POST',
    headers: { 'api-subscription-key': SARVAM_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language_code: languageCodes[language] || 'en-IN', speaker: 'shubh', model: 'bulbul:v3', speech_sample_rate: 8000, output_audio_codec: 'wav' }),
  })
  const body = await response.json()
  if (!response.ok || !body.audios?.[0]) throw new Error(body?.message || `Sarvam TTS failed (${response.status})`)
  return wavToMuLaw(body.audios[0]).toString('base64')
}

function questionSet(questions) {
  const required = [
    { id: null, question_text: 'What date and time would be convenient for you for an interview?', field: 'interview_availability' },
    { id: null, question_text: 'Would you prefer a face-to-face interview or a virtual interview?', field: 'interview_type' },
    { id: null, question_text: 'What is your last working day, or your notice period?', field: 'last_working_day' },
    { id: null, question_text: 'What is the main reason you are looking for a job change?', field: 'reason_for_job_change' },
  ]
  return [...required, ...(questions || []).map((question) => ({ ...question, field: null }))]
}

const translations = {
  Tamil: {
    'Thank you.': 'நன்றி.',
    'What date and time would be convenient for you for an interview?': 'நேர்காணலுக்கு உங்களுக்கு எந்த தேதி மற்றும் நேரம் வசதியாக இருக்கும்?',
    'Would you prefer a face-to-face interview or a virtual interview?': 'நேருக்கு நேர் நேர்காணலையா அல்லது ஆன்லைன் நேர்காணலையா விரும்புகிறீர்கள்?',
    'What is your last working day, or your notice period?': 'உங்கள் கடைசி பணிநாள் அல்லது நோட்டீஸ் காலம் என்ன?',
    'What is the main reason you are looking for a job change?': 'வேலை மாற்றத்தை எதிர்பார்ப்பதற்கான முக்கிய காரணம் என்ன?',
    goodbye: 'உங்கள் நேரத்திற்கு நன்றி. எங்கள் ஆட்சேர்ப்பு குழு உங்கள் பதில்களை பரிசீலித்து உங்களை தொடர்பு கொள்ளும். நன்றி.',
  },
  Hindi: {
    'Thank you.': 'धन्यवाद।',
    'What date and time would be convenient for you for an interview?': 'आपके लिए इंटरव्यू की कौन सी तारीख और समय सुविधाजनक रहेगा?',
    'Would you prefer a face-to-face interview or a virtual interview?': 'आप आमने-सामने इंटरव्यू पसंद करेंगे या ऑनलाइन इंटरव्यू?',
    'What is your last working day, or your notice period?': 'आपका आखिरी कार्य दिवस या नोटिस पीरियड क्या है?',
    'What is the main reason you are looking for a job change?': 'आप नौकरी बदलने के मुख्य कारण के बारे में बताइए।',
    goodbye: 'आपके समय के लिए धन्यवाद। हमारी भर्ती टीम आपके जवाबों की समीक्षा करके आपसे संपर्क करेगी। धन्यवाद।',
  },
}

function localizedText(language, text) {
  return translations[language]?.[text] || text
}

class ScreeningSession {
  constructor(socket, metadata) {
    this.socket = socket
    this.metadata = metadata
    this.language = metadata.language || DEFAULT_LANGUAGE
    this.questions = questionSet(JSON.parse(metadata.questions || '[]'))
    this.index = 0
    this.answers = []
    this.busy = false
  }

  async sendAudio(text) {
    const payload = await speak(localizedText(this.language, text), this.language)
    this.socket.send(JSON.stringify({ event: 'playAudio', media: { contentType: 'audio/x-mulaw', sampleRate: 8000, payload } }))
  }

  async start() {
    const intro = this.language === 'Tamil'
      ? `வணக்கம், வேலை வாய்ப்பு தொடர்பான ஆரம்பத் தேர்வுக்காக ${this.metadata.callerName || 'Kural AI'} சார்பில் அழைக்கிறோம். ${this.metadata.candidateName || 'உங்களிடம்'} பேசலாமா?`
      : this.language === 'Hindi'
        ? `नमस्ते, नौकरी की प्रारंभिक स्क्रीनिंग के लिए ${this.metadata.callerName || 'Kural AI'} से कॉल कर रहे हैं। क्या मैं ${this.metadata.candidateName || 'आपसे'} बात कर सकता हूँ?`
        : `Hello, this is ${this.metadata.callerName || 'Kural AI'} calling for a job screening. May I speak with ${this.metadata.candidateName || 'you'}?`
    await this.sendAudio(intro)
    await this.sendAudio(this.questions[0].question_text)
  }

  async handleTranscript(transcript) {
    const text = String(transcript || '').trim()
    if (!text || this.busy) return
    this.busy = true
    try {
      this.answers.push({ question: this.questions[this.index], answer: text })
      this.index += 1
      if (this.index >= this.questions.length) {
        await this.saveResults()
        await this.sendAudio(translations[this.language]?.goodbye || 'Thank you for your time. Our recruitment team will review your responses and get back to you. Goodbye.')
        this.socket.close()
        return
      }
      await this.sendAudio('Thank you.')
      await this.sendAudio(this.questions[this.index].question_text)
    } finally {
      this.busy = false
    }
  }

  async saveResults() {
    const fields = {}
    for (const item of this.answers) {
      if (item.question.field) {
        if (item.question.field === 'last_working_day') fields.notice_period = item.answer
        else fields[item.question.field] = item.answer
      }
    }
    await db(`/candidates?id=eq.${encodeURIComponent(this.metadata.candidateId)}`, { method: 'PATCH', body: JSON.stringify({ ...fields, status: 'completed', preferred_language: this.language }) })
    const answerRows = this.answers.map((item) => ({ call_id: this.metadata.callId, question_id: item.question.id, question_text: item.question.question_text, answer_text: item.answer, answer_status: 'answered' }))
    if (answerRows.length) await db('/candidate_answers', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(answerRows) })
    await db(`/calls?id=eq.${encodeURIComponent(this.metadata.callId)}`, { method: 'PATCH', body: JSON.stringify({ language: this.language, transcript: this.answers.map((item) => `${item.question.question_text}\n${item.answer}`).join('\n\n'), ai_summary: `Screening completed with ${this.answers.length} responses.` }) })
  }
}

const server = http.createServer((_request, response) => { response.writeHead(200, { 'content-type': 'text/plain' }); response.end('Kural AI voice bridge is running') })
const wss = new WebSocketServer({ server, path: '/stream' })

wss.on('connection', (socket) => {
  console.log('Plivo media stream connected')
  let session
  let sarvam
  socket.on('message', async (raw) => {
    const event = JSON.parse(raw.toString())
    if (event.event === 'start') {
      const metadata = parseHeaders(event.extra_headers)
      console.log('Call stream started', { callId: metadata.callId, candidateId: metadata.candidateId, language: metadata.language })
      const candidate = await db(`/candidates?id=eq.${encodeURIComponent(metadata.candidateId)}&select=full_name`).catch(() => [])
      metadata.candidateName = candidate?.[0]?.full_name || 'you'
      session = new ScreeningSession(socket, metadata)
      const query = new URLSearchParams({ language_code: languageCodes[session.language] || 'en-IN', model: 'saaras:v4', mode: 'transcribe', sample_rate: '8000', input_audio_codec: 'pcm_raw', high_vad_sensitivity: 'true', flush_signal: 'true' })
      sarvam = new WebSocket(`wss://api.sarvam.ai/speech-to-text/ws?${query}`, { headers: { 'Api-Subscription-Key': SARVAM_API_KEY } })
      sarvam.on('message', (message) => {
        const result = JSON.parse(message.toString())
        const transcript = result?.data?.transcript || result?.transcript
        if (transcript) {
          console.log('Transcript received', { candidateId: metadata.candidateId, transcript })
          session.handleTranscript(transcript).catch((error) => console.error('Screening error:', error.message))
        }
      })
      sarvam.on('open', () => {
        console.log('Sarvam STT connected', { candidateId: metadata.candidateId })
        session.start().catch((error) => console.error('Greeting error:', error.message))
      })
      sarvam.on('error', (error) => console.error('Sarvam STT error:', error.message))
      sarvam.on('close', (code, reason) => console.log('Sarvam STT closed', { code, reason: reason.toString() }))
    } else if (event.event === 'media' && sarvam?.readyState === WebSocket.OPEN) {
      const pcm = muLawToPcm16(Buffer.from(event.media.payload, 'base64'))
      sarvam.send(JSON.stringify({ audio: { data: pcm.toString('base64'), sample_rate: 8000, encoding: 'pcm_raw' } }))
    }
  })
  socket.on('close', (code, reason) => {
    console.log('Plivo media stream closed', { code, reason: reason.toString() })
    sarvam?.close()
  })
  socket.on('error', (error) => console.error('Plivo stream error:', error.message))
})

server.listen(PORT, () => console.log(`Kural AI voice bridge listening on port ${PORT}`))
