import { ObjectId } from "mongodb";
import { getAdmins, getUsers } from "../../lib/mongodb.js";
import { isAdmin, methodNotAllowed, readSession } from "../../lib/session.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  const session = await readSession(req);
  if (!session) return res.status(200).json({ user: null });
  try {
    if (isAdmin(session)) {
      if (!ObjectId.isValid(session.adminId)) return res.status(200).json({ user: null });
      const admin = await (await getAdmins()).findOne({ _id: new ObjectId(session.adminId), isActive: true }, { projection: { email: 1, name: 1 } });
      return res.status(200).json({ user: admin ? { id: String(admin._id), email: admin.email, name: admin.name || "", role: "admin" } : null });
    }
    if (session.tokenType !== "mobile") return res.status(200).json({ user: null });
    const user = await (await getUsers()).findOne({ appleSub: session.appleSub }, { projection: { email: 1, name: 1, appleSub: 1 } });
    return res.status(200).json({ user: user ? { id: user.appleSub, email: user.email || null, display_name: user.name || null, role: "user" } : null });
  } catch (error) {
    console.error("Session profile lookup failed", error.name);
    return res.status(503).json({ error: "Veritabanı şu anda kullanılamıyor." });
  }
}
