import { test } from "node:test";
import assert from "node:assert/strict";
import { operations, families } from "../src/lib/catalog";
import { validateRequest, upstreamRequest } from "../src/lib/validation";
import { execute, localRequestAllowed, readLimited } from "../src/lib/server";
import { errorMessage, redact, uniqueJobs } from "../src/lib/response";

test("every documented family has operations and every preset validates", () => {
  assert.equal(new Set(operations.map((o) => o.id)).size, operations.length);
  for (const family of [
    "Job discovery",
    "Exports & archive",
    "Companies",
    "Insights",
    "Reference data",
    "Resumes",
    "Hiring Manager",
    "Tasks & usage",
    "Technologies · coming soon",
    "Webhooks",
  ])
    assert.ok(families.includes(family));
  for (const op of operations) {
    const input = structuredClone(op.preset);
    if ("since" in input)
      input.since = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    assert.doesNotThrow(() => validateRequest(op.id, input), op.id);
    assert.ok(op.docs.startsWith("https://www.hirebase.org/docs/"));
  }
});
test("search rejects unknown fields, bad booleans, invalid enums, nested typos and unbounded limits", () => {
  for (const data of [
    { locations: [] },
    { job_type: ["Full Time"] },
    { technology_slugs: ["python"] },
    { limit: 101 },
    { limit: 0 },
    { limit: 1.5 },
    { visa: true },
    { experience: ["Expert"] },
    { geo_locations: [{ county: "HK" }] },
    { salary: { min: 10, max: 1 } },
    { date_posted: "2026-02-30" },
  ])
    assert.throws(() => validateRequest("search", data));
  assert.equal(validateRequest("search", {}).input.limit, 5);
  assert.doesNotThrow(() =>
    validateRequest("search", {
      visa: "true",
      industry: "Finance",
      company_slug: "stripe",
    }),
  );
  assert.doesNotThrow(() => validateRequest("estimate", { limit: 0 }));
});
test("neural has separate nested filters, relative dates, vector dimension and pagination", () => {
  assert.throws(() => validateRequest("neural", {}));
  assert.throws(() =>
    validateRequest("neural", {
      vector: { query: "engineer" },
      lexical: { job_type: ["Contract"] },
    }),
  );
  assert.throws(() =>
    validateRequest("neural", { lexical: { date_posted: "2026-11-01" } }),
  );
  assert.throws(() =>
    validateRequest("neural", { vector: { vectors: [[1, 2]] } }),
  );
  assert.throws(() =>
    validateRequest("neural", { vector: { score_threshold: 0.5 } }),
  );
  const r = validateRequest("neural", {
    vector: { query: "engineer" },
    lexical: { date_posted: "last_week", job_types: ["Contract"] },
  });
  assert.deepEqual(r.input.lexical, {
    page: 1,
    limit: 5,
    date_posted: "last_week",
    job_types: ["Contract"],
  });
});
test("historical, expired, URLs, salary and notifications have meaningful guards", () => {
  assert.throws(() => validateRequest("historical", { sample_size: 5 }));
  assert.throws(() => validateRequest("historical", { job_titles: [] }));
  assert.throws(() =>
    validateRequest("historical", {
      job_titles: ["Engineer"],
      salary: { min: 100 },
    }),
  );
  assert.throws(() => validateRequest("expired", { since: "2020-01-01" }));
  assert.throws(() => validateRequest("lookup", { urls: [] }));
  assert.throws(() =>
    validateRequest("lookup", { urls: ["javascript:alert(1)"] }),
  );
  assert.throws(() =>
    validateRequest("lookup", {
      urls: ["https://example.com/" + "a".repeat(2048)],
    }),
  );
  assert.throws(() => validateRequest("daily", { from: "2026-11-01" }));
  assert.throws(() => validateRequest("tasks", { skip: 1.5 }));
  assert.throws(() => validateRequest("salary", {}));
  assert.throws(() =>
    validateRequest("salary", { job_title: "Engineer", notify: true }),
  );
  assert.throws(() =>
    validateRequest("daily", { from: "2026-01-01", to: "2026-11-01" }),
  );
});
test("fixed path interpolation separates path and query without arbitrary proxying", () => {
  const r = validateRequest("company-jobs", {
    company_slug: "stripe",
    page: 2,
    limit: 5,
  });
  assert.equal(
    upstreamRequest(r.operation, r.input).path,
    "/v2/hirebase/companies/stripe/jobs?page=2&limit=5",
  );
  assert.throws(() =>
    validateRequest("company", { company_slug: "../../billing" }),
  );
  assert.throws(() => validateRequest("https://evil.test", {}));
  assert.equal(
    upstreamRequest(operations.find((o) => o.id === "tasks")!, {
      limit: 5,
      skip: 5,
    }).path,
    "/v2/tasks/?limit=5&skip=5",
  );
});
test("live requests require same origin and loopback hostname", () => {
  assert.equal(
    localRequestAllowed(
      new Request("http://127.0.0.1:3100/api/hirebase", {
        headers: {
          origin: "http://127.0.0.1:3100",
          "sec-fetch-site": "same-origin",
        },
      }),
    ),
    true,
  );
  for (const [target, origin] of [
    ["http://127.0.0.1:3100/api/hirebase", "https://evil.test"],
    ["https://public.test/api/hirebase", "https://public.test"],
  ])
    assert.equal(
      localRequestAllowed(new Request(target, { headers: { origin } })),
      false,
    );
  assert.equal(
    localRequestAllowed(new Request("http://127.0.0.1:3100/api/hirebase")),
    false,
  );
  assert.equal(
    localRequestAllowed(
      new Request("http://localhost:3100/api/hirebase", {
        headers: { host: "127.0.0.1:3100", origin: "http://127.0.0.1:3100" },
      }),
    ),
    true,
  );
  assert.equal(
    localRequestAllowed(
      new Request("http://localhost:3100/api/hirebase", {
        headers: { host: "evil.test", origin: "http://evil.test" },
      }),
    ),
    false,
  );
});
test("missing key, sample-only, unavailable and owner operations never contact upstream", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls++;
    throw new Error("must not fetch");
  };
  assert.equal(
    (
      await execute(
        { operationId: "search", mode: "live", input: {} },
        { fetcher },
      )
    ).status,
    503,
  );
  for (const op of operations.filter(
    (o) =>
      o.access === "sample" ||
      o.access === "owner" ||
      o.access === "unavailable",
  )) {
    const input = structuredClone(op.preset);
    if ("since" in input)
      input.since = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const r = await execute(
      { operationId: op.id, mode: "live", input },
      { apiKey: "test-secret", fetcher },
    );
    assert.ok([403, 501].includes(r.status), `${op.id}: ${r.status}`);
  }
  assert.equal(calls, 0);
});
test("every sample runs without API calls and has explicit provenance", async () => {
  for (const op of operations) {
    const input = structuredClone(op.preset);
    if ("since" in input)
      input.since = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const r = await execute(
      { operationId: op.id, mode: "sample", input },
      {
        fetcher: async () => {
          throw new Error("must not call");
        },
      },
    );
    assert.equal(r.status, 200, op.id);
    assert.equal(r.source, "sample");
    assert.deepEqual(r.headers, {});
  }
});
test("live transport attaches key only upstream, rejects redirects, and forwards bounded body", async () => {
  const fetcher: typeof fetch = async (url, init) => {
    assert.equal(url, "https://api.hirebase.org/v2/jobs/search");
    assert.equal(new Headers(init?.headers).get("x-api-key"), "test-secret");
    assert.equal(init?.redirect, "error");
    assert.equal(init?.cache, "no-store");
    assert.deepEqual(JSON.parse(String(init?.body)), {
      job_titles: ["Engineer"],
      page: 1,
      limit: 5,
    });
    return new Response(
      JSON.stringify({
        jobs: [
          {
            job_title: "Engineer",
            contact_email: "private@example.test",
            unexpected_field: { value: 42 },
          },
        ],
        echo: "test-secret",
      }),
      {
        headers: {
          "Hirebase-Usage-Included-Remaining": "495",
          "set-cookie": "private=secret",
          "x-api-key": "test-secret",
        },
      },
    );
  };
  const r = await execute(
    {
      operationId: "search",
      mode: "live",
      input: { job_titles: ["Engineer"] },
    },
    { apiKey: "test-secret", fetcher },
  );
  assert.equal(r.source, "live");
  assert.equal(r.status, 200);
  assert.equal(r.headers["hirebase-usage-included-remaining"], "495");
  assert.equal(r.headers["set-cookie"], undefined);
  assert.ok(!JSON.stringify(r).includes("test-secret"));
  assert.ok(JSON.stringify(r).includes("unexpected_field"));
  assert.equal(r.redactions.length, 2);
});
test("quota and rate-limit 429, authentication, plan and non-JSON failures stay distinct", async () => {
  for (const [status, headers, match] of [
    [429, { "X-Billing-Code": "limit_exceeded" }, /quota exhausted/i],
    [429, { "Retry-After": "15" }, /Wait 15 seconds/],
    [401, {}, /Authentication/],
    [403, {}, /add-on/],
    [402, {}, /payment/],
    [422, {}, /Request rejected/],
  ] as const) {
    const r = await execute(
      { operationId: "search", mode: "live", input: {} },
      {
        apiKey: "test-api-key",
        fetcher: async () =>
          new Response(JSON.stringify({ detail: "failure" }), {
            status,
            headers,
          }),
      },
    );
    assert.equal(r.status, status);
    assert.match(r.error!, match);
  }
  const r = await execute(
    { operationId: "search", mode: "live", input: {} },
    {
      apiKey: "secret",
      fetcher: async () =>
        new Response("<h1>secret upstream error</h1>", { status: 502 }),
    },
  );
  assert.ok(!JSON.stringify(r).includes("secret"));
  assert.match(r.error!, /provider/);
  assert.match(
    errorMessage(429, {
      "x-billing-code": "limit_exceeded",
      "retry-after": "10",
    })!,
    /Do not retry/,
  );
});
test("network exceptions do not leak provider or environment secrets", async () => {
  const r = await execute(
    { operationId: "search", mode: "live", input: {} },
    {
      apiKey: "secret",
      fetcher: async () => {
        throw new Error("secret");
      },
    },
  );
  assert.equal(r.status, 502);
  assert.ok(!JSON.stringify(r).includes("secret"));
});
test("reflected credentials are removed from headers, error summaries and property names", async () => {
  const r = await execute(
    { operationId: "search", mode: "live", input: {} },
    {
      apiKey: "test-secret",
      fetcher: async () =>
        Response.json(
          { "test-secret": "echo" },
          { status: 429, headers: { "Retry-After": "test-secret" } },
        ),
    },
  );
  assert.ok(!JSON.stringify(r).includes("test-secret"));
});
test("sample task links preserve the original operation type", async () => {
  for (const [task_id, type] of [
    ["example-export-task", "export_job_data"],
    ["example-expired-task", "export_expired_jobs"],
    ["example-contact-task", "contacts_extraction"],
  ]) {
    const r = await execute(
      { operationId: "task", mode: "sample", input: { task_id } },
      {},
    );
    assert.equal((r.data as Record<string, unknown>).type, type);
  }
});
test("resume validation, MIME and multipart transport", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async (url, init) => {
    calls++;
    assert.equal(url, "https://api.hirebase.org/v2/resumes/upload/");
    assert.ok(init?.body instanceof FormData);
    assert.equal(new Headers(init.headers).get("content-type"), null);
    return Response.json({
      _id: "6a3c15d537f33c238c70a14e",
      status: "uploaded",
    });
  };
  const payload = { operationId: "resume-upload", mode: "live", input: {} };
  const ctx = { apiKey: "x", ownerMode: true, fetcher };
  assert.equal(
    (
      await execute(
        payload,
        ctx,
        new File(["x"], "r.bin", { type: "application/octet-stream" }),
      )
    ).status,
    422,
  );
  assert.equal(
    (
      await execute(
        payload,
        ctx,
        new File([new Uint8Array(5 * 1024 * 1024 + 1)], "r.txt", {
          type: "text/plain",
        }),
      )
    ).status,
    422,
  );
  assert.equal(
    (
      await execute(
        payload,
        ctx,
        new File(["Synthetic resume"], "r.txt", { type: "text/plain" }),
      )
    ).status,
    200,
  );
  assert.equal(calls, 1);
});
test("response redaction, unknown fields and overlapping company pages", () => {
  const safe = redact(
    {
      result: {
        download_url: "https://private.test",
        email: "private@example.test",
        unknown: "preserved",
      },
      nested: ["api-secret"],
    },
    "api-secret",
  );
  assert.equal(safe.redactions.length, 3);
  assert.ok(JSON.stringify(safe.data).includes("preserved"));
  assert.deepEqual(
    uniqueJobs([{ _id: "1" }, { _id: "2" }, { _id: "2" }, { _id: "3" }], ["1"]),
    [{ _id: "2" }, { _id: "3" }],
  );
});
test("bounded response reader stops oversized data", async () => {
  await assert.rejects(() => readLimited(new Response("123456"), 5));
  assert.equal(await readLimited(new Response("123"), 5), "123");
});

test("the playground HTTP route rejects fixture requests", async () => {
  const { POST } = await import("../src/app/api/hirebase/route");
  const response = await POST(
    new Request("http://localhost:3100/api/hirebase", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3100",
      },
      body: JSON.stringify({
        operationId: "search",
        input: {},
        mode: "sample",
      }),
    }),
  );
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /live requests only/);
});
