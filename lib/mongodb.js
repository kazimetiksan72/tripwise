import { MongoClient } from "mongodb";

const dbName = process.env.MONGODB_DB || "fisgaranti";

export async function getDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw Object.assign(new Error("MONGODB_URI is not configured"), { status: 503 });
  let clientPromise = globalThis.__fisgarantiMongoClient;
  if (!clientPromise) {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000, maxPoolSize: 5 });
    clientPromise = client.connect().catch((error) => {
      globalThis.__fisgarantiMongoClient = undefined;
      throw error;
    });
    globalThis.__fisgarantiMongoClient = clientPromise;
  }
  try {
    return (await clientPromise).db(dbName);
  } catch (error) {
    if (error.status) throw error;
    throw Object.assign(new Error("MongoDB bağlantısı kurulamadı"), { status: 503 });
  }
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
