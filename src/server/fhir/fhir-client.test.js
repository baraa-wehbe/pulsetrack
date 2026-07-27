import assert from "node:assert/strict";
import test from "node:test";

import {
  createFhirClient,
  FhirClientError,
  parseOperationOutcome,
} from "./client.js";

const jsonResponse = (body, init = {}) =>
  new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/fhir+json", ...init.headers },
  });

const options = (fetchImpl, overrides = {}) => ({
  apiKey: "test-api-key-not-a-secret",
  baseUrl: "https://fhir.example.test/r4/",
  fetchImpl,
  timeoutMs: 100,
  ...overrides,
});

test("GET, POST, and PUT send server API-key and FHIR JSON headers", async () => {
  const requests = [];
  const client = createFhirClient(
    options(async (url, init) => {
      requests.push({ url: url.toString(), init });
      return jsonResponse({ resourceType: "Patient", id: "p1" });
    }),
  );
  const patient = { resourceType: "Patient", active: true };

  await client.get("Patient/p1");
  await client.post("Patient", patient);
  await client.put("Patient/p1", patient);

  assert.deepEqual(
    requests.map(({ init }) => init.method),
    ["GET", "POST", "PUT"],
  );
  for (const { init } of requests) {
    assert.equal(init.headers.Accept, "application/fhir+json");
    assert.equal(init.headers["Content-Type"], "application/fhir+json");
    assert.equal(init.headers["x-api-key"], "test-api-key-not-a-secret");
  }
  assert.equal(requests[0].init.body, undefined);
  assert.equal(requests[1].init.body, JSON.stringify(patient));
});

test("conditional create sends only a validated If-None-Exist header", async () => {
  const requests = [];
  const client = createFhirClient({
    apiKey: "server-secret",
    baseUrl: "https://fhir.example.test/r4/",
    fetchImpl: async (_url, options) => {
      requests.push(options);
      return jsonResponse({ resourceType: "Patient", id: "patient-1" }, 201);
    },
  });

  await client.post(
    "Patient",
    { resourceType: "Patient" },
    {
      ifNoneExist: "identifier=https%3A%2F%2Fcandidate.example%2Fmrn%7CPT-100",
    },
  );

  assert.equal(
    requests[0].headers["If-None-Exist"],
    "identifier=https%3A%2F%2Fcandidate.example%2Fmrn%7CPT-100",
  );
  assert.throws(
    () =>
      client.post(
        "Patient",
        { resourceType: "Patient" },
        {
          ifNoneExist: "identifier=safe\r\nx-api-key: leaked",
        },
      ),
    (error) =>
      error instanceof FhirClientError &&
      error.code === "INVALID_CONDITIONAL_CREATE",
  );
});

test("timeout aborts safely without exposing request data", async () => {
  const client = createFhirClient(
    options(
      (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => {
            const error = new Error("provider payload must stay private");
            error.name = "AbortError";
            reject(error);
          });
        }),
    ),
  );

  await assert.rejects(
    client.get("Patient"),
    (error) =>
      error instanceof FhirClientError &&
      error.code === "TIMEOUT" &&
      !error.message.includes("provider payload"),
  );
});

test("Bundle pagination follows same-origin next links and preserves entry order", async () => {
  const urls = [];
  const client = createFhirClient(
    options(async (url) => {
      urls.push(url.toString());
      return urls.length === 1
        ? jsonResponse({
            resourceType: "Bundle",
            entry: [{ fullUrl: "one" }],
            link: [
              {
                relation: "next",
                url: "https://fhir.example.test/r4/Patient?page=2",
              },
            ],
          })
        : jsonResponse({
            resourceType: "Bundle",
            entry: [{ fullUrl: "two" }],
          });
    }),
  );

  const entries = await client.getBundle("Patient?page=1");

  assert.deepEqual(entries, [{ fullUrl: "one" }, { fullUrl: "two" }]);
  assert.deepEqual(urls, [
    "https://fhir.example.test/r4/Patient?page=1",
    "https://fhir.example.test/r4/Patient?page=2",
  ]);
});

test("an empty Bundle may omit the optional entry property", async () => {
  const client = createFhirClient(
    options(async () =>
      jsonResponse({
        resourceType: "Bundle",
        type: "searchset",
        total: 0,
      }),
    ),
  );

  assert.deepEqual(await client.getBundle("Patient?identifier=missing"), []);
});

