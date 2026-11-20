// Lightweight HTTP client for integration tests.
// It handles cookies, JSON requests and byte-preserving multipart downloads.

class TestClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.cookies = {};
  }

  buildCookieHeader() {
    return Object.entries(this.cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  storeCookies(response) {
    const setCookies = response.headers.getSetCookie();
    for (const cookie of setCookies) {
      const [cookiePair] = cookie.split(";");
      const separatorIndex = cookiePair.indexOf("=");
      const name = cookiePair.slice(0, separatorIndex);
      const value = cookiePair.slice(separatorIndex + 1);
      const isExpired = value === "" || cookie.includes("Expires=Thu, 01 Jan 1970");
      if (isExpired) {
        delete this.cookies[name];
      } else {
        this.cookies[name] = value;
      }
    }
  }

  async request(method, requestPath, options = {}) {
    const { body, csrf = true, headers: extraHeaders = {} } = options;
    const headers = { ...extraHeaders };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    if (csrf && !["GET", "HEAD"].includes(method)) {
      headers["x-csrf-protection"] = "1";
    }
    headers.cookie = this.buildCookieHeader();

    const response = await fetch(`${this.baseUrl}${requestPath}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    this.storeCookies(response);
    const responseText = await response.text();
    let data = null;
    try {
      data = responseText ? JSON.parse(responseText) : null;
    } catch {
      data = responseText;
    }
    return { status: response.status, data, headers: response.headers };
  }

  get(requestPath) {
    return this.request("GET", requestPath);
  }

  async download(requestPath) {
    const response = await fetch(`${this.baseUrl}${requestPath}`, {
      method: "GET",
      headers: { cookie: this.buildCookieHeader() },
    });
    this.storeCookies(response);
    const body = Buffer.from(await response.arrayBuffer());
    return { status: response.status, body, headers: response.headers };
  }

  post(requestPath, body, options = {}) {
    return this.request("POST", requestPath, { ...options, body });
  }

  patch(requestPath, body, options = {}) {
    return this.request("PATCH", requestPath, { ...options, body });
  }

  delete(requestPath, options = {}) {
    return this.request("DELETE", requestPath, options);
  }

  async upload(requestPath, formData, method = "POST") {
    const headers = {
      "x-csrf-protection": "1",
      cookie: this.buildCookieHeader(),
    };
    const response = await fetch(`${this.baseUrl}${requestPath}`, {
      method,
      headers,
      body: formData,
    });
    this.storeCookies(response);
    const responseText = await response.text();
    let data = null;
    try {
      data = responseText ? JSON.parse(responseText) : null;
    } catch {
      data = responseText;
    }
    return { status: response.status, data, headers: response.headers };
  }
}

module.exports = { TestClient };
