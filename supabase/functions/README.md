# Vaani Edge Functions

These functions keep Plivo credentials on the server and are not included in the browser bundle.

- `start-call` authenticates the signed-in Vaani user and starts an outbound Plivo call.
- `plivo-answer` returns the temporary greeting used for the first telephony test.

The greeting is intentionally simple. After the call route is verified, this function will be replaced with the multilingual AI conversation flow.
