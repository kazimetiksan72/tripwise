import { getUsers } from "../../lib/mongodb.js";
import { isAdmin, methodNotAllowed, readSession } from "../../lib/session.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  const session = await readSession(req);
  if (!isAdmin(session)) return res.status(401).json({ error: "Yönetici girişi gerekli" });
  const page = Math.max(1, Math.min(100_000, Number.parseInt(req.query.page || "1", 10) || 1));
  const limit = 50;
  try {
    const collection = await getUsers();
    const [users, total] = await Promise.all([
      collection.find({}, { projection: { _id: 0, appleSub: 1, email: 1, emailVerified: 1, isPrivateEmail: 1, name: 1, createdAt: 1, lastLoginAt: 1 } })
        .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
      collection.countDocuments(),
    ]);
    return res.status(200).json({ users: users.map(({ appleSub, ...user }) => user), page, limit, total, pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error("MongoDB admin user list failed", error.name);
    return res.status(503).json({ error: "Veritabanı şu anda kullanılamıyor." });
  }
}
