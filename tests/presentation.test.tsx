import React from "react";
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { ResponseView } from "../src/components/response-view";
import { sampleFor } from "../src/lib/samples";
import { operations } from "../src/lib/catalog";

test("job descriptions render safely and unknown job fields remain inspectable", () => {
  const html = renderToStaticMarkup(
    <ResponseView
      data={{
        jobs: [
          {
            _id: "1",
            job_title: "<img src=x onerror=alert(1)>",
            description: "<script>alert(1)</script><p>A useful role</p>",
            new_provider_field: "visible",
          },
        ],
      }}
    />,
  );
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes("A useful role"));
  assert.ok(html.includes("New Provider Field"));
  assert.ok(html.includes("visible"));
});
test("empty records, insights, arrays, task and resume fields have readable presentations", () => {
  assert.match(
    renderToStaticMarkup(<ResponseView data={{ jobs: [] }} />),
    /No new jobs/,
  );
  for (const id of [
    "companies",
    "insights",
    "historical",
    "task",
    "tasks",
    "usage",
    "daily",
    "resume-embed",
    "tech-categories",
  ]) {
    const op = operations.find((o) => o.id === id)!;
    const html = renderToStaticMarkup(
      <ResponseView data={sampleFor(op, op.preset)} />,
    );
    assert.ok(html.length > 100, id);
    assert.ok(!html.includes("[object Object]"), id);
  }
});
test("overlapping pages hide duplicates only in presentation", () => {
  const data = {
    jobs: [
      { _id: "1", job_title: "Old" },
      { _id: "2", job_title: "New" },
    ],
  };
  const html = renderToStaticMarkup(<ResponseView data={data} seen={["1"]} />);
  assert.ok(html.includes("1 repeated job IDs"));
  assert.ok(html.includes("New"));
  assert.equal(data.jobs.length, 2);
});
