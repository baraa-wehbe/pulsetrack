import "server-only";

const FHIR_JSON = "application/fhir+json";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_MAX_RETRY_DELAY_MS = 30_000;
const DEFAULT_MAX_PAGES = 100;
const SAFE_SEVERITIES = new Set(["fatal", "error", "warning", "information"]);
const SAFE_ISSUE_CODES = new Set([
  "invalid",
  "structure",
  "required",
  "value",
  "invariant",
  "security",
  "login",
  "unknown",
  "expired",
  "forbidden",
  "suppressed",
  "processing",
  "not-supported",
  "duplicate",
  "not-found",
  "too-long",
  "code-invalid",
  "extension",
  "too-costly",
  "business-rule",
  "conflict",
  "transient",
  "lock-error",
  "no-store",
  "exception",
  "timeout",
  "incomplete",
  "throttled",
  "informational",
]);

const safeIssueDiagnostic = (code) =>
  ({
    invalid: "The FHIR provider rejected invalid data.",
    required: "The FHIR provider reported missing required data.",
    forbidden: "The FHIR provider denied this operation.",
    "not-found": "The requested FHIR resource was not found.",
    conflict: "The FHIR provider reported a resource conflict.",
    throttled: "The FHIR provider rate limit was reached.",
    timeout: "The FHIR provider timed out.",
  })[code] ?? "The FHIR provider reported an operation error.";

export const parseOperationOutcome = (payload) => {
  if (
    !payload ||
    payload.resourceType !== "OperationOutcome" ||
    !Array.isArray(payload.issue)
  ) {
    return null;
  }

  return payload.issue.slice(0, 10).map((issue) => {
    const severity = SAFE_SEVERITIES.has(issue?.severity)
      ? issue.severity
      : "error";
    const code = SAFE_ISSUE_CODES.has(issue?.code) ? issue.code : "processing";

    return {
      severity,
      code,
      diagnostic: safeIssueDiagnostic(code),
    };
  });
};

export class FhirClientError extends Error {
  constructor(code, { status = null, issues = [] } = {}) {
    super(`FHIR request failed (${code}).`);
    this.name = "FhirClientError";
    this.code = code;
    this.status = status;
    this.issues = issues;
  }
}

const retryAfterMilliseconds = (value, now, maximum) => {
  if (!value) return 0;

  const seconds = Number(value);
  const requested = Number.isFinite(seconds)
    ? Math.max(0, seconds * 1000)
    : Math.max(0, Date.parse(value) - now());

  return Math.min(Number.isFinite(requested) ? requested : 0, maximum);
};

const defaultSleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const normalizeBaseUrl = (value) => {
  const url = new URL(value);
  url.hash = "";
  url.search = "";
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url;
};

export const createFhirClient = ({
  apiKey,
  baseUrl,
  fetchImpl = globalThis.fetch,
  max429Retries = DEFAULT_MAX_RETRIES,
  maxRetryDelayMs = DEFAULT_MAX_RETRY_DELAY_MS,
  now = () => Date.now(),
  sleep = defaultSleep,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) => {
  if (
    typeof apiKey !== "string" ||
    apiKey.length === 0 ||
    typeof baseUrl !== "string" ||
    typeof fetchImpl !== "function" ||
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 100 ||
    !Number.isInteger(max429Retries) ||
    max429Retries < 0 ||
    max429Retries > 5 ||
    !Number.isInteger(maxRetryDelayMs) ||
    maxRetryDelayMs < 0 ||
    maxRetryDelayMs > 120_000
  ) {
    throw new FhirClientError("INVALID_CONFIGURATION");
  }

  let base;
  try {
    base = normalizeBaseUrl(baseUrl);
  } catch {
    throw new FhirClientError("INVALID_CONFIGURATION");
  }

  const resolveUrl = (value) => {
    let candidate;
    try {
      candidate = /^https?:\/\//i.test(value)
        ? new URL(value)
        : new URL(String(value).replace(/^\/+/, ""), base);
    } catch {
      throw new FhirClientError("INVALID_URL");
    }

    if (candidate.origin !== base.origin) {
      throw new FhirClientError("UNTRUSTED_URL");
    }
    return candidate;
  };

  const request = async (method, path, body) => {
    const url = resolveUrl(path);

    for (let attempt = 0; attempt <= max429Retries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      let response;

      try {
        response = await fetchImpl(url, {
          method,
          headers: {
            Accept: FHIR_JSON,
            "Content-Type": FHIR_JSON,
            "x-api-key": apiKey,
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (error) {
        if (controller.signal.aborted || error?.name === "AbortError") {
          throw new FhirClientError("TIMEOUT");
        }
        throw new FhirClientError("NETWORK_ERROR");
      } finally {
        clearTimeout(timeout);
      }

      if (response.status === 429 && attempt < max429Retries) {
        await sleep(
          retryAfterMilliseconds(
            response.headers.get("retry-after"),
            now,
            maxRetryDelayMs,
          ),
        );
        continue;
      }

      let payload = null;
      try {
        payload = await response.json();
      } catch {
        if (!response.ok) {
          throw new FhirClientError(
            response.status === 429 ? "RATE_LIMITED" : "HTTP_ERROR",
            { status: response.status },
          );
        }
        throw new FhirClientError("INVALID_FHIR_JSON", {
          status: response.status,
        });
      }

      if (!response.ok) {
        const issues = parseOperationOutcome(payload);
        throw new FhirClientError(
          response.status === 429
            ? "RATE_LIMITED"
            : issues
              ? "OPERATION_OUTCOME"
              : "HTTP_ERROR",
          { status: response.status, issues: issues ?? [] },
        );
      }

      return payload;
    }

    throw new FhirClientError("RATE_LIMITED", { status: 429 });
  };

  const get = (path) => request("GET", path);
  const post = (path, resource) => request("POST", path, resource);
  const put = (path, resource) => request("PUT", path, resource);

  const getBundle = async (path, { maxPages = DEFAULT_MAX_PAGES } = {}) => {
    if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 500) {
      throw new FhirClientError("INVALID_PAGE_LIMIT");
    }

    const entries = [];
    let next = resolveUrl(path);

    for (let page = 0; next; page += 1) {
      if (page >= maxPages) {
        throw new FhirClientError("PAGINATION_LIMIT");
      }
      const bundle = await get(next.toString());
      if (bundle?.resourceType !== "Bundle" || !Array.isArray(bundle.entry)) {
        throw new FhirClientError("INVALID_BUNDLE");
      }
      entries.push(...bundle.entry);

      const nextLink = Array.isArray(bundle.link)
        ? bundle.link.find((link) => link?.relation === "next")?.url
        : null;
      next = nextLink ? resolveUrl(nextLink) : null;
    }

    return entries;
  };

  return Object.freeze({ get, post, put, getBundle });
};
