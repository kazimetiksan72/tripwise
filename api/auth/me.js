import { getUsers } from "../../lib/mongodb.js";
import { isAdmin, methodNotAllowed, readSession } from "../../lib/session.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  const session = await readSession(req);
  if (!session) return res.status(200).json({ user: null });
  const user = await (await getUsers()).findOne({ appleSub: session.appleSub }, { projection: { email: 1, emailVerified: 1, name: 1, appleSub: 1 } });
  if (!user) return res.status(200).json({ user: null });
  return res.status(200).json({ user: { id: user.appleSub, email: user.email, name: user.name || "", role: isAdmin(user.appleSub, user.emailVerified ? user.email : "") ? "admin" : "user" } });
}
