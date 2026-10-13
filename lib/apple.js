import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from "jose";

const issuer = "https://appleid.apple.com";
const jwks = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

function privateKey() {
  const encoded = process.env.APPLE_PRIVATE_KEY_BASE64;
  if (encoded) return Buffer.from(encoded, "base64").toString("utf8");
  return (process.env.APPLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
}

async function clientSecret() {
  const team = process.env.APPLE_TEAM_ID;
  const client = process.env.APPLE_CLIENT_ID;
  const keyId = process.env.APPLE_KEY_ID;
  if (!team || !client || !keyId || !privateKey()) throw new Error("Apple Sign in credentials are incomplete");
  const key = await importPKCS8(privateKey(), "ES256");
  return new SignJWT({}).setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(team).setSubject(client).setAudience(issuer).setIssuedAt().setExpirationTime("5m").sign(key);
}

export async function exchangeAndVerifyAppleCode(code, nonce) {
  if (!process.env.APPLE_CLIENT_ID || !nonce || nonce.length < 16 || code.length > 2048) throw new Error("Invalid Apple sign-in request");
  const body = new URLSearchParams({
    client_id: process.env.APPLE_CLIENT_ID,
    client_secret: await clientSecret(),
    code,
    grant_type: "authorization_code",
  });
  if (process.env.APPLE_REDIRECT_URI) body.set("redirect_uri", process.env.APPLE_REDIRECT_URI);
  const response = await fetch(`${issuer}/auth/token`, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body,
    signal: AbortSignal.timeout(10_000),
  });
  const data = await response.json();
  if (!response.ok || !data.id_token) throw new Error("Apple authorization code could not be verified");
  const { payload } = await jwtVerify(data.id_token, jwks, {
    issuer, audience: process.env.APPLE_CLIENT_ID, algorithms: ["RS256"],
  });
  if (payload.nonce !== nonce || typeof payload.sub !== "string" || !payload.sub) throw new Error("Apple token nonce or subject did not match");
  if (payload.email && typeof payload.email !== "string") throw new Error("Apple email claim was invalid");
  return {
    appleSub: payload.sub,
    email: payload.email || "",
    emailVerified: payload.email_verified === true || payload.email_verified === "true",
    isPrivateEmail: payload.is_private_email === true || payload.is_private_email === "true",
  };
}
