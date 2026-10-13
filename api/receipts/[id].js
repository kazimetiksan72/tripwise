import { ObjectId } from "mongodb";
import { getReceipts } from "../../lib/mongodb.js";
import { methodNotAllowed, readSession } from "../../lib/session.js";

export default async function handler(req, res) {
  if (req.method !== "DELETE") return methodNotAllowed(res, ["DELETE"]);
  const session = await readSession(req);
  if (!session || session.tokenType !== "mobile") return res.status(401).json({ error: "Oturum geçersiz." });
  const id = req.query.id;
  if (typeof id !== "string" || !ObjectId.isValid(id)) return res.status(400).json({ error: "Fiş kimliği geçersiz." });
  const result = await (await getReceipts()).deleteOne({ _id: new ObjectId(id), userId: session.appleSub, ownerType: "user" });
  if (!result.deletedCount) return res.status(404).json({ error: "Fiş bulunamadı." });
  return res.status(200).json({ deleted: true });
}
