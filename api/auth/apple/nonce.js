import { createHash, randomBytes } from "node:crypto";
import { getAuthChallenges } from "../../../lib/mongodb.js";
import { methodNotAllowed } from "../../../lib/session.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  try {
    const nonce = randomBytes(32).toString("hex");
    const nonceHash = createHash("sha256").update(nonce).digest("hex");
    const challenges = await getAuthChallenges();
    await challenges.deleteMany({ expiresAt: { $lte: new Date() } });
    await challenges.insertOne({ nonceHash, createdAt: new Date(), expiresAt: new Date(Date.now() + 5 * 60_000) });
    return res.status(200).json({ nonce });
  } catch (error) {
    console.error("Apple nonce creation failed", error.name);
    return res.status(503).json({ error: "Giriş servisi şu anda kullanılamıyor." });
  }
}
