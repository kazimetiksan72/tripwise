import { getReceipts } from "../lib/mongodb.js";
import { analyzeReceiptImages, receiptRecord } from "../lib/receipt-analysis.js";
import { methodNotAllowed, readSession } from "../lib/session.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  const session = await readSession(req);
  if (!session) return res.status(401).json({ error: "Giriş gerekli" });
  try {
    const analysis = await analyzeReceiptImages(req.body?.images);
    const userId = session.tokenType === "mobile" ? session.appleSub : session.adminId;
    const record = receiptRecord(analysis, userId, session.tokenType === "mobile" ? "user" : "admin");
    const inserted = await (await getReceipts()).insertOne(record);
    return res.status(200).json({ ...analysis, receiptId: String(inserted.insertedId) });
  } catch (error) {
    const status = Number.isInteger(error.status) ? error.status : 502;
    console.error("Receipt analysis failed", error.name);
    return res.status(status).json({ error: error.message || "Fiş analiz edilemedi." });
  }
}
