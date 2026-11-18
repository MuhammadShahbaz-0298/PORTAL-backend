// Pluggable CAPTCHA check for login. Uses hCaptcha free tier.
// Skippable via env flag CAPTCHA_ENABLED=false for local dev.

const https = require("https");

function isCaptchaEnabled() {
  return String(process.env.CAPTCHA_ENABLED || "false").toLowerCase() === "true";
}

async function verifyCaptcha(token) {
  if (!isCaptchaEnabled()) {
    return true;
  }

  const secret = process.env.HCAPTCHA_SECRET;
  if (!secret) {
    // If enabled but no secret configured, skip (dev safety).
    return true;
  }

  if (!token) {
    return false;
  }

  return new Promise((resolve) => {
    const postData = `response=${encodeURIComponent(token)}&secret=${encodeURIComponent(secret)}`;
    const req = https.request(
      {
        hostname: "hcaptcha.com",
        path: "/siteverify",
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(postData),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.success === true);
          } catch {
            resolve(false);
          }
        });
      },
    );

    req.on("error", () => resolve(false));
    req.write(postData);
    req.end();
  });
}

module.exports = { isCaptchaEnabled, verifyCaptcha };
