// Shared setup for permission and ownership integration tests.
// Each test file gets an isolated database reset before every test.

const { before, after, beforeEach } = require("node:test");
const { startTestEnvironment } = require("./integration");
const User = require("../../models/User");
const Batch = require("../../models/Batch");
const Enrollment = require("../../models/Enrollment");
const { ROLES } = require("../../constants");
const { resetLoginRateLimits } = require("../../utils/rateLimit");

const PASSWORD = "Password123!";

function configurePermissionTests() {
  let environment;

  before(async () => {
    environment = await startTestEnvironment();
  });
  after(async () => {
    await environment.stop();
  });
  beforeEach(async () => {
    await environment.cleanDatabase();
    resetLoginRateLimits();
  });

  async function createUser(email, role) {
    return User.create({ name: email, email, password: PASSWORD, role, active: true });
  }

  async function createBatch(name, teacherId) {
    return Batch.create({ name, teacher: teacherId, active: true });
  }

  async function loginAs(email) {
    const client = environment.createClient();
    const response = await client.post("/api/auth/login", { email, password: PASSWORD });
    if (response.status !== 200) {
      throw new Error(`Test login failed with status ${response.status}.`);
    }
    return client;
  }

  async function createData() {
    const teacherA = await createUser("teacher.a@example.test", ROLES.TEACHER);
    const teacherB = await createUser("teacher.b@example.test", ROLES.TEACHER);
    const studentA = await createUser("student.a@example.test", ROLES.STUDENT);
    const studentB = await createUser("student.b@example.test", ROLES.STUDENT);
    const batchA = await createBatch("Batch A", teacherA._id);
    const batchB = await createBatch("Batch B", teacherB._id);
    await Enrollment.create({ student: studentA._id, batch: batchA._id });
    await Enrollment.create({ student: studentB._id, batch: batchB._id });
    return { teacherA, teacherB, studentA, studentB, batchA, batchB };
  }

  return { createUser, createBatch, loginAs, createData, PASSWORD };
}

module.exports = { configurePermissionTests };
