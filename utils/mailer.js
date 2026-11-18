// Sends email through SMTP. All settings come from environment variables;
// nothing about the provider, host, port or sender address is hardcoded.

const nodemailer = require("nodemailer");

let transporter = null;

function buildTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;

  if (!host || !user || !pass || !from) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  return transporter;
}

function getTransporter() {
  if (!transporter) {
    return buildTransporter();
  }
  return transporter;
}

async function sendMail({ to, subject, text, html }) {
  const transport = getTransporter();

  if (!transport) {
    const error = new Error(
      "Email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM.",
    );
    error.code = "EMAIL_NOT_CONFIGURED";
    throw error;
  }

  const from = process.env.SMTP_FROM;

  const info = await transport.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });

  return info;
}

module.exports = { sendMail, getTransporter, buildTransporter };
