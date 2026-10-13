import { createHash } from "node:crypto";
import { verifyMobileIdentityToken } from "../../lib/apple.js";
import { getAuthChallenges, getUsers } from "../../lib/mongodb.js";
import { createSession, methodNotAllowed } from "../../lib/session.js";

function cleanName(value) {
  if (typeof value !== "string") return "";
  return value.replace(/[<>\u0000-\u001f]/g, "").trim().slice(0, 120);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  try {
    const { identityToken, nonce, fullName } = req.body || {};
    if (typeof identityToken !== "string" || identityToken.length > 12_000 || typeof nonce !== "string" || !/^[a-f0-9]{64}$/.test(nonce)) {
      return res.status(400).json({ error: "Apple giriş bilgileri geçersiz." });
    }
    let identity;
    try {
      identity = await verifyMobileIdentityToken(identityToken, nonce);
    } catch (error) {
      console.error("Apple identity verification failed", error.name);
      return res.status(error.message === "APPLE_IOS_BUNDLE_ID is not configured" ? 503 : 401).json({ error: "Apple kimliği doğrulanamadı. Apple ayarlarını kontrol edin." });
    }
    const nonceHash = createHash("sha256").update(nonce).digest("hex");
    const challenges = await getAuthChallenges();
    const challenge = await challenges.findOneAndDelete({ nonceHash, expiresAt: { $gt: new Date() } });
    if (!challenge) return res.status(401).json({ error: "Giriş isteğinin süresi doldu. Yeniden deneyin." });

    const users = await getUsers();
    const now = new Date();
    const name = cleanName(fullName);
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
    const token = await createSession(user, "mobile");
    return res.status(200).json({
      token,
      user: { id: user.appleSub, email: user.email || null, display_name: user.name || null },
    });
  } catch (error) {
    console.error("Mobile Apple sign-in failed", error.name);
    return res.status(503).json({ error: "Giriş servisi şu anda kullanılamıyor." });
  }
}
