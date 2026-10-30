// Shared test harness.
// It starts a throwaway MongoDB in memory, so tests never touch a real database.

const fs = require("fs");
const os = require("os");
const path = require("path");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "6f1c2a9e4b7d0f3a8c5e2b9d6f4a1c7e3b0d8f5a2c9e6b4d1f7a0c3e8b5d2f9a";
process.env.FRONTEND_URL = "http://localhost:5173";
process.env.ACCESS_TOKEN_MINUTES = "10";
process.env.REFRESH_TOKEN_DAYS = "7";
process.env.IDLE_TIMEOUT_MINUTES = "10";
process.env.SESSION_MAX_HOURS = "24";

class TestClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.cookies = {};
  }

  buildCookieHeader() {
    return Object.entries(this.cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  storeCookies(response) {
    const setCookies = response.headers.getSetCookie();

    for (const cookie of setCookies) {
      const [cookiePair] = cookie.split(";");
      const separatorIndex = cookiePair.indexOf("=");
      const name = cookiePair.slice(0, separatorIndex);
      const value = cookiePair.slice(separatorIndex + 1);
      const isExpired = value === "" || cookie.includes("Expires=Thu, 01 Jan 1970");

      if (isExpired) {
        delete this.cookies[name];
      } else {
        this.cookies[name] = value;
      }
    }
  }

  async request(method, requestPath, options = {}) {
    const { body, csrf = true } = options;
    const headers = {};

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    if (csrf && !["GET", "HEAD"].includes(method)) {
      headers["x-csrf-protection"] = "1";
    }

    headers.cookie = this.buildCookieHeader();

    const response = await fetch(`${this.baseUrl}${requestPath}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    this.storeCookies(response);
    const responseText = await response.text();
    let data = null;

    try {
      data = responseText ? JSON.parse(responseText) : null;
    } catch {
      data = responseText;
    }

    return { status: response.status, data, headers: response.headers };
  }

  get(requestPath) {
    return this.request("GET", requestPath);
  }

  post(requestPath, body, options = {}) {
    return this.request("POST", requestPath, { ...options, body });
  }

  patch(requestPath, body, options = {}) {
    return this.request("PATCH", requestPath, { ...options, body });
  }

  delete(requestPath, options = {}) {
    return this.request("DELETE", requestPath, options);
  }
}

async function startTestEnvironment() {
  const mongoServer = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongoServer.getUri();
  process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "portal-test-uploads-"));

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
