const { MongoClient } = require("mongodb");
const { getLocalDb } = require("./dblocal");

let client = null;
let db = null;

async function getDb() {
  if (db) return db;
  // local-only mode: use file storage when MONGODB_URI is not set
  if (!process.env.MONGODB_URI) {
    console.log("local mode: using file storage (.val-local.json)");
    db = await getLocalDb();
    return db;
  }
  const uri = process.env.MONGODB_URI;
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(process.env.MONGO_DB || "val");
  return db;
}

module.exports = { getDb };
