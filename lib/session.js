import { SignJWT, jwtVerify } from "jose";

const cookieName = "fisgaranti_session";
function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters");
  return new TextEncoder().encode(value);
}

export async function createSession(user) {
  const token = await new SignJWT({ email: user.email, emailVerified: Boolean(user.emailVerified), name: user.name, role: user.role || "user" })
    .setProtectedHeader({ alg: "HS256" }).setSubject(user.appleSub).setIssuer("fisgaranti")
    .setIssuedAt().setExpirationTime("7d").sign(secret());
  return token;
}

export async function readSession(req) {
  const cookie = req.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`));
  if (!cookie) return null;
  try {
    const token = decodeURIComponent(cookie.slice(cookieName.length + 1));
    const { payload } = await jwtVerify(token, secret(), { issuer: "fisgaranti", algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return { appleSub: payload.sub, email: payload.email || "", emailVerified: payload.emailVerified === true, name: payload.name || "", role: payload.role || "user" };
  } catch { return null; }
}

export function setSessionCookie(res, token) {
  res.setHeader("Set-Cookie", `${cookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`);
}

export function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

export function isAdmin(subject, email = "") {
  const allowed = (process.env.ADMIN_APPLE_SUBJECTS || "").split(",").map((id) => id.trim()).filter(Boolean);
  const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(subject) || adminEmails.includes(email.toLowerCase());
}

export function methodNotAllowed(res, allowed) {
  res.setHeader("Allow", allowed.join(", "));
  return res.status(405).json({ error: "Method not allowed" });
}
