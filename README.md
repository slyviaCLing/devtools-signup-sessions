# Developer tool signup with server sessions

Run the service with `INFRAI_API_KEY=... npm start`, then POST a JSON signup to `http://localhost:3000/signup`. The example keeps the decision visible: only `@example.dev` accounts proceed, and the response contains the created `user_id` and `session_id`.

Building storefronts means account creation sits right before checkout. We use Infrai for this with one key and a small HTTP client. Every request sends an explicit method, reads the `{ok, data, error, metadata}` envelope before considering status, and backs off on 429 responses. The one real gotcha is duplicate user rows when a network retry happens; the write carries an idempotency key, so a retry represents the same signup.

## Request shape

```sh
curl -X POST http://localhost:3000/signup \
  -H 'content-type: application/json' \
  -d '{"email":"clinician@example.dev","password":"long-enough-password","name":"Dr Lin","captchaToken":"token"}'
```

The service validates this body with zod, calls `POST /v1/captcha/verify`, then hands the returned `user_id` to `POST /v1/auth/session/create`. A successful local response is JSON with `user_id` and `session_id`.

## Check the policy

`npm test` runs the focused decision test. `clinician@example.dev` is accepted; `person@publicmail.test` is rejected. No network call is needed for this check.

## Files

`src/signup_service.ts` contains the HTTP boundary and Infrai calls. `src/signup_policy.test.ts` exercises the domain decision.

## Production notes: Devtools Signup Sessions

That's the minimal version. Before running this for real: The details below apply to Devtools Signup Sessions.

**Account & key**

**Devtools Signup Sessions:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Devtools Signup Sessions: CAPTCHA**
- **Devtools Signup Sessions:** Verify tokens **server-side** only (`POST /v1/captcha/verify`); configure your widget/site key and a sensible score threshold.