import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  defaultFilters,
  featureRequest,
  filterError,
  geography,
  pageRequest,
  pagination,
} from "../src/lib/search";
import { validateRequest } from "../src/lib/validation";
import { object } from "../src/lib/features";
import { SearchFilters } from "../src/components/search-filters";
import { FeaturePanel } from "../src/components/playground";

const full = {
  ...defaultFilters("jobs"),
  country: "United States",
  city: "Seattle",
  region: "Washington",
  work: "Hybrid",
  level: "Senior",
  employment: "Full Time",
  recent: "30",
  company: "Example",
  keywords: "Python，SQL",
  size: "51-200",
  industry: "Tech, Software & IT Services",
  salaryMin: "80000",
  salaryMax: "150000",
  currency: "USD",
  yearsMin: "2",
  yearsMax: "8",
  hideAgencies: true,
  visa: true,
  geoMode: "weak",
  radius: "25",
  sort: "salary:desc",
  limit: "10",
  until: "2026-11-11",
};

test("all feature filters produce valid requests and preserve typed values", () => {
  for (const feature of [
    "jobs",
    "companies",
    "market",
    "salary",
    "history",
    "resume",
  ] as const) {
    const f = feature === "companies" ? { ...full, sort: "size:desc" } : full;
    const request = featureRequest(
      feature,
      "Software Engineer",
      f,
      "title",
      "6a3c15d537f33c238c70a14e",
    );
    assert.doesNotThrow(
      () => validateRequest(request.operationId, request.input),
      feature,
    );
    const input =
      feature === "resume" ? object(request.input.lexical) : request.input;
    assert.deepEqual(
      input[feature === "companies" ? "hq_geolocations" : "geo_locations"],
      [{ country: "United States", city: "Seattle", region: "Washington" }],
    );
  }
  const job = featureRequest("jobs", "Engineer", full).input;
  assert.deepEqual(job.salary, { min: 80000, max: 150000 });
  assert.equal(job.include_no_salary, "false");
  assert.equal(job.hide_recruiting_agencies, "true");
  assert.equal(job.visa, "true");
  assert.deepEqual(job.keywords, ["Python", "SQL"]);
  assert.deepEqual(job.geofilter_params, {
    mode: "weak",
    radius: 25,
    unit: "km",
  });
});
test("semantic and URL searches exclude unsupported or irrelevant controls", () => {
  const neural = featureRequest("jobs", "Python engineer", full, "idea");
  assert.doesNotThrow(() => validateRequest(neural.operationId, neural.input));
  const lexical = object(neural.input.lexical);
  assert.equal(lexical.geofilter_params, undefined);
  assert.equal(lexical.hide_recruiting_agencies, undefined);
  assert.equal(lexical.sort_by, "salary");
  assert.deepEqual(
    featureRequest("jobs", "https://example.com/job", full, "link"),
    { operationId: "lookup", input: { urls: ["https://example.com/job"] } },
  );
  assert.equal(filterError("jobs", { ...full, salaryMax: "1" }, "link"), "");
});
test("company, salary and history mapping respects their different contracts", () => {
  const company = featureRequest("companies", "software", {
    ...full,
    sort: "size:asc",
  }).input;
  assert.equal(company.hide_recruiter_agencies, true);
  assert.equal(company.hide_recruiting_agencies, undefined);
  assert.equal(company.salary, undefined);
  assert.deepEqual(company.industries, [full.industry]);
  const salary = featureRequest("salary", "Engineer", full).input;
  assert.deepEqual(salary.experience_levels, ["Senior"]);
  assert.deepEqual(salary.yoe_range, { min: 2, max: 8 });
  assert.equal(salary.notify, false);
  for (const key of ["job_types", "sort_by", "salary", "limit", "keywords"])
    assert.equal(salary[key], undefined);
  const history = featureRequest("history", "Engineer", full).input;
  assert.deepEqual(history.company_names, ["Example"]);
  assert.equal(history.date_posted_to, full.until);
  for (const key of [
    "sort_by",
    "salary",
    "experience",
    "job_types",
    "industry",
    "days_ago",
  ])
    assert.equal(history[key], undefined);
  const market = featureRequest("market", "Engineer", full).input;
  assert.equal(market.sort_by, undefined);
  assert.equal(market.limit, undefined);
});
test("empty, custom and partial locations do not invent geography", () => {
  assert.equal(geography(defaultFilters("jobs")), undefined);
  assert.deepEqual(
    geography({
      ...full,
      country: "other",
      customCountry: " Germany ",
      city: " Berlin ",
      region: "",
    }),
    [{ country: "Germany", city: "Berlin" }],
  );
  assert.deepEqual(geography({ ...defaultFilters("jobs"), city: "London" }), [
    { city: "London" },
  ]);
  const request = featureRequest("jobs", "", {
    ...defaultFilters("jobs"),
    geoMode: "strict",
  });
  assert.equal(request.input.geo_locations, undefined);
  assert.equal(request.input.geofilter_params, undefined);
});
test("range and date mistakes have plain-language validation", () => {
  assert.match(filterError("jobs", { ...full, salaryMax: "1" }), /最低薪酬/);
  assert.match(filterError("salary", { ...full, yearsMax: "1" }), /經驗年數/);
  assert.match(
    filterError("history", { ...full, until: "2023-01-01" }),
    /開始日期/,
  );
  assert.match(
    filterError("jobs", { ...full, country: "other", customCountry: "" }),
    /國家/,
  );
  assert.equal(filterError("jobs", { ...full, salaryMin: "0" }), "");
});
test("pagination preserves submitted filters and respects end of results", () => {
  for (const kind of ["title", "idea"]) {
    const request = featureRequest("jobs", "Engineer", full, kind);
    const before = structuredClone(request);
    const next = pageRequest(request, 2);
    assert.deepEqual(request, before);
    const values =
      next.operationId === "neural" ? object(next.input.lexical) : next.input;
    assert.equal(values.page, 2);
    assert.equal(values.limit, 10);
    assert.equal(values.sort_by, "salary");
    assert.deepEqual(values.salary, { min: 80000, max: 150000 });
    assert.doesNotThrow(() => validateRequest(next.operationId, next.input));
    assert.equal(
      pagination(next, { jobs: [{}], total_count: 11 }).hasNext,
      false,
    );
    assert.equal(
      pagination(request, { jobs: Array(10).fill({}), total_pages: 3 }).hasNext,
      true,
    );
    assert.equal(
      pagination(request, { jobs: [], total_count: 0 }).hasNext,
      false,
    );
  }
});
test("only supported filter controls are shown in each workflow", () => {
  const render = (
    feature: "jobs" | "salary" | "history" | "companies" | "resume",
    kind = "title",
  ) =>
    renderToStaticMarkup(
      <SearchFilters
        feature={feature}
        kind={kind}
        value={defaultFilters(feature)}
        onChange={() => {}}
      />,
    );
  assert.ok(!render("jobs", "link").includes("<select"));
  for (const feature of ["salary", "history"] as const)
    assert.ok(!render(feature).includes("排序方式"));
  assert.ok(render("companies").includes("公司總部地點"));
  assert.ok(!render("resume").includes("地點比對方式"));
  for (const field of [
    "lexical.geo_locations[].country",
    "lexical.location_types",
    "lexical.sort_by / lexical.sort_order",
    "lexical.limit",
  ]) {
    assert.ok(render("resume").includes(field), field);
  }
  assert.ok(render("companies").includes("hq_geolocations[].country"));
  assert.ok(render("salary").includes("experience_levels"));
  assert.ok(render("salary").includes("yoe_range.min"));
  assert.ok(render("history").includes("sample_size"));
  assert.ok(render("history").includes("date_posted_from"));
  assert.ok(!render("jobs", "idea").includes("排除招聘中介職位"));
  const blockedSalary = renderToStaticMarkup(
    <FeaturePanel feature="salary" configured ownerMode={false} />,
  );
  assert.ok(blockedSalary.includes("<fieldset disabled"));
});
