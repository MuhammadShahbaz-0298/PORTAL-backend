// Tests for z ip te xt.t es t.
// Verifies observable behavior without depending on test order.
// Tests for reading source text from a ZIP with hard caps.

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { buildZipBuffer } = require("./helpers/zipBuilder");
const { extractZipText } = require("../utils/zipText");

async function withZip(entries, callback) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "portal-zip-text-"));
  const filePath = path.join(directory, "work.zip");
  await fs.writeFile(filePath, await buildZipBuffer(entries));

  try {
    return await callback(filePath);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

test("zipText prefers root and src files and skips noise", async () => {
  await withZip(
    {
      "README.md": "root readme",
      "src/app.js": "console.log('app');",
      "src/nested/util.js": "export const value = 1;",
      "node_modules/pkg/index.js": "should be skipped",
      ".env": "SECRET=do-not-send",
      ".env.local": "SECRET=do-not-send",
      "package-lock.json": "{}",
      "image.png": Buffer.from([0, 1, 2, 3]),
    },
    async (filePath) => {
      const result = await extractZipText(filePath, { maxTotalChars: 10000 });
      const paths = result.files.map((file) => file.path);

      assert.ok(paths.includes("README.md"));
      assert.ok(paths.includes("src/app.js"));
      assert.ok(paths.includes("src/nested/util.js"));
      assert.ok(!paths.includes("node_modules/pkg/index.js"));
      assert.ok(!paths.includes(".env"));
      assert.ok(!paths.includes(".env.local"));
      assert.ok(!paths.includes("package-lock.json"));
      assert.ok(!paths.includes("image.png"));
      assert.equal(result.files[0].path, "README.md");
    },
  );
});

test("zipText caps file count, file bytes and total characters", async () => {
  await withZip(
    {
      "a.txt": "a".repeat(100),
      "b.txt": "b".repeat(100),
      "c.txt": "c".repeat(100),
      "large.js": "z".repeat(5000),
    },
    async (filePath) => {
      const result = await extractZipText(filePath, {
        maxFiles: 2,
        maxFileBytes: 50,
        maxTotalChars: 80,
      });

      assert.equal(result.files.length, 2);
      assert.ok(result.totalChars <= 80);
      assert.equal(result.truncated, true);
      assert.ok(result.files.every((file) => file.text.length <= 50));
    },
  );
});
