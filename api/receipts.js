import { getReceipts } from "../lib/mongodb.js";
import { analyzeReceiptImages, publicReceipt, receiptRecord } from "../lib/receipt-analysis.js";
import { methodNotAllowed, readSession } from "../lib/session.js";

export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) return methodNotAllowed(res, ["GET", "POST"]);
  const session = await readSession(req);
  if (!session || session.tokenType !== "mobile") return res.status(401).json({ error: "Önce Apple hesabınızla giriş yapın." });
  let receipts;
  try { receipts = await getReceipts(); }
  catch (error) { console.error("MongoDB receipt connection failed", error.name); return res.status(503).json({ error: "Veritabanı şu anda kullanılamıyor." }); }

  if (req.method === "GET") {
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit || "20", 10) || 20));
    const before = typeof req.query.before === "string" ? new Date(req.query.before) : null;
    if (before && !Number.isFinite(before.getTime())) return res.status(400).json({ error: "Sayfalama tarihi geçersiz." });
    const filter = { userId: session.appleSub, ownerType: "user", ...(before ? { createdAt: { $lt: before } } : {}) };
    const rows = await receipts.find(filter).sort({ createdAt: -1 }).limit(limit).toArray();
    return res.status(200).json({ receipts: rows.map(publicReceipt) });
  }

  try {
    const { imageBase64, mimeType } = req.body || {};
    const analysis = await analyzeReceiptImages([{ base64: imageBase64, mimeType }]);
    const record = receiptRecord(analysis, session.appleSub, "user");
    const inserted = await receipts.insertOne(record);
    return res.status(201).json({ receipt: publicReceipt({ ...record, _id: inserted.insertedId }) });
  } catch (error) {
    const status = Number.isInteger(error.status) ? error.status : 502;
    console.error("Mobile receipt analysis failed", error.name);
    return res.status(status).json({ error: error.message || "Fiş analiz edilemedi." });
  }
}