test("Bundle pagination rejects cross-origin next links before requesting them", async () => {
  let requests = 0;
  const client = createFhirClient(
    options(async () => {
      requests += 1;
      return jsonResponse({
        resourceType: "Bundle",
        entry: [],
        link: [{ relation: "next", url: "https://attacker.test/Patient" }],
      });
    }),
  );

  await assert.rejects(
    client.getBundle("Patient"),
    (error) =>
      error instanceof FhirClientError && error.code === "UNTRUSTED_URL",
  );
  assert.equal(requests, 1);
});

test("Bundle pagination safely rebases proxy-origin links within the configured FHIR path", async () => {
  const urls = [];
  const client = createFhirClient(
    options(async (url) => {
      urls.push(url.toString());
      return urls.length === 1
        ? jsonResponse({
            resourceType: "Bundle",
            entry: [{ fullUrl: "one" }],
            link: [
              {
                relation: "next",
                url: "http://internal-fhir:8080/r4/Patient?page=2",
              },
            ],
          })
        : jsonResponse({
            resourceType: "Bundle",
            entry: [{ fullUrl: "two" }],
          });
    }),
  );

  const entries = await client.getBundle("Patient?page=1");

  assert.deepEqual(entries, [{ fullUrl: "one" }, { fullUrl: "two" }]);
  assert.deepEqual(urls, [
    "https://fhir.example.test/r4/Patient?page=1",
    "https://fhir.example.test/r4/Patient?page=2",
  ]);
});

test("429 retries are bounded and honor a capped Retry-After", async () => {
  let requests = 0;
  const delays = [];
  const client = createFhirClient(
    options(
      async () => {
        requests += 1;
        return requests < 3
          ? jsonResponse(
              { resourceType: "OperationOutcome", issue: [] },
              { status: 429, headers: { "Retry-After": "2" } },
            )
          : jsonResponse({ resourceType: "Patient", id: "p1" });
      },
      {
        max429Retries: 2,
        maxRetryDelayMs: 1_500,
        sleep: async (delay) => delays.push(delay),
      },
    ),
  );

  assert.equal((await client.get("Patient/p1")).id, "p1");
  assert.equal(requests, 3);
  assert.deepEqual(delays, [1_500, 1_500]);

  const limited = createFhirClient(
    options(
      async () =>
        jsonResponse(
          { resourceType: "OperationOutcome", issue: [] },
          { status: 429 },
        ),
      { max429Retries: 1, sleep: async () => {} },
    ),
  );
  await assert.rejects(
    limited.get("Patient"),
    (error) =>
      error instanceof FhirClientError &&
      error.code === "RATE_LIMITED" &&
      error.status === 429,
  );
});

test("OperationOutcome parsing returns controlled diagnostics only", async () => {
  const unsafe =
    "Patient jane@example.test token abcdefghijklmnopqrstuvwxyz lab value 999";
  const outcome = {
    resourceType: "OperationOutcome",
    issue: [
      {
        severity: "error",
        code: "invalid",
        diagnostics: unsafe,
        expression: ["Patient.name"],
      },
    ],
  };
  const parsed = parseOperationOutcome(outcome);
  assert.deepEqual(parsed, [
    {
      severity: "error",
      code: "invalid",
      diagnostic: "The FHIR provider rejected invalid data.",
    },
  ]);
  assert.equal(JSON.stringify(parsed).includes(unsafe), false);

  const client = createFhirClient(
    options(async () => jsonResponse(outcome, { status: 400 })),
  );
  await assert.rejects(client.post("Patient", { secret: unsafe }), (error) => {
    assert.equal(error.code, "OPERATION_OUTCOME");
    assert.equal(error.status, 400);
    assert.equal(JSON.stringify(error).includes(unsafe), false);
    return true;
  });
});

test("non-FHIR provider failures remain generic", async () => {
  const client = createFhirClient(
    options(
      async () =>
        new Response("database details and complete PHI", { status: 502 }),
    ),
  );

  await assert.rejects(client.get("Patient"), (error) => {
    assert.equal(error.code, "HTTP_ERROR");
    assert.equal(error.status, 502);
    assert.equal(error.message.includes("database details"), false);
    return true;
  });
});
