// Integration tests for assignment resource access and uploads.
// Fixtures use real multipart requests and an isolated in-memory database.

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { configureResourceTests } = require("./helpers/resourceAttachmentTestHelpers");
const { createWorld, loginAs, pdfForm, getEnvironment } = configureResourceTests();
const fs = require("node:fs");
const path = require("node:path");
const Assignment = require("../models/Assignment");
test("unauthenticated resource requests are rejected", async () => {
  const { assignment } = await createWorld();
  const client = getEnvironment().createClient();

  const listResp = await client.get(`/api/assignments/${assignment._id}/resources`);
  assert.equal(listResp.status, 401);

  const uploadResp = await client.upload(`/api/assignments/${assignment._id}/resources`, pdfForm());
  assert.equal(uploadResp.status, 401);
});

test("students cannot upload resources", async () => {
  const { assignment } = await createWorld();
  const client = await loginAs("student@example.test");

  const response = await client.upload(`/api/assignments/${assignment._id}/resources`, pdfForm());

  assert.equal(response.status, 403);
});

test("deleting a resource removes its file from disk", async () => {
  const { assignment } = await createWorld();
  const client = await loginAs("teacher@example.test");
  const uploadResp = await client.upload(`/api/assignments/${assignment._id}/resources`, pdfForm());
  assert.equal(uploadResp.status, 201);

  const beforeDelete = await Assignment.findById(assignment._id).lean();
  const filePath = path.join(
    process.env.ASSIGNMENT_RESOURCE_DIR,
    beforeDelete.resources[0].filePath,
  );
  assert.ok(fs.existsSync(filePath));

  const deleteResp = await client.delete(
    `/api/assignments/${assignment._id}/resources/${uploadResp.data._id}`,
  );
  assert.equal(deleteResp.status, 200);
  assert.ok(!fs.existsSync(filePath));

  const afterDelete = await Assignment.findById(assignment._id).lean();
  assert.equal(afterDelete.resources.length, 0);
});
