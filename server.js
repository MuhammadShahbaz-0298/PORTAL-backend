// Starts the school portal API.
// The environment is checked first so the server never runs with unsafe settings.

require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("./config/db");
const { loadEnvironment } = require("./config/env");

let environment;
try {
  environment = loadEnvironment(process.env);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

// The app is required after the environment check, because it reads FRONTEND_URL.
const app = require("./app");
let server;

async function startServer() {
  await connectDB(environment.mongoUri);
  server = app.listen(environment.port, () => {
    console.info(`Server running on port ${environment.port}`);
  });
}

async function shutdown(signal) {
  console.info(`Received ${signal}. Shutting down.`);

  if (!server) {
    process.exit(0);
  }

  server.close(async () => {
    await mongoose.disconnect();
    process.exit(0);
  });

  // Do not hang forever if a connection refuses to close.
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

startServer();
