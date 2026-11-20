// Starts the school portal API.
// The environment is checked first so the server never runs with unsafe settings.

require("dotenv").config();

const mongoose = require("mongoose");
const cron = require("node-cron");
const connectDB = require("./config/db");
const { loadEnvironment } = require("./config/env");

let environment;
try {
  environment = loadEnvironment(process.env);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

// One clear line tells the operator why no AI drafts will appear.
if (!environment.ai.enabled) {
  console.info("AI drafts are off");
}

// The app is required after the environment check, because it reads FRONTEND_URL.
const app = require("./app");
const aiDraftService = require("./services/aiDraftService");
const { runDetection: runAtRiskDetection } = require("./scripts/atRiskDetection");
const { syncCoreRoles } = require("./services/roleService");
let server;
let atRiskTask;

async function startServer() {
  await connectDB(environment.mongoUri);
  await syncCoreRoles();
  server = app.listen(environment.port, () => {
    console.info(`Server running on port ${environment.port}`);
  });

  // Pick up drafts that were waiting when the server restarted.
  if (environment.ai.enabled) {
    aiDraftService.resumePendingDrafts().catch(() => {
      console.error("AI draft recovery failed.");
    });
  }

  if (environment.atRisk?.enabled) {
    atRiskTask = cron.schedule(environment.atRisk.schedule, () => {
      runAtRiskDetection(environment.atRisk).catch((error) => {
        console.error("At-risk detection failed:", error.message);
      });
    });

    runAtRiskDetection(environment.atRisk).catch((error) => {
      console.error("At-risk detection failed:", error.message);
    });
  }
}

async function shutdown(signal) {
  console.info(`Received ${signal}. Shutting down.`);

  if (!server) {
    process.exit(0);
  }

  if (atRiskTask) {
    atRiskTask.stop();
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
