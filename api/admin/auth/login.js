import bcrypt from "bcryptjs";
import { getAdmins } from "../../../lib/mongodb.js";
import { createSession, methodNotAllowed, setSessionCookie } from "../../../lib/session.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length > 200) {
    return res.status(400).json({ error: "E-posta veya şifre geçersiz." });
  }
  try {
    const admin = await (await getAdmins()).findOne({ email, isActive: true });
    if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
      return res.status(401).json({ error: "E-posta veya şifre hatalı." });
    }
    await (await getAdmins()).updateOne({ _id: admin._id }, { $set: { lastLoginAt: new Date() } });
    const token = await createSession(admin, "admin");
    setSessionCookie(res, token);
    return res.status(200).json({ user: { id: String(admin._id), email: admin.email, name: admin.name || "", role: "admin" } });
  } catch (error) {
    console.error("Admin sign-in failed", error.name);
    return res.status(503).json({ error: "Giriş servisi şu anda kullanılamıyor." });
  }
}
