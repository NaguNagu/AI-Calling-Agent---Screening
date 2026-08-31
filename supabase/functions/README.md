# Kural AI Edge Functions

These functions keep Plivo credentials on the server and are not included in the browser bundle.

- `start-call` authenticates the signed-in Kural AI user and starts an outbound Plivo call.
- `plivo-answer` returns a bidirectional Plivo `<Stream>` when `KURAL_STREAM_URL` is configured.

The WebSocket bridge is in `/bridge` because live audio connections should run on a Node/WebSocket host rather than an Edge Function.

Required Supabase Edge Function secrets:

- `PLIVO_AUTH_ID`
- `PLIVO_AUTH_TOKEN`
- `PLIVO_FROM_NUMBER`
- `SUPABASE_SERVICE_ROLE_KEY`
- `KURAL_STREAM_URL` (for example `wss://your-host.example/stream`)

The bridge separately requires `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SARVAM_API_KEY`.
