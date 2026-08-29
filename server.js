require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const { sendError, sendSuccess, normalizeError } = require("./utils/http");

const authRoutes = require("./routes/auth");
const batchRoutes = require("./routes/batches");
const submissionRoutes = require("./routes/submissions");
const attendanceRoutes = require("./routes/attendance");
const assignmentRoutes = require("./routes/assignments");
const userRoutes = require("./routes/users");
const permissionRoutes = require("./routes/permissions");
const roleRoutes = require("./routes/roles");

const app = express();

connectDB();

app.use(
  cors({
    origin: process.env.FRONTEND_URL
      ? process.env.FRONTEND_URL.split(",").map((value) => value.trim())
      : true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.get("/health", (req, res) =>
  sendSuccess(res, { service: "school-portal-backend" }),
);

app.use("/api/auth", authRoutes);
app.use("/api/batches", batchRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/users", userRoutes);
app.use("/api/permissions", permissionRoutes);
app.use("/api/roles", roleRoutes);

// Keep error serialization in one place so every route has the same contract.
app.use((err, req, res, next) => {
  const normalizedError =
    err.name === "MulterError"
      ? Object.assign(new Error(err.message), { statusCode: 400 })
      : normalizeError(err);
  if ((normalizedError.statusCode || 500) >= 500) console.error(err);
  return sendError(res, normalizedError);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
