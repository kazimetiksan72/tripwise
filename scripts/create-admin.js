import bcrypt from "bcryptjs";
import { getAdmins } from "../lib/mongodb.js";

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME?.trim() || "";
if (!process.env.MONGODB_URI || !email || !password || password.length < 12) {
  throw new Error("Set MONGODB_URI, ADMIN_EMAIL, and ADMIN_PASSWORD (at least 12 characters).");
}

const admins = await getAdmins();
const passwordHash = await bcrypt.hash(password, 12);
await admins.updateOne(
  { email },
  { $set: { email, passwordHash, name, isActive: true, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
  { upsert: true },
);
console.log(`Admin account configured: ${email}`);
process.exit(0);
