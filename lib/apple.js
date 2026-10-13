import { createRemoteJWKSet, jwtVerify } from "jose";

const issuer = "https://appleid.apple.com";
const jwks = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

export async function verifyMobileIdentityToken(identityToken, nonce) {
  const audience = process.env.APPLE_IOS_BUNDLE_ID || "com.pikselmutfak.tripwise";
  const { payload } = await jwtVerify(identityToken, jwks, {
    issuer,
    audience,
    algorithms: ["RS256"],
  });
  if (typeof payload.sub !== "string" || !payload.sub || payload.nonce !== nonce) {
    throw new Error("Apple identity token nonce or subject did not match");
  }
  if (payload.email && typeof payload.email !== "string") throw new Error("Apple email claim was invalid");
  return {
    appleSub: payload.sub,
    email: typeof payload.email === "string" ? payload.email : "",
    emailVerified: payload.email_verified === true || payload.email_verified === "true",
    isPrivateEmail: payload.is_private_email === true || payload.is_private_email === "true",
  };
}
