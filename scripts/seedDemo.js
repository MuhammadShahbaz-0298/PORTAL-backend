// Creates clearly fake demo data for local development.
// Usage: node scripts/seedDemo.js --apply
// On a production database also pass --i-have-a-backup.

require("dotenv").config();

const mongoose = require("mongoose");
const User = require("../models/User");
const Batch = require("../models/Batch");
const Enrollment = require("../models/Enrollment");
const Assignment = require("../models/Assignment");
const Attendance = require("../models/Attendance");
const roleService = require("../services/roleService");
const { ROLES } = require("../constants");
const { assertPassword } = require("../utils/validation");
const { parseScriptArguments } = require("./cleanHelpers");

const DEMO_PASSWORD_ENV = "SEED_DEMO_PASSWORD";

async function findOrCreateUser({ name, email, role, password }) {
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return existingUser;
  }

  return User.create({ name, email, password, role, active: true });
}

async function findOrCreateBatch({ name, teacherId }) {
  return Batch.findOneAndUpdate(
    { name, teacher: teacherId },
    { $setOnInsert: { name, teacher: teacherId, active: true } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function findOrCreateEnrollment({ studentId, batchId }) {
  return Enrollment.findOneAndUpdate(
    { student: studentId, batch: batchId },
    { $setOnInsert: { student: studentId, batch: batchId } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function main() {
  const options = parseScriptArguments();

  if (!options.apply) {
    throw new Error("Demo data is not written in dry run. Add --apply to continue.");
  }

  if (process.env.NODE_ENV === "production" && !options.hasBackup) {
    throw new Error("Refusing production writes. Add --i-have-a-backup after taking a backup.");
  }

  const password = process.env[DEMO_PASSWORD_ENV];
  if (!password) {
    throw new Error(`Set ${DEMO_PASSWORD_ENV} before running this script.`);
  }

  assertPassword(password, DEMO_PASSWORD_ENV);
  await mongoose.connect(process.env.MONGO_URI);
  await roleService.ensureCoreRoles();

  const admin = await findOrCreateUser({
    name: "Demo Admin",
    email: "demo.admin@example.test",
    role: ROLES.ADMIN,
    password,
  });
  const teacherA = await findOrCreateUser({
    name: "Demo Teacher A",
    email: "demo.teacher.a@example.test",
    role: ROLES.TEACHER,
    password,
  });
  const teacherB = await findOrCreateUser({
    name: "Demo Teacher B",
    email: "demo.teacher.b@example.test",
    role: ROLES.TEACHER,
    password,
  });
  const studentOne = await findOrCreateUser({
    name: "Demo Student One",
    email: "demo.student.one@example.test",
    role: ROLES.STUDENT,
    password,
  });
  const studentTwo = await findOrCreateUser({
    name: "Demo Student Two",
    email: "demo.student.two@example.test",
    role: ROLES.STUDENT,
    password,
  });

  const batchA = await findOrCreateBatch({ name: "Demo Batch A", teacherId: teacherA._id });
  const batchB = await findOrCreateBatch({ name: "Demo Batch B", teacherId: teacherB._id });

  await findOrCreateEnrollment({ studentId: studentOne._id, batchId: batchA._id });
  await findOrCreateEnrollment({ studentId: studentTwo._id, batchId: batchA._id });
  await findOrCreateEnrollment({ studentId: studentTwo._id, batchId: batchB._id });

  const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await Assignment.findOneAndUpdate(
    { batch: batchA._id, title: "Demo Assignment A" },
    {
      $setOnInsert: {
        batch: batchA._id,
        title: "Demo Assignment A",
        description: "Fake homework for local testing.",
        dueDate,
        allowedFileTypes: ["zip"],
        maxFileSizeMb: 25,
        resubmissionPolicy: "allowed",
        createdBy: teacherA._id,
        active: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const today = new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()),
  );
  await Attendance.findOneAndUpdate(
    { student: studentOne._id, batch: batchA._id, date: today },
    {
      $setOnInsert: {
        student: studentOne._id,
        batch: batchA._id,
        batchName: batchA.name,
        date: today,
        status: "present",
        enteredBy: teacherA._id,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  console.info("Demo data ready.");
  console.info(`Admin: ${admin.email}`);
  console.info(`Teachers: ${teacherA.email}, ${teacherB.email}`);
  console.info(`Students: ${studentOne.email}, ${studentTwo.email}`);
  console.info("All demo accounts use the password from SEED_DEMO_PASSWORD.");

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect();
  process.exit(1);
});
