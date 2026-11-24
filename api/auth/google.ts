import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import * as jose from "jose";
import { env } from "../lib/env";
import { getSessionCookieOptions } from "../lib/cookies";
import { Session } from "@contracts/constants";
import { Errors } from "@contracts/errors";
import * as cookie from "cookie";
import { signSessionToken, verifySessionToken } from "./session";
import { findUserByUnionId, upsertUser } from "../queries/users";
import { Paths } from "@contracts/constants";

const STATE_COOKIE = "no73_oauth_state";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS = jose.createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

function getOrigin(c: Context): string {
  if (env.appUrl) return env.appUrl.replace(/\/+$/, "");
  const headers = c.req.raw.headers;
  const host =
    headers.get("x-forwarded-host")?.split(",")[0].trim() ??
    headers.get("host") ??
    new URL(c.req.url).host;
  const local = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const proto =
    headers.get("x-forwarded-proto")?.split(",")[0].trim() ??
    (local ? "http" : "https");
  return `${proto}://${host}`;
}

/** GET /api/auth/google — sends the browser to Google's sign-in page. */
export function createGoogleStartHandler() {
  return (c: Context) => {
    if (!env.googleClientId) return c.redirect("/login?error=config", 302);
    const origin = getOrigin(c);
    const state = crypto.randomUUID();
    setCookie(c, STATE_COOKIE, state, {
      httpOnly: true,
      path: "/",
      sameSite: "Lax",
      secure: origin.startsWith("https://"),
      maxAge: 600,
    });
    const url = new URL(GOOGLE_AUTH_URL);
    url.searchParams.set("client_id", env.googleClientId);
    url.searchParams.set("redirect_uri", `${origin}${Paths.oauthCallback}`);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("prompt", "select_account");
    return c.redirect(url.toString(), 302);
  };
}

type GoogleTokenResponse = { id_token?: string; access_token?: string };

/** GET /api/oauth/callback — Google redirects back here with ?code&state. */
export function createGoogleCallbackHandler() {
  return async (c: Context) => {
    const error = c.req.query("error");
    if (error) return c.redirect(error === "access_denied" ? "/login" : "/login?error=google", 302);

    const code = c.req.query("code");
    const state = c.req.query("state");
    const savedState = getCookie(c, STATE_COOKIE);
    deleteCookie(c, STATE_COOKIE, { path: "/" });
    if (!code || !state || !savedState || state !== savedState) {
      return c.redirect("/login?error=state", 302);
    }

    try {
      const origin = getOrigin(c);
      const resp = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: env.googleClientId,
          client_secret: env.googleClientSecret,
          redirect_uri: `${origin}${Paths.oauthCallback}`,
        }).toString(),
      });
      if (!resp.ok) {
        throw new Error(`Token exchange failed (${resp.status}): ${await resp.text()}`);
      }
      const tokens = (await resp.json()) as GoogleTokenResponse;
      if (!tokens.id_token) throw new Error("Google did not return an id_token");

      const { payload } = await jose.jwtVerify(tokens.id_token, GOOGLE_JWKS, {
        issuer: ["https://accounts.google.com", "accounts.google.com"],
        audience: env.googleClientId,
      });
      if (!payload.sub) throw new Error("id_token has no sub");
      const email = typeof payload.email === "string" ? payload.email.toLowerCase() : null;
      const emailVerified = payload.email_verified === true || payload.email_verified === "true";

      const unionId = `google:${payload.sub}`;
      await upsertUser({
        unionId,
        name: typeof payload.name === "string" ? payload.name : email,
        email,
        avatar: typeof payload.picture === "string" ? payload.picture : null,
        lastSignInAt: new Date(),
        // Only a verified Google email may claim the owner/admin role.
        ...(emailVerified && email && email === env.ownerEmail ? { role: "admin" as const } : {}),
      });

      const token = await signSessionToken({ unionId, clientId: "no73" });
      setCookie(c, Session.cookieName, token, {
        ...getSessionCookieOptions(c.req.raw.headers),
        maxAge: Session.maxAgeMs / 1000,
      });
      return c.redirect("/", 302);
    } catch (err) {
      console.error("[OAuth] Google callback failed", err);
      return c.redirect("/login?error=google", 302);
    }
  };
}

export async function authenticateRequest(headers: Headers) {
  const cookies = cookie.parse(headers.get("cookie") || "");
  const token = cookies[Session.cookieName];
  if (!token) throw Errors.forbidden("Invalid authentication token.");
  const claim = await verifySessionToken(token);
  if (!claim) throw Errors.forbidden("Invalid authentication token.");
  const user = await findUserByUnionId(claim.unionId);
  if (!user) throw Errors.forbidden("User not found. Please re-login.");
  return user;
}
