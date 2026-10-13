import { ObjectId } from "mongodb";
import { getAdmins } from "../../../lib/mongodb.js";
import { isAdmin, methodNotAllowed, readSession } from "../../../lib/session.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  const session = await readSession(req);
  if (!isAdmin(session)) return res.status(401).json({ error: "Yönetici oturumu geçersiz." });
  if (!ObjectId.isValid(session.adminId)) return res.status(401).json({ error: "Yönetici oturumu geçersiz." });
  try {
    const admin = await (await getAdmins()).findOne({ _id: new ObjectId(session.adminId), isActive: true }, { projection: { email: 1, name: 1 } });
    if (!admin) return res.status(401).json({ error: "Yönetici hesabı bulunamadı." });
    return res.status(200).json({ user: { id: String(admin._id), email: admin.email, name: admin.name || "", role: "admin" } });
  } catch (error) {
    console.error("Admin session lookup failed", error.name);
    return res.status(503).json({ error: "Veritabanı şu anda kullanılamıyor." });
  }
}
