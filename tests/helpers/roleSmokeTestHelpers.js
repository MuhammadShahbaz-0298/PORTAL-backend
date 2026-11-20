// Shared core-role fixtures for permission smoke tests.
// The world includes batches, resources, announcements and calendar events.

const assert = require("node:assert/strict");
const { before, after, beforeEach } = require("node:test");
const { startTestEnvironment } = require("./integration");
const { ensureCoreRoles } = require("../../services/roleService");
const { resetLoginRateLimits } = require("../../utils/rateLimit");
const User = require("../../models/User");
const Batch = require("../../models/Batch");
const Enrollment = require("../../models/Enrollment");
const Assignment = require("../../models/Assignment");
const Announcement = require("../../models/Announcement");
const Event = require("../../models/Event");
const { ROLES } = require("../../constants");

const PASSWORD = "Password123!";
const PDF_BYTES = Buffer.from(
  "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n",
  "binary",
);

function configureRoleSmokeTests() {
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
    await ensureCoreRoles();
  });

  async function createUser(email, role) {
    return User.create({ name: email, email, password: PASSWORD, role, active: true });
  }

  async function loginAs(email) {
    const client = environment.createClient();
    const response = await client.post("/api/auth/login", { email, password: PASSWORD });
    assert.equal(response.status, 200);
    return client;
  }

  async function createWorld() {
    const admin = await createUser("admin@example.test", ROLES.ADMIN);
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

    await Announcement.create({
      title: "School notice",
      body: "A school-wide notice.",
      scope: "school",
      createdBy: admin._id,
    });
    await Event.create({
      title: "School event",
      description: "A school-wide event.",
      date: new Date(Date.now() + 86400000),
      batch: null,
      createdBy: admin._id,
    });

    const clients = {
      admin: await loginAs("admin@example.test"),
      teacher: await loginAs("teacher@example.test"),
      student: await loginAs("student@example.test"),
    };
    const form = new FormData();
    form.append("resource", new Blob([PDF_BYTES], { type: "application/pdf" }), "notes.pdf");
    const upload = await clients.teacher.upload(
      `/api/assignments/${assignment._id}/resources`,
      form,
    );
    assert.equal(upload.status, 201);
    return { admin, teacher, student, batch, assignment, clients, resourceId: upload.data._id };
  }

  return { createWorld };
}

module.exports = { configureRoleSmokeTests };
