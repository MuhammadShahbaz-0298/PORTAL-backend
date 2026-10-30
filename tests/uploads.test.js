// Tests for ZIP magic bytes, ZIP bomb limits and path traversal protection.

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { isZipFile, resolveUploadPath, sanitizeDisplayFileName } = require("../utils/files");
const { assertArchiveIsSafe } = require("../utils/zip");

function buildZip({
  fileName = "file.txt",
  compressedBytes = 100,
  uncompressedBytes = 500,
  entryCount = 1,
}) {
  const nameBuffer = Buffer.from(fileName);
  const centralEntry = Buffer.alloc(46);
  centralEntry.writeUInt32LE(0x02014b50, 0);
  centralEntry.writeUInt32LE(compressedBytes, 20);
  centralEntry.writeUInt32LE(uncompressedBytes, 24);
  centralEntry.writeUInt16LE(nameBuffer.length, 28);

  const centralDirectory = Buffer.concat([centralEntry, nameBuffer]);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(entryCount, 8);
  endOfCentralDirectory.writeUInt16LE(entryCount, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(0, 16);

  return Buffer.concat([centralDirectory, endOfCentralDirectory]);
}

async function withTempFile(buffer, callback) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "portal-zip-test-"));
  const filePath = path.join(directory, "test.zip");
  await fs.writeFile(filePath, buffer);

  try {
    return await callback(filePath);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

test("recognizes a real ZIP signature", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "portal-signature-"));
  const zipPath = path.join(directory, "valid.zip");
  const textPath = path.join(directory, "invalid.zip");
  await fs.writeFile(zipPath, Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]));
  await fs.writeFile(textPath, "not a zip");

  assert.equal(await isZipFile(zipPath), true);
  assert.equal(await isZipFile(textPath), false);
  await fs.rm(directory, { recursive: true, force: true });
});

test("accepts a small normal archive", async () => {
  await withTempFile(buildZip({}), async (filePath) => {
    await assert.doesNotReject(() => assertArchiveIsSafe(filePath));
  });
});

test("rejects an archive that expands too much", async () => {
  const buffer = buildZip({ uncompressedBytes: 600 * 1024 * 1024, compressedBytes: 1024 });
  await withTempFile(buffer, async (filePath) => {
    await assert.rejects(() => assertArchiveIsSafe(filePath), /too large when uncompressed/);
  });
});

test("rejects a high compression ratio", async () => {
  const buffer = buildZip({ compressedBytes: 1, uncompressedBytes: 1000 });
  await withTempFile(buffer, async (filePath) => {
    await assert.rejects(() => assertArchiveIsSafe(filePath), /ZIP bomb/);
  });
});

test("rejects unsafe paths inside the archive", async () => {
  const buffer = buildZip({ fileName: "../../evil.txt" });
  await withTempFile(buffer, async (filePath) => {
    await assert.rejects(() => assertArchiveIsSafe(filePath), /unsafe path/);
  });
});

test("rejects an archive with too many entries", async () => {
  const buffer = buildZip({ entryCount: 5000 });
  await withTempFile(buffer, async (filePath) => {
    await assert.rejects(() => assertArchiveIsSafe(filePath), /at most 1000 files/);
  });
});

test("stored paths cannot escape the upload folder", () => {
  assert.throws(() => resolveUploadPath("../../secret.txt"), /Invalid file path/);
  assert.throws(() => resolveUploadPath("C:\\Windows\\win.ini"), /Invalid file path/);
  assert.equal(sanitizeDisplayFileName("../../evil.zip"), "evil.zip");
});
