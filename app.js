// Builds the Express app. No database connection and no listen here,
// so tests can import the app without starting a real server.

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { AppError } = require("./utils/errors");
const { sendError, sendSuccess, normalizeError } = require("./utils/http");
const { CSRF_HEADER_NAME } = require("./constants");
const validateBodyShape = require("./middleware/validateBody");
const csrfProtection = require("./middleware/csrf");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const batchRoutes = require("./routes/batches");
const assignmentRoutes = require("./routes/assignments");
const attendanceRoutes = require("./routes/attendance");
const submissionRoutes = require("./routes/submissions");
const permissionRoutes = require("./routes/permissions");
const roleRoutes = require("./routes/roles");

const app = express();

app.disable("x-powered-by");
// Railway sits in front of the app, so Express must trust one proxy hop.
app.set("trust proxy", 1);

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", CSRF_HEADER_NAME],
    // Why: list pages read the total from this header in the browser.
    exposedHeaders: ["X-Total-Count"],
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(validateBodyShape);
app.use(csrfProtection);

app.get("/health", (request, response) => {
  return sendSuccess(response, { status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/batches", batchRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/api/permissions", permissionRoutes);
app.use("/api/roles", roleRoutes);

app.use((request, response, next) => {
  return next(new AppError("Route not found.", 404));
});

// One error handler. Users get a short message; the full error stays in server logs.
app.use((error, request, response, _next) => {
  let normalizedError = error;

  if (error.name === "MulterError") {
    normalizedError = new AppError(error.message, 400);
  }

  normalizedError = normalizeError(normalizedError);

  if ((normalizedError.statusCode || 500) >= 500) {
    console.error(error);
  }

  return sendError(response, normalizedError);
});

module.exports = app;
