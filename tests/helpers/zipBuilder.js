// Builds real ZIP files for upload and text-extraction tests.
// yazl is a dev dependency used only by tests.

const yazl = require("yazl");

function buildZipBuffer(entries) {
  return new Promise((resolve, reject) => {
    const zip = new yazl.ZipFile();
    const chunks = [];

    for (const [name, content] of Object.entries(entries)) {
      zip.addBuffer(Buffer.isBuffer(content) ? content : Buffer.from(String(content)), name);
    }

    zip.outputStream.on("data", (chunk) => chunks.push(chunk));
    zip.outputStream.on("end", () => resolve(Buffer.concat(chunks)));
    zip.outputStream.on("error", reject);
    zip.end();
  });
}

function buildZipForm(entries, fileName = "work.zip") {
  const form = new FormData();
  const buffer = buildZipBuffer(entries);

  return buffer.then((zipBuffer) => {
    form.append("file", new Blob([zipBuffer], { type: "application/zip" }), fileName);
    return form;
  });
}

module.exports = { buildZipBuffer, buildZipForm };
