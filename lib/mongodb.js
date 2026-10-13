import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "fisgaranti";
if (!uri) throw new Error("MONGODB_URI is not configured");

let clientPromise = globalThis.__fisgarantiMongoClient;
if (!clientPromise) {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000, maxPoolSize: 5 });
  clientPromise = client.connect();
  globalThis.__fisgarantiMongoClient = clientPromise;
}

export async function getDb() {
  return (await clientPromise).db(dbName);
}

export async function getUsers() {
  const db = await getDb();
  const users = db.collection("users");
  await users.createIndex({ appleSub: 1 }, { unique: true });
  await users.createIndex({ lastLoginAt: -1 });
  return users;
}

export async function getAdmins() {
  const admins = (await getDb()).collection("admins");
  await admins.createIndex({ email: 1 }, { unique: true });
  return admins;
}

export async function getReceipts() {
  const receipts = (await getDb()).collection("receipts");
  await receipts.createIndex({ userId: 1, createdAt: -1 });
  await receipts.createIndex({ createdAt: -1 });
  return receipts;
}

export async function getAuthChallenges() {
  const challenges = (await getDb()).collection("authChallenges");
  await challenges.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  return challenges;
}
