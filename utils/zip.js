// ZIP bomb protection without a new library.
// We read the ZIP central directory and sum the declared uncompressed sizes.

const fs = require("fs/promises");
const { AppError } = require("./errors");
const {
  GLOBAL_UPLOAD_MAX_BYTES,
  ZIP_MAX_COMPRESSION_RATIO,
  ZIP_MAX_ENTRIES,
  ZIP_MAX_UNCOMPRESSED_BYTES,
} = require("../constants");

const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIZE = 22;
const MAX_COMMENT_SIZE = 65535;

function findEndOfCentralDirectory(buffer) {
  const lastPossibleStart = Math.max(
    0,
    buffer.length - END_OF_CENTRAL_DIRECTORY_SIZE - MAX_COMMENT_SIZE,
  );

  for (
    let position = buffer.length - END_OF_CENTRAL_DIRECTORY_SIZE;
    position >= lastPossibleStart;
    position -= 1
  ) {
    if (buffer.readUInt32LE(position) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
      return position;
    }
  }

  return -1;
}

function looksLikePathTraversal(fileName) {
  const hasParentFolder = fileName.includes("../") || fileName.includes("..\\");
  const hasAbsolutePath = fileName.startsWith("/") || fileName.startsWith("\\");
  const hasWindowsDrive = /^[a-zA-Z]:[\\/]/.test(fileName);
  return hasParentFolder || hasAbsolutePath || hasWindowsDrive;
}

function readCentralDirectory(buffer, startPosition, entryCount) {
  let position = startPosition;
  let totalCompressedBytes = 0;
  let totalUncompressedBytes = 0;

  for (let index = 0; index < entryCount; index += 1) {
    if (position + 46 > buffer.length) {
      throw new AppError("The ZIP archive is malformed.", 400);
    }

    if (buffer.readUInt32LE(position) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new AppError("The ZIP archive is malformed.", 400);
    }

    const compressedBytes = buffer.readUInt32LE(position + 20);
    const uncompressedBytes = buffer.readUInt32LE(position + 24);
    const fileNameLength = buffer.readUInt16LE(position + 28);
    const extraLength = buffer.readUInt16LE(position + 30);
    const commentLength = buffer.readUInt16LE(position + 32);

    // ZIP64 stores real sizes elsewhere. We reject it rather than guess.
    if (compressedBytes === 0xffffffff || uncompressedBytes === 0xffffffff) {
      throw new AppError("ZIP64 archives are not supported.", 400);
    }

    const fileNameStart = position + 46;
    const fileNameEnd = fileNameStart + fileNameLength;
    if (fileNameEnd > buffer.length) {
      throw new AppError("The ZIP archive is malformed.", 400);
    }

    const fileName = buffer.subarray(fileNameStart, fileNameEnd).toString("utf8");
    if (looksLikePathTraversal(fileName)) {
      throw new AppError("The ZIP archive contains an unsafe path.", 400);
    }

    totalCompressedBytes += compressedBytes;
    totalUncompressedBytes += uncompressedBytes;
    position = fileNameEnd + extraLength + commentLength;
  }

  return { totalCompressedBytes, totalUncompressedBytes };
}

async function assertArchiveIsSafe(filePath) {
  const stats = await fs.stat(filePath);

  if (stats.size > GLOBAL_UPLOAD_MAX_BYTES) {
    throw new AppError("The uploaded file is too large.", 400);
  }

  const handle = await fs.open(filePath, "r");

  try {
    const tailSize = END_OF_CENTRAL_DIRECTORY_SIZE + MAX_COMMENT_SIZE;
    const tailLength = Math.min(stats.size, tailSize);
    const tailBuffer = Buffer.alloc(tailLength);
    await handle.read(tailBuffer, 0, tailLength, stats.size - tailLength);

    const endPosition = findEndOfCentralDirectory(tailBuffer);
    if (endPosition === -1) {
      throw new AppError("The uploaded file is not a valid ZIP archive.", 400);
    }

    const entryCount = tailBuffer.readUInt16LE(endPosition + 10);
    const centralDirectorySize = tailBuffer.readUInt32LE(endPosition + 12);
    const centralDirectoryOffset = tailBuffer.readUInt32LE(endPosition + 16);

    if (entryCount > ZIP_MAX_ENTRIES) {
      throw new AppError(`A ZIP may contain at most ${ZIP_MAX_ENTRIES} files.`, 400);
    }

    const centralBuffer = Buffer.alloc(centralDirectorySize);
    await handle.read(centralBuffer, 0, centralDirectorySize, centralDirectoryOffset);

    const totals = readCentralDirectory(centralBuffer, 0, entryCount);

    if (totals.totalUncompressedBytes > ZIP_MAX_UNCOMPRESSED_BYTES) {
      throw new AppError("The ZIP archive is too large when uncompressed.", 400);
    }

    if (
      totals.totalCompressedBytes > 0 &&
      totals.totalUncompressedBytes / totals.totalCompressedBytes > ZIP_MAX_COMPRESSION_RATIO
    ) {
      throw new AppError("The ZIP archive looks like a ZIP bomb.", 400);
    }
  } finally {
    await handle.close();
  }
}

module.exports = { assertArchiveIsSafe };
