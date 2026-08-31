# Kural AI voice bridge

This small Node service keeps a WebSocket open for each Plivo call. It receives 8 kHz mu-law audio from Plivo, converts it to raw PCM for Sarvam speech-to-text, runs the Kural AI screening question flow, converts Sarvam text-to-speech WAV audio back to 8 kHz mu-law, and sends it to the caller.

## Local test setup

1. In this folder, run `npm install`.
2. Copy `.env.example` to `.env` and fill in the values. Keep `.env` private and never upload it to GitHub.
3. Run `npm start`.
4. In a second terminal run `ngrok http 8787`.
5. Copy the HTTPS address from ngrok and change it to `wss://.../stream`.
6. Add this value as the Supabase Edge Function secret named `KURAL_STREAM_URL`.
7. Redeploy `plivo-answer`, then place a test call from Kural AI.

The bridge needs a publicly reachable `wss://` address. For an early test, ngrok is simplest. For regular team use, host this folder on a Node-friendly service with WebSocket support and use its permanent URL.

## Required secrets

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SARVAM_API_KEY`

The Supabase service-role key and Sarvam key must only exist in the bridge host's environment. Never put them in the React app or GitHub.
