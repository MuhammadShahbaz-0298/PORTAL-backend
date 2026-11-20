// Integration tests for assignment resource access and uploads.
// Fixtures use real multipart requests and an isolated in-memory database.

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { configureResourceTests } = require("./helpers/resourceAttachmentTestHelpers");
const { createWorld, loginAs, pdfForm, PDF_BYTES } = configureResourceTests();
const Assignment = require("../models/Assignment");
test("filePath and the stored filename never appear in upload, list, or download responses", async () => {
  const { assignment } = await createWorld();
  const client = await loginAs("teacher@example.test");

  const uploadResp = await client.upload(
    `/api/assignments/${assignment._id}/resources`,
    pdfForm(PDF_BYTES, "Original Lesson Notes.pdf"),
  );
  assert.equal(uploadResp.status, 201);
  assert.deepEqual(Object.keys(uploadResp.data).sort(), ["_id", "fileName", "uploadedAt"]);
  assert.equal(uploadResp.data.fileName, "Original Lesson Notes.pdf");

  const stored = await Assignment.findById(assignment._id).lean();
  const storedName = stored.resources[0].filePath;
  assert.ok(storedName.endsWith(".pdf"));
  assert.notEqual(storedName, uploadResp.data.fileName);

  const listResp = await client.get(`/api/assignments/${assignment._id}/resources`);
  assert.equal(listResp.status, 200);
  assert.equal(listResp.data.length, 1);
  assert.deepEqual(Object.keys(listResp.data[0]).sort(), ["_id", "fileName", "uploadedAt"]);

  const uploadText = JSON.stringify(uploadResp.data);
  const listText = JSON.stringify(listResp.data);
  assert.ok(!uploadText.includes(storedName), "Upload response leaked the stored filename.");
  assert.ok(!listText.includes(storedName), "List response leaked the stored filename.");
  assert.ok(!uploadText.includes("filePath"), "Upload response leaked filePath.");
  assert.ok(!listText.includes("filePath"), "List response leaked filePath.");

  const downloadResp = await client.download(
    `/api/assignments/${assignment._id}/resources/${uploadResp.data._id}/download`,
  );
  assert.equal(downloadResp.status, 200);
  const disposition = downloadResp.headers.get("content-disposition") || "";
  assert.ok(disposition.includes("Original Lesson Notes.pdf"));
  assert.ok(!disposition.includes(storedName), "Download response leaked the stored filename.");
  assert.deepEqual(downloadResp.body, PDF_BYTES);
});
