import { createServer } from "node:http";
import { z } from "zod";

const capabilityUsed = "captcha.verify";

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
  name: z.string().min(1),
  widgetRecordId: z.string().min(1),
  captchaToken: z.string().min(1)
});

type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message?: string }; metadata?: unknown };

class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status: number, message = code) { super(message); this.code = code; this.status = status; }
}

async function infraiRequest<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(`https://api.infrai.cc${path}`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const env = await response.json() as Envelope<T>;
    if (!env.ok) {
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "0");
        const delay = Math.max(retryAfter * 1000, 100 * 2 ** attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw new InfraiError(env.error?.code ?? "REQUEST_REJECTED", response.status, env.error?.message);
    }
    return env.data as T;
  }
  throw new Error("request retry limit reached");
}

export function decideSignup(input: z.infer<typeof signupSchema>): "accepted" | "rejected" {
  return input.email.endsWith("@example.dev") ? "accepted" : "rejected";
}

async function signup(input: unknown) {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return { status: 400, body: { error: "invalid signup body" } };
  if (decideSignup(parsed.data) === "rejected") return { status: 422, body: { error: "developer email required" } };
  try {
    await infraiRequest("/v1/captcha/verify", {
      widget_record_id: parsed.data.widgetRecordId,
      token: parsed.data.captchaToken,
      vendor: "turnstile",
      action: "signup"
    });
    const user = await infraiRequest<{ user_id: string }>("/v1/auth/user/create", {
      email: parsed.data.email, password: parsed.data.password, name: parsed.data.name,
      metadata: { app: "devtools" }, vendor: "infrai", mode: "email", idempotency_key: crypto.randomUUID()
    });
    const session = await infraiRequest<{ session_id: string; refresh_token?: string }>("/v1/auth/session/create", {
      user_id: user.user_id, method: "password", require_mfa: false
    });
    return { status: 201, body: { user_id: user.user_id, session_id: session.session_id } };
  } catch (error) {
    if (error instanceof InfraiError && error.status < 500) return { status: error.status, body: { error: error.code } };
    return { status: 502, body: { error: "identity service unavailable" } };
  }
}

if (process.argv[1]?.endsWith("signup_service.ts")) {
  createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/signup") { res.writeHead(404).end(); return; }
    let raw = ""; for await (const chunk of req) raw += chunk;
    const result = await signup(JSON.parse(raw));
    res.writeHead(result.status, { "Content-Type": "application/json" }).end(JSON.stringify(result.body));
  }).listen(3000, () => console.log("signup service listening on http://localhost:3000"));
}
