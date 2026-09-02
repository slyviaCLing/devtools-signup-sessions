import assert from "node:assert/strict";
import { decideSignup } from "./signup_service";

const base = { email: "clinician@example.dev", password: "long-enough-password", name: "Dr Lin", captchaToken: "token" };
assert.equal(decideSignup(base), "accepted");
assert.equal(decideSignup({ ...base, email: "person@publicmail.test" }), "rejected");
console.log("signup policy checks passed");
