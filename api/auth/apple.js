import { exchangeAndVerifyAppleCode } from "../../lib/apple.js";
import { getUsers } from "../../lib/mongodb.js";
import { createSession, isAdmin, methodNotAllowed, setSessionCookie } from "../../lib/session.js";

function cleanName(value) {
  if (typeof value !== "string") return "";
  return value.replace(/[<>\u0000-\u001f]/g, "").trim().slice(0, 120);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  try {
    const { code, nonce, displayName } = req.body || {};
    if (typeof code !== "string" || typeof nonce !== "string") return res.status(400).json({ error: "Apple authorization code and nonce are required" });
    const identity = await exchangeAndVerifyAppleCode(code, nonce);
    const users = await getUsers();
    const now = new Date();
    const name = cleanName(displayName);
    const result = await users.findOneAndUpdate(
      { appleSub: identity.appleSub },
      {
        $set: { email: identity.email, emailVerified: identity.emailVerified, isPrivateEmail: identity.isPrivateEmail, lastLoginAt: now, ...(name ? { name } : {}) },
        $setOnInsert: { appleSub: identity.appleSub, createdAt: now, ...(!name ? { name: "" } : {}) },
      },
      { upsert: true, returnDocument: "after", projection: { appleSub: 1, email: 1, name: 1, createdAt: 1, lastLoginAt: 1 } },
    );
    const user = result.value ?? result;
    if (!user) throw new Error("User record could not be loaded");
    const role = isAdmin(user.appleSub, user.emailVerified ? user.email : "") ? "admin" : "user";
    const session = await createSession({ ...user, role });
    setSessionCookie(res, session);
    return res.status(200).json({ user: { id: user.appleSub, email: user.email, name: user.name || "", role } });
  } catch (error) {
    console.error("Apple sign-in failed", error.message);
    return res.status(401).json({ error: "Apple ile giriş doğrulanamadı. Apple ve sunucu ayarlarını kontrol et." });
  }
}
