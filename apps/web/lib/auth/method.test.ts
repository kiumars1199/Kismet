// T-wt2c: /account names how you actually signed in: Google, an email link, or email + password. Read from the session's `amr`
// claim (how THIS session started) and the identity provider; unknown means no claim at all (never a guess).
import { describe, expect, it } from "vitest";
import { signInClause, signInMethod } from "./method";

const jwt = (payload: object) => `${Buffer.from("{}").toString("base64url")}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.sig`;

describe("signInMethod", () => {
  it("password", () => expect(signInMethod(jwt({ amr: [{ method: "password", timestamp: 1 }] }), "email")).toBe("password"));
  it("email link: otp and magiclink", () => {
    expect(signInMethod(jwt({ amr: [{ method: "otp" }] }), "email")).toBe("email_link");
    expect(signInMethod(jwt({ amr: [{ method: "magiclink" }] }), "email")).toBe("email_link");
  });
  it("Google: oauth amr or the google provider", () => {
    expect(signInMethod(jwt({ amr: [{ method: "oauth" }] }), "google")).toBe("google");
    expect(signInMethod(jwt({}), "google")).toBe("google");
  });
  it("a password account that opens an email link is an email link (amr wins over the provider)", () => {
    expect(signInMethod(jwt({ amr: [{ method: "otp" }] }), "email")).toBe("email_link");
  });
  it("a Google account in a recovery, invite, SSO, MFA or refreshed session does not read as Google", () => {
    for (const amr of [["recovery"], ["invite"], ["email_change"], ["sso/saml"], ["totp", "password"], ["token_refresh"]]) {
      expect(signInMethod(jwt({ amr: amr.map((method) => ({ method })) }), "google"), amr.join(",")).toBeNull();
    }
  });
  it("no claim, a broken token or no token: null", () => {
    expect(signInMethod(jwt({}), "email")).toBeNull();
    expect(signInMethod("garbage", "email")).toBeNull();
    expect(signInMethod(undefined, undefined)).toBeNull();
  });
});

describe("signInClause", () => {
  it("one clause per method, and nothing when unknown", () => {
    expect(signInClause("google")).toBe(", with Google");
    expect(signInClause("email_link")).toBe(", with an email link");
    expect(signInClause("password")).toBe(", with your email and password");
    expect(signInClause(null)).toBe("");
  });
});
