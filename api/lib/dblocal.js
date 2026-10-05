// local file-based storage for local-only mode (no mongodb needed)
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "..", ".val-local.json");

function read() {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch (e) {
    return {};
  }
}

function write(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

// minimal mongo-like collection interface for the "auth" collection
function localCollection() {
  return {
    async findOne(q) {
      const d = read();
      return d[q._id] || null;
    },
    async updateOne(q, update, opts) {
      const d = read();
      const id = q._id;
      if (!d[id] && opts && opts.upsert) d[id] = { _id: id };
      if (!d[id]) return;
      if (update.$set) Object.assign(d[id], update.$set);
      write(d);
    },
    async deleteOne(q) {
      const d = read();
      delete d[q._id];
      write(d);
    },
  };
}

async function getLocalDb() {
  return { collection: () => localCollection() };
}

module.exports = { getLocalDb };
