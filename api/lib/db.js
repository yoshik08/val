const { MongoClient } = require("mongodb");

let client = null;
let db = null;

async function getDb() {
  if (db) return db;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI not set");
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(process.env.MONGO_DB || "val");
  return db;
}

module.exports = { getDb };
