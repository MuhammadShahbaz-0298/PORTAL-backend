// Simple in-memory login lockout.
// This is enough for one server. If Railway runs many copies, move this to Redis later.

const attempts = new Map();

function buildKey(prefix, value) {
  return `${prefix}:${String(value || "").toLowerCase()}`;
}

function getEntry(key, now, windowMilliseconds) {
  const existing = attempts.get(key);

  if (!existing) {
    return { count: 0, firstAt: now, lockedUntil: 0 };
  }

  if (existing.lockedUntil > now) {
    return existing;
  }

  if (now - existing.firstAt > windowMilliseconds) {
    return { count: 0, firstAt: now, lockedUntil: 0 };
  }

  return existing;
}

function checkLoginAllowed(ip, email, settings, now = Date.now()) {
  const windowMilliseconds = settings.loginWindowMinutes * 60 * 1000;
  const keys = [buildKey("ip", ip), buildKey("email", email)];
  let retryAfterSeconds = 0;

  for (const key of keys) {
    const entry = getEntry(key, now, windowMilliseconds);
    if (entry.lockedUntil > now) {
      retryAfterSeconds = Math.max(retryAfterSeconds, Math.ceil((entry.lockedUntil - now) / 1000));
    }
  }

  return { allowed: retryAfterSeconds === 0, retryAfterSeconds };
}

function recordLoginFailure(ip, email, settings, now = Date.now()) {
  const windowMilliseconds = settings.loginWindowMinutes * 60 * 1000;
  const keys = [buildKey("ip", ip), buildKey("email", email)];

  for (const key of keys) {
    const entry = getEntry(key, now, windowMilliseconds);
    const nextEntry = {
      count: entry.count + 1,
      firstAt: entry.firstAt,
      lockedUntil: entry.lockedUntil,
    };

    if (nextEntry.count >= settings.loginMaxAttempts) {
      nextEntry.lockedUntil = nextEntry.firstAt + windowMilliseconds;
    }

    attempts.set(key, nextEntry);
  }
}

function clearLoginFailures(ip, email) {
  attempts.delete(buildKey("ip", ip));
  attempts.delete(buildKey("email", email));
}

// Tests use this so one case cannot affect another.
function resetLoginRateLimits() {
  attempts.clear();
}

module.exports = {
  checkLoginAllowed,
  recordLoginFailure,
  clearLoginFailures,
  resetLoginRateLimits,
};
