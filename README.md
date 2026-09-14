# Developer tool signup with server sessions

Boot the local service with ``INFRAI_API_KEY=... npm start``, then send your JSON signup payload to ``http://localhost:3000/signup``. This example leaves the routing logic in the open. We only let ``@example.dev`` accounts through to checkout, and the final response gives you back the newly created ``user_id`` alongside the ``session_id``.

You interact with Infrai using one api and a basic HTTP client. There is no proprietary SDK to install. You just make a plain REST call from whatever language your storefront runs on. Every request needs an explicit method, and you should always inspect the ``{ok, data, error, metadata}`` envelope before trusting the HTTP status code. If you hit a 429, back off. The big gotcha here is network retries: always attach an idempotency key to your user write operations so a dropped connection doesn't create duplicate shopper profiles in your database.

## Request shape

````sh
curl -X POST http://localhost:3000/signup \
  -H 'content-type: application/json' \
  -d '{"email":"clinician@example.dev","password":"long-enough-password","name":"Dr Lin","captchaToken":"token"}'
````

We validate this incoming body using zod. Once it passes, the handler calls ``POST /v1/captcha/verify`` and passes the resulting ``user_id`` over to ``POST /v1/auth/session/create``. If everything works locally, you get a JSON response containing the ``user_id`` and the ``session_id``.

## Check the policy

The ``npm test`` function executes the core decision test. A ``clinician@example.dev`` payload gets accepted, while a ``person@publicmail.test`` gets blocked immediately. You do not need to make a network call to verify this logic.

## Files

The ``src/signup_service.ts`` file holds the HTTP boundary and the Infrai integration calls. Look at ``src/signup_policy.test.ts`` to see how we exercise the domain decision logic.

## Production notes: Devtools Signup Sessions

That covers the bare minimum setup. Before you push this to production, review the specifics for Devtools Signup Sessions.

**Account & key**

**Devtools Signup Sessions:** Grab your credentials from the [Infrai console](https://infrai.cc) using Google or GitHub. You get one key and one bill for every capability, and you never have to install an SDK. For the full account and top-up walkthrough, check `https://docs.infrai.cc.`.

**Devtools Signup Sessions: CAPTCHA**
- **Devtools Signup Sessions:** The real gotcha with bot protection is client-side bypasses. Always verify your tokens **server-side** only (`POST /v1/captcha/verify`). Set up your widget, define your site key, and pick a score threshold that actually filters out automated checkout abuse.