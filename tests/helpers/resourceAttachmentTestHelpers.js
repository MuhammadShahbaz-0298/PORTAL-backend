// Shared fixtures for assignment resource integration tests.
// The storage limit is set before application modules are loaded.

process.env.MAX_ASSIGNMENT_RESOURCE_MB = "1";

const assert = require("node:assert/strict");
const { before, after, beforeEach } = require("node:test");
const { startTestEnvironment } = require("./integration");
const { resetLoginRateLimits } = require("../../utils/rateLimit");
const User = require("../../models/User");
const Batch = require("../../models/Batch");
const Enrollment = require("../../models/Enrollment");
const Assignment = require("../../models/Assignment");
const { ROLES } = require("../../constants");

const PASSWORD = "Password123!";
const PDF_BYTES = Buffer.from(
  "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n",
  "binary",
);

function configureResourceTests() {
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

  async function createUser(email, role, permissions = []) {
    return User.create({
      name: email,
      email,
      password: PASSWORD,
      role,
      active: true,
      permissions,
    });
  }

  async function loginAs(email) {
    const client = environment.createClient();
    const response = await client.post("/api/auth/login", { email, password: PASSWORD });
    assert.equal(response.status, 200);
    return client;
  }

  function pdfForm(bytes = PDF_BYTES, filename = "lesson-notes.pdf") {
    const form = new FormData();
    form.append("resource", new Blob([bytes], { type: "application/pdf" }), filename);
    return form;
  }

  async function createWorld() {
    const teacher = await createUser("teacher@example.test", ROLES.TEACHER);
    const student = await createUser("student@example.test", ROLES.STUDENT);
    const batch = await Batch.create({ name: "Batch A", teacher: teacher._id, active: true });
    await Enrollment.create({ student: student._id, batch: batch._id });
    const assignment = await Assignment.create({
      batch: batch._id,
      title: "Week 1",
      dueDate: new Date(Date.now() + 86400000),
      createdBy: teacher._id,
    });
    return { teacher, student, batch, assignment };
  }

  return {
    createUser,
    loginAs,
    pdfForm,
    createWorld,
    PDF_BYTES,
    getEnvironment: () => environment,
  };
}

module.exports = { configureResourceTests };
