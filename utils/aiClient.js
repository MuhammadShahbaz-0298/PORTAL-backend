// The smallest possible OpenAI-compatible chat client.
// No SDK, no logging of the API key, and no logging of student code.

const { readAiSettings } = require("../config/env");
const { AI_REQUEST_TIMEOUT_MS } = require("../constants");

class AiRequestError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "AiRequestError";
    this.statusCode = options.statusCode || 0;
    this.retryAfterSeconds = options.retryAfterSeconds || 0;
    this.isRateLimited = options.statusCode === 429;
  }
}

// retry-after is usually a number of seconds, but HTTP allows a date too.
function parseRetryAfter(headerValue) {
  if (!headerValue) {
    return 60;
  }

  const seconds = Number(headerValue);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds);
  }

  const retryDate = new Date(headerValue);
  if (Number.isNaN(retryDate.getTime())) {
    return 60;
  }

  return Math.max(0, Math.ceil((retryDate.getTime() - Date.now()) / 1000));
}

function buildRequestBody(settings, system, prompt) {
  const body = {
    model: settings.model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    temperature: 0.3,
    max_tokens: 2000,
  };

  if (settings.model.startsWith("openai/gpt-oss")) {
    body.reasoning_effort = "low";
  }

  return body;
}

function assertProviderOk(response) {
  if (response.status === 429) {
    const retryAfterSeconds = parseRetryAfter(response.headers.get("retry-after"));
    throw new AiRequestError(
      `AI provider is rate limited. Try again in about ${retryAfterSeconds} seconds.`,
      { statusCode: 429, retryAfterSeconds },
    );
  }

  if (!response.ok) {
    throw new AiRequestError(`AI provider returned HTTP ${response.status}.`, {
      statusCode: response.status,
    });
  }
}

async function readReplyText(response) {
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (typeof content !== "string" || !content.trim()) {
    throw new AiRequestError("AI returned no text.");
  }

  return content;
}

async function askAI({ system, prompt }) {
  const settings = readAiSettings();

  if (!settings.enabled) {
    throw new AiRequestError("AI drafts are disabled.", { statusCode: 503 });
  }

  const body = buildRequestBody(settings, system, prompt);

  try {
    const response = await fetch(`${settings.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
    });

    assertProviderOk(response);
    return await readReplyText(response);
  } catch (error) {
    if (error.name === "AbortError" || error.name === "TimeoutError") {
      throw new AiRequestError("AI provider took too long to answer.", { statusCode: 504 });
    }

    throw error;
  }
}

module.exports = { askAI };
