// Virus scanning via ClamAV (self-hosted). Fail closed if scanner is unreachable.
// Host/port configurable via env vars.

const NodeClam = require("clamscan");

let scanner = null;

async function getScanner() {
  if (scanner) {
    return scanner;
  }

  try {
    const clamscan = await new NodeClam().init({
      clamdscan: {
        host: process.env.CLAMAV_HOST || "127.0.0.1",
        port: Number(process.env.CLAMAV_PORT) || 3310,
        timeout: 60000,
      },
      preference: "clamdscan",
    });
    scanner = clamscan;
    return scanner;
  } catch {
    return null;
  }
}

async function scanFile(filePath) {
  // If ClamAV is not configured, skip the scan (dev/test safety).
  if (!process.env.CLAMAV_HOST && !process.env.CLAMAV_PORT) {
    return { clean: true, skipped: true };
  }

  const clam = await getScanner();

  if (!clam) {
    // Fail closed: reject the file if scanner is unreachable.
    const error = new Error("Virus scanner is unreachable.");
    error.code = "SCANNER_UNREACHABLE";
    throw error;
  }

  const { isInfected, viruses } = await clam.isInfected(filePath);

  if (isInfected) {
    const error = new Error(`File rejected: ${viruses.join(", ")}`);
    error.code = "VIRUS_DETECTED";
    throw error;
  }

  return { clean: true };
}

module.exports = { scanFile, getScanner };
