import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Playground, {
  JobDetails,
  JobTable,
  FeatureResult,
} from "../src/components/playground";
import {
  jobSearch,
  resumeMatch,
  safeLink,
  friendlyError,
  pay,
  type SearchValues,
} from "../src/lib/features";
import { sampleFor } from "../src/lib/samples";
import { operations } from "../src/lib/catalog";
import { object } from "../src/lib/features";
import { validateRequest } from "../src/lib/validation";

test("live playground shows mapped fields and a disabled form when the key is missing", () => {
  const html = renderToStaticMarkup(
    <Playground configured={false} ownerMode={false} />,
  );
  for (const label of [
    "職位搜尋",
    "公司資料",
    "市場趨勢",
    "薪酬參考",
    "招聘歷程",
  ])
    assert.ok(html.includes(label));
  assert.equal((html.match(/aria-controls="panel-/g) || []).length, 5);
  assert.equal((html.match(/<form/g) || []).length, 1);
  assert.ok(html.includes("HIREBASE_API_KEY"));
  assert.ok(html.includes("<fieldset disabled"));
  assert.ok(!html.includes('type="radio"'));
  for (const field of [
    "國家／地區",
    "城市",
    "工作模式",
    "排序方式",
    "每頁顯示",
    "更多篩選",
    "POST /v2/jobs/search",
    "Search Jobs",
    "geo_locations[].country",
    "香港（Hong Kong）",
    "遙距工作（Remote）",
    "sort_by / sort_order",
    "date_posted / desc",
  ])
    assert.ok(html.includes(field));
  for (const hidden of [
    "<table",
    "已收藏",
    "履歷配對",
    "招聘團隊",
    "資深後端工程師",
    "固定虛構",
    "示範資料",
    "JSON",
    "API key",
    "endpoint",
    "operationId",
    "x-api-key",
  ])
    assert.ok(!html.includes(hidden), hidden);
  const live = renderToStaticMarkup(
    <Playground configured={true} ownerMode={false} />,
  );
  assert.ok(live.includes("即時資料"));
  assert.ok(!live.includes("示範資料"));
  assert.ok(!live.includes("固定虛構"));
  assert.ok(!live.includes("<fieldset disabled"));
});
test("each feature renders its fixture as plain text or tables", () => {
  const mapping = {
    jobs: "search",
    companies: "companies",
    market: "insights",
    salary: "task",
    history: "historical",
  } as const;
  for (const [feature, operation] of Object.entries(mapping)) {
    const op = operations.find((item) => item.id === operation)!;
    const data = object(sampleFor(op, { task_id: "salary-demo", limit: 5 }));
    const html = renderToStaticMarkup(
      <FeatureResult feature={feature as keyof typeof mapping} data={data} />,
    );
    assert.ok(html.includes("<table"), feature);
    assert.ok(!html.includes("undefined"), feature);
  }
});
test("user search choices produce valid text, semantic and posting-link requests", () => {
  const v: SearchValues = {
    query: "Software Engineer",
    country: "Hong Kong",
    work: "Remote",
    level: "Senior",
    employment: "Full Time",
    recent: "30",
    kind: "title",
  };
  for (const kind of ["title", "idea", "link"] as const) {
    const req = jobSearch(
      {
        ...v,
        kind,
        query: kind === "link" ? "https://example.com/job" : v.query,
      },
      2,
    );
    assert.doesNotThrow(() => validateRequest(req.operationId, req.input));
    if (kind === "idea")
      assert.equal((req.input.lexical as Record<string, unknown>).page, 2);
  }
  const blank = jobSearch({
    ...v,
    query: " ",
    country: "",
    work: "",
    level: "",
    employment: "",
    recent: "",
  });
  assert.deepEqual(blank.input, { page: 1, limit: 5 });
});
test("job details include additional response fields and render descriptions safely", () => {
  const job = {
    _id: "private-id",
    job_title: "Engineer",
    company_name: "Example",
    description: "<script>alert(1)</script><p>Build useful tools</p>",
    locations: [{ city: "Hong Kong", coordinates: [0, 22.3] }],
    additional_fields: { remote: false, salary: null, tags: [] },
    provider_note: "<img src=x onerror=alert(2)>",
  };
  const table = renderToStaticMarkup(<JobTable rows={[job]} />);
  assert.match(
    table,
    /<button[^>]+aria-expanded="false"[^>]*>Engineer<\/button>/,
  );
  assert.ok(!table.includes("Build useful tools"));

  const details = renderToStaticMarkup(<JobDetails job={job} />);
  for (const field of [
    "Build useful tools",
    "private-id",
    "coordinates",
    "22.3",
    "additional_fields",
    "false",
    "null",
    "[]",
  ])
    assert.ok(details.includes(field), field);
  assert.ok(details.includes("&lt;img"));
  for (const unsafe of ["<script>", "alert(1)", "<img"])
    assert.ok(!details.includes(unsafe), unsafe);
});
test("original posting links exclude executable and malformed URLs", () => {
  for (const url of ["javascript:alert(1)", "data:text/html,test", "not-a-url"])
    assert.equal(safeLink(url), undefined);
  assert.equal(
    safeLink("https://example.com/careers"),
    "https://example.com/careers",
  );
});
test("missing salary and service errors stay in plain language", () => {
  assert.equal(pay({}), "未列明薪酬");
  assert.equal(
    pay({ min: 50000, max: 70000, currency: "HKD", period: "monthly" }),
    "HKD 50,000 – 70,000 / 月",
  );
  assert.match(
    friendlyError(429, { "x-billing-code": "limit_exceeded" }),
    /額度/,
  );
  for (const status of [400, 401, 402, 403, 404, 429, 500, 503])
    assert.doesNotMatch(
      friendlyError(status),
      /API|JSON|HTTP|schema|endpoint|payload/,
    );
});

test("resume matching uses the stored artifact accepted by neural search", () => {
  const request = resumeMatch("6a3c15d537f33c238c70a14e");
  assert.doesNotThrow(() => validateRequest("neural", request));
  assert.equal(request.vector.artifact_id, "6a3c15d537f33c238c70a14e");
  assert.equal(request.lexical.limit, 5);
});
