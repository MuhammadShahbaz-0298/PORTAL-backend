// Read ZIP directory entries and file bytes.
// Each read is capped by actual bytes consumed from the archive.

const yauzl = require("yauzl");

function openZip(filePath) {
  return new Promise((resolve, reject) => {
    yauzl.open(filePath, { lazyEntries: true, autoClose: false }, (error, zipfile) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(zipfile);
    });
  });
}

function readEntries(zipfile) {
  return new Promise((resolve, reject) => {
    const entries = [];

    zipfile.on("entry", (entry) => {
      entries.push(entry);
      zipfile.readEntry();
    });
    zipfile.on("end", () => resolve(entries));
    zipfile.on("error", reject);
    zipfile.readEntry();
  });
}

function readEntryBytes(zipfile, entry, maxBytes) {
  return new Promise((resolve, reject) => {
    zipfile.openReadStream(entry, (error, stream) => {
      if (error) {
        reject(error);
        return;
      }

      const chunks = [];
      let bytesRead = 0;
      let truncated = false;
      let finished = false;

      const finish = () => {
        if (finished) {
          return;
        }

        finished = true;
        resolve({ buffer: Buffer.concat(chunks), truncated });
      };

      stream.on("data", (chunk) => {
        if (finished) {
          return;
        }

        const remaining = maxBytes - bytesRead;
        if (remaining <= 0) {
          truncated = true;
          stream.destroy();
          finish();
          return;
        }

        if (chunk.length > remaining) {
          chunks.push(chunk.subarray(0, remaining));
          bytesRead += remaining;
          truncated = true;
          stream.destroy();
          finish();
          return;
        }

        chunks.push(chunk);
        bytesRead += chunk.length;
      });

      stream.on("end", finish);
      stream.on("error", (streamError) => {
        if (truncated) {
          finish();
          return;
        }

        if (!finished) {
          finished = true;
          reject(streamError);
        }
      });
    });
  });
}

module.exports = { openZip, readEntries, readEntryBytes };
