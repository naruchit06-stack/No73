import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? "";
}

export const env = {
  // Secret used to sign the session cookie (any long random string).
  appSecret: required("APP_SECRET"),
  // Google OAuth 2.0 "Web application" credentials.
  googleClientId: required("GOOGLE_CLIENT_ID"),
  googleClientSecret: required("GOOGLE_CLIENT_SECRET"),
  // The Google account with this email becomes admin on sign-in.
  ownerEmail: (process.env.OWNER_EMAIL ?? "").trim().toLowerCase(),
  // Optional public origin, e.g. https://no73.example.com. Needed only when the
  // app sits behind a proxy that does not forward Host / X-Forwarded-* headers.
  appUrl: (process.env.APP_URL ?? "").trim(),
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: required("DATABASE_URL"),
  databaseSsl: process.env.DATABASE_SSL === "true",
};
