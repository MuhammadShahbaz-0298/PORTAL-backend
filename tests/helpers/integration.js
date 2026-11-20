// Shared test harness backed by a temporary in-memory MongoDB.
// Each environment owns its server, database and upload directory.

const fs = require("fs");
const os = require("os");
const path = require("path");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { TestClient } = require("./testClient");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "6f1c2a9e4b7d0f3a8c5e2b9d6f4a1c7e3b0d8f5a2c9e6b4d1f7a0c3e8b5d2f9a";
process.env.FRONTEND_URL = "http://localhost:5173";
process.env.ACCESS_TOKEN_MINUTES = "10";
process.env.REFRESH_TOKEN_DAYS = "7";
process.env.IDLE_TIMEOUT_MINUTES = "10";
process.env.SESSION_MAX_HOURS = "24";

async function startTestEnvironment() {
  const mongoServer = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongoServer.getUri();
  process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "portal-test-uploads-"));
  process.env.ASSIGNMENT_RESOURCE_DIR = path.join(process.env.UPLOAD_DIR, "assignment-resources");

  await mongoose.connect(process.env.MONGO_URI);
  const app = require("../../app");
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    mongoose,
    baseUrl,
    createClient: () => new TestClient(baseUrl),
    async cleanDatabase() {
      const collections = Object.values(mongoose.connection.collections);
      await Promise.all(collections.map((collection) => collection.deleteMany({})));
    },
    async stop() {
      await new Promise((resolve) => server.close(resolve));
      await mongoose.disconnect();
      await mongoServer.stop();
      fs.rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true });
    },
  };
}

module.exports = { startTestEnvironment };
