import { SignJWT, jwtVerify } from "jose";

const cookieName = "fisgaranti_session";
function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters");
  return new TextEncoder().encode(value);
}

export async function createSession(user, tokenType = "admin") {
  const isMobile = tokenType === "mobile";
  const role = isMobile ? "user" : "admin";
  return new SignJWT({
    email: user.email || "", emailVerified: Boolean(user.emailVerified), name: user.name || "",
    role, tokenType,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.appleSub || String(user._id))
    .setIssuer("fisgaranti")
    .setAudience(isMobile ? "fisgaranti-mobile" : "fisgaranti-admin")
    .setIssuedAt()
    .setExpirationTime(isMobile ? "30d" : "8h")
    .sign(secret());
}

export async function readSession(req) {
  const authorization = req.headers.authorization || "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  const cookie = req.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`));
  try {
    const token = bearer || (cookie ? decodeURIComponent(cookie.slice(cookieName.length + 1)) : "");
    if (!token) return null;
    const { payload } = await jwtVerify(token, secret(), { issuer: "fisgaranti", algorithms: ["HS256"] });
    if (!payload.sub || !["admin", "mobile"].includes(payload.tokenType) ||
      (payload.tokenType === "admin" && payload.aud !== "fisgaranti-admin") ||
      (payload.tokenType === "mobile" && payload.aud !== "fisgaranti-mobile") ||
      (bearer && payload.tokenType !== "mobile") || (!bearer && payload.tokenType !== "admin")) return null;
    return {
      appleSub: payload.tokenType === "mobile" ? payload.sub : "",
      adminId: payload.tokenType === "admin" ? payload.sub : "",
      email: typeof payload.email === "string" ? payload.email : "",
      emailVerified: payload.emailVerified === true,
      name: typeof payload.name === "string" ? payload.name : "",
      role: payload.tokenType === "admin" ? "admin" : "user",
      tokenType: payload.tokenType,
    };
  } catch { return null; }
}

export function setSessionCookie(res, token) {
  res.setHeader("Set-Cookie", `${cookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800`);
}

export function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

export function isAdmin(session) {
  return session?.role === "admin" && session?.tokenType === "admin";
}

export function methodNotAllowed(res, allowed) {
  res.setHeader("Allow", allowed.join(", "));
  return res.status(405).json({ error: "Method not allowed" });
}
