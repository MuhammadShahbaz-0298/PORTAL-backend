const fs = require('fs/promises');

const ZIP_SIGNATURES = [
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  Buffer.from([0x50, 0x4b, 0x05, 0x06]),
  Buffer.from([0x50, 0x4b, 0x07, 0x08]),
];

const isZipFile = async (filePath) => {
  const handle = await fs.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(4);
    await handle.read(buffer, 0, 4, 0);
    return ZIP_SIGNATURES.some((signature) => buffer.equals(signature));
  } finally {
    await handle.close();
  }
};

const removeFile = async (filePath) => {
  if (!filePath) return;
  await fs.unlink(filePath).catch(() => undefined);
};

module.exports = { isZipFile, removeFile };
