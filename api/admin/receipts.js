import { isAdmin, methodNotAllowed, readSession } from "../../lib/session.js";
import { getReceipts } from "../../lib/mongodb.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  const session = await readSession(req);
  if (!isAdmin(session)) return res.status(401).json({ error: "Yönetici oturumu gerekli." });
  const page = Math.max(1, Math.min(100_000, Number.parseInt(req.query.page || "1", 10) || 1));
  const limit = 50;
  try {
    const receipts = await getReceipts();
    const [rows, total] = await Promise.all([
      receipts.find({}).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
      receipts.countDocuments(),
    ]);
    return res.status(200).json({ receipts: rows.map((row) => ({ ...row, id: String(row._id), userId: String(row.userId) })), page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (error) {
    console.error("MongoDB admin receipt list failed", error.name);
    return res.status(503).json({ error: "Veritabanı şu anda kullanılamıyor." });
  }
}
