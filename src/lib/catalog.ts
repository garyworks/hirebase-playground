import {
  type Fields,
  s,
  n,
  a,
  b,
  req,
  obj,
  range,
  geo,
  date,
  iso,
  id,
  slug,
  url,
  pageFields,
  searchFields,
  lexicalFields,
  historical,
  companyFields,
  contacts,
  webhookSearch,
} from "./fields";
export type Access = "live" | "owner" | "sample" | "unavailable";
export type Operation = {
  id: string;
  name: string;
  family: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  fields: Fields;
  preset: Record<string, unknown>;
  docs: string;
  access: Access;
  note: string;
  cost: string;
  file?: boolean;
  pagination?: "root" | "lexical" | "offset";
};
const ops: Operation[] = [];
function add(
  id: string,
  name: string,
  family: string,
  method: Operation["method"],
  path: string,
  fields: Fields,
  preset: Record<string, unknown>,
  doc: string,
  extra: Partial<Operation> = {},
) {
  ops.push({
    id,
    name,
    family,
    method,
    path,
    fields,
    preset,
    docs: `https://www.hirebase.org/docs/${doc}`,
    access: "live",
    note: "Requires an API key. Availability depends on your account.",
    cost: "Metered by provider",
    ...extra,
  });
}
const example = {
  job_titles: ["Software Engineer"],
  geo_locations: [{ country: "Hong Kong" }],
  page: 1,
  limit: 5,
};
const jobId = "6a2f14a48bea0df96e26ac7b";
add(
  "search",
  "Search Jobs",
  "Job discovery",
  "POST",
  "/v2/jobs/search",
  searchFields,
  example,
  "api-reference/jobs/search-post",
  {
    pagination: "root",
    cost: "1 unit / job",
    note: "Strict filters. These presets are unverified here. Earlier lab tests found Hong Kong location mismatches; verify raw and normalized locations before relying on coverage. Exact tags come from Reference data. technology_slugs is not available.",
  },
);
add(
  "estimate",
  "Estimate search cost",
  "Job discovery",
  "POST",
  "/v2/jobs/estimate",
  { ...searchFields, limit: n(0, 100) },
  example,
  "api-reference/jobs/estimate",
  {
    cost: "0 units",
    note: "Same filter shape as text search. Cost is the number of billable jobs for this request.",
  },
);
add(
  "neural",
  "Neural Search Jobs",
  "Job discovery",
  "POST",
  "/v2/jobs/neural-search",
  {
    vector: obj({
      query: s(),
      job_ids: a(),
      artifact_id: id,
      vectors: { type: "vectors" },
      score_threshold: n(0, 1),
    }),
    lexical: obj(lexicalFields),
  },
  {
    vector: { query: "Backend engineer building AI products" },
    lexical: {
      location_types: ["Remote"],
      date_posted: "last_month",
      page: 1,
      limit: 5,
    },
  },
  "api-reference/jobs/neural-search-post",
  {
    pagination: "lexical",
    cost: "1 unit / job",
    note: "Relative dates and nested pagination. Counts cap at 2,500. Provider ignores inner typos; this playground rejects them. Provider does not publish a limit maximum; playground cap is 100.",
  },
);
add(
  "job",
  "Job by ID",
  "Job discovery",
  "GET",
  "/v2/jobs/{job_id}",
  { job_id: req(id) },
  { job_id: jobId },
  "api-reference/jobs/get-by-id",
  { cost: "1 job unit" },
);
add(
  "lookup",
  "Look Up Jobs by URL",
  "Job discovery",
  "POST",
  "/v2/jobs/lookup",
  { urls: req({ ...a(), min: 1 }) },
  { urls: ["https://example.com/careers/backend-engineer"] },
  "api-reference/jobs/lookup",
  {
    cost: "1 unit / found job",
    note: "Replace the illustrative URL with real posting URLs. Up to 100 URLs; only found jobs are billed.",
  },
);
add(
  "export",
  "Export live jobs",
  "Exports & archive",
  "POST",
  "/v2/jobs/export",
  {
    search: req(
      obj(
        Object.fromEntries(
          Object.entries(searchFields).filter(
            ([k]) => k !== "exclude_job_board",
          ),
        ),
      ),
    ),
    format: req(s("", ["json", "csv"])),
    notify: b,
    notify_url: url,
  },
  { search: example, format: "json", notify: false },
  "api-reference/jobs/export-jobs",
  {
    access: "sample",
    cost: "Charged on task creation",
    note: "Sample only. Provider terms prohibit customer bulk downloads. Real exports bill all matches when limit is 0; this demo never runs them. json means NDJSON. Export job_board type is inconsistent with Search.",
  },
);
add(
  "expired",
  "Expired job identifiers",
  "Exports & archive",
  "GET",
  "/v2/jobs/expired-jobs",
  { since: req(iso), ...pageFields },
  { since: "2026-11-10", page: 1, limit: 5 },
  "api-reference/jobs/expired-jobs",
  {
    pagination: "root",
    cost: "0 units",
    note: "Identifiers only. since must be within 14 days; use a current date.",
  },
);
add(
  "expired-export",
  "Export expired identifiers",
  "Exports & archive",
  "POST",
  "/v2/jobs/expired-jobs/export",
  { since: req(iso), limit: n(1, 100), notify: b, notify_url: url },
  { since: "2026-11-10", limit: 5, notify: false },
  "api-reference/jobs/export-expired-jobs",
  {
    access: "sample",
    cost: "0 units",
    note: "Sample only bulk workflow. Always JSONL. Omitting the provider limit exports every match; bounded fixture shown here.",
  },
);
add(
  "historical",
  "Historical Jobs Search",
  "Exports & archive",
  "POST",
  "/v2/jobs/historical/search",
  { ...historical, sample_size: n(0, 100) },
  {
    job_titles: ["Data Engineer"],
    date_posted_from: "2025-01-01",
    sample_size: 5,
  },
  "api-reference/jobs/historical-search",
  {
    cost: "0 units",
    note: "At least one filter. Returns counts, titles and a price quote, not full jobs. No salary, industry, seniority or work-arrangement filters.",
  },
);
add(
  "historical-export",
  "Historical checkout & export",
  "Exports & archive",
  "POST",
  "/v2/jobs/historical/export",
  {
    search: req(obj(historical)),
    format: s("", ["json", "csv"]),
    limit: n(1, 100),
    redirect_to: url,
  },
  {
    search: { job_titles: ["Data Engineer"], date_posted_from: "2025-01-01" },
    format: "csv",
    limit: 5,
  },
  "api-reference/jobs/historical-export",
  {
    access: "sample",
    cost: "Separate purchase",
    note: "Sample only. Provider returns a checkout URL; export starts only after payment. No checkout or purchase is created here.",
  },
);
add(
  "companies",
  "Search Companies",
  "Companies",
  "POST",
  "/v2/hirebase/companies/search",
  companyFields,
  { query: "software", page: 1, limit: 5 },
  "api-reference/companies/search-companies",
  {
    pagination: "root",
    cost: "1 unit / company",
    note: "Total count caps at 1,001. company_types is headcount; types is classification. Technology filters are coming soon.",
  },
);
add(
  "company",
  "Company profile",
  "Companies",
  "GET",
  "/v2/hirebase/companies/{company_slug}",
  { company_slug: req(slug) },
  { company_slug: "anthropic" },
  "api-reference/companies/get-company",
  { cost: "1 company unit" },
);
add(
  "company-jobs",
  "Company jobs",
  "Companies",
  "GET",
  "/v2/hirebase/companies/{company_slug}/jobs",
  {
    company_slug: req(slug),
    ...pageFields,
    sort_by: s(),
    sort_order: s("", ["asc", "desc"]),
    job_board: s(),
    job_category: s(),
  },
  { company_slug: "anthropic", page: 1, limit: 5 },
  "api-reference/companies/get-company-jobs",
  {
    pagination: "root",
    cost: "1 unit / job",
    note: "Provider pages can overlap. Presented records deduplicate by job ID across visited pages; raw JSON preserves the page. sort_by/sort_order are accepted but not applied. Playground cap: 100; provider maximum undocumented.",
  },
);
add(
  "company-job",
  "Company job by slug",
  "Companies",
  "GET",
  "/v2/hirebase/companies/{company_slug}/jobs/{job_slug}",
  { company_slug: req(slug), job_slug: req(slug), id },
  { company_slug: "anthropic", job_slug: "example-role" },
  "api-reference/companies/get-company-job",
  {
    cost: "1 job unit",
    note: "Includes expired postings. Replace example-role with a returned job_slug.",
  },
);
add(
  "insights",
  "Market Insights",
  "Insights",
  "POST",
  "/v2/jobs/insights",
  { ...searchFields, top_companies_limit: n(1, 50) },
  { job_titles: ["Data Engineer"], days_ago: 30, top_companies_limit: 5 },
  "api-reference/jobs/insights",
  { cost: "1 insights unit" },
);
add(
  "company-insights",
  "Company insights",
  "Insights",
  "POST",
  "/v2/hirebase/companies/{company_slug}/insights",
  { ...searchFields, company_slug: req(slug), top_companies_limit: n(1, 50) },
  { company_slug: "anthropic", days_ago: 30 },
  "api-reference/companies/insights",
  { cost: "1 insights unit" },
);
add(
  "salary",
  "Salary Benchmark",
  "Insights",
  "POST",
  "/v2/jobs/salary-benchmark",
  {
    public_url: url,
    job_title: s(),
    job_titles: a(),
    yoe_range: range,
    yoe: range,
    description: s(),
    salary_range: obj({
      min: n(0, 1e9),
      max: n(0, 1e9),
      currency: s(),
      period: s(),
    }),
    geo_locations: geo,
    location_types: a(["Remote", "Hybrid", "In-Person"]),
    industry: a(),
    sub_industry: a(),
    experience_levels: a(),
    days_ago: n(1, 365),
    include_expired: b,
    notify: b,
  },
  {
    job_title: "Senior Software Engineer",
    geo_locations: [{ country: "United States" }],
    days_ago: 90,
    notify: false,
  },
  "api-reference/jobs/salary-benchmark",
  {
    cost: "1 salary benchmark unit",
    note: "Only 3 included requests on Free. Returns an async task. Poll manually under Tasks. No email notification is allowed in this playground.",
  },
);
for (const [key, title] of [
  ["categories", "Job categories"],
  ["industries", "Industries"],
  ["subindustries", "Subindustries"],
])
  add(
    key,
    title,
    "Reference data",
    "GET",
    `/v2/jobs/data/${key}`,
    key === "subindustries" ? { industry: req(s()) } : {},
    key === "subindustries" ? { industry: "Tech, Software & IT Services" } : {},
    `api-reference/data/get-${key}`,
    {
      cost: "0 units",
      note: "Documented as public. Some endpoint error sections still mention 401. Load explicitly to avoid background traffic.",
    },
  );
add(
  "resume-upload",
  "Upload Resume",
  "Resumes",
  "POST",
  "/v2/resumes/upload/",
  {},
  {},
  "api-reference/resumes/upload",
  {
    file: true,
    access: "owner",
    cost: "Account-dependent",
    note: "Owner only. Stores the resume with Hirebase. Exactly one PDF, DOC/DOCX, TXT or HTML file, maximum 5 MB. Correct MIME type required.",
  },
);
add(
  "resume-parse",
  "Parse Resume",
  "Resumes",
  "POST",
  "/v2/resumes/{resume_id}/parse",
  { resume_id: req(id) },
  { resume_id: "6a3c15d537f33c238c70a14e" },
  "api-reference/resumes/parse",
  {
    access: "owner",
    note: "Owner only. Parses and updates the uploaded record. Its ID can be used as vector.artifact_id.",
  },
);
add(
  "resume-get",
  "Get stored resume",
  "Resumes",
  "GET",
  "/v2/resumes/{resume_id}",
  { resume_id: req(id) },
  { resume_id: "6a3c15d537f33c238c70a14e" },
  "api-reference/resumes/get",
  {
    access: "owner",
    note: "Owner only. Sensitive personal data; responses remain in memory, with contact fields redacted.",
  },
);
add(
  "resume-embed",
  "Embed resume",
  "Resumes",
  "POST",
  "/v2/resumes/embed",
  {},
  {},
  "api-reference/resumes/embed-post",
  {
    file: true,
    access: "owner",
    note: "Owner only. Stateless processing; no stored artifact ID. Docs conflict on whether parsed resume is returned with embedding. Raw view preserves actual fields; contact fields are redacted.",
  },
);
add(
  "contacts",
  "Hiring Manager Contacts API",
  "Hiring Manager",
  "POST",
  "/v2/jobs/contacts",
  contacts,
  { job_id: jobId, reveal_email: false, reveal_phone: false },
  "api-reference/jobs/contacts",
  {
    access: "sample",
    cost: "Add-on: $0.30 / successful search",
    note: "Sample only. Requires Hiring Manager add-on. Async research may charge; never submitted here.",
  },
);
add(
  "contacts-batch",
  "Batch hiring contacts",
  "Hiring Manager",
  "POST",
  "/v2/jobs/contacts/batch",
  {
    ...Object.fromEntries(
      Object.entries(contacts).filter(([k]) => k !== "job_id"),
    ),
    job_ids: req({ ...a(), min: 1 }),
  },
  { job_ids: [jobId], reveal_email: false, reveal_phone: false },
  "api-reference/jobs/contacts-batch",
  {
    access: "sample",
    cost: "Add-on: per successful job",
    note: "Sample only. 1–100 job IDs, one research task per unique job; billed separately.",
  },
);
add(
  "reveal",
  "Reveal contact details",
  "Hiring Manager",
  "POST",
  "/v2/contacts/reveal",
  { linkedin_url: req(url), name: s(), reveal_email: b, reveal_phone: b },
  {
    linkedin_url: "https://www.linkedin.com/in/example",
    reveal_email: true,
    reveal_phone: false,
  },
  "api-reference/contacts/reveal",
  {
    access: "sample",
    cost: "$0.05 / email; $0.40 / phone",
    note: "Sample only. Paid add-on and sensitive contact data. No real reveal is made.",
  },
);
add(
  "task",
  "Get Task Status",
  "Tasks & usage",
  "GET",
  "/v2/tasks/{task_id}",
  { task_id: req(slug) },
  { task_id: "79a854ab-0543-478f-8bc5-f7261ce42fda" },
  "api-reference/tasks/get-task-status",
  {
    access: "owner",
    cost: "0 units",
    note: "Owner only. Manual polling; no background loops. Task output may contain sensitive records or signed downloads, which are redacted.",
  },
);
add(
  "tasks",
  "List tasks",
  "Tasks & usage",
  "GET",
  "/v2/tasks/",
  {
    task_type: s(),
    state: s("", ["queued", "processing", "finished", "failed", "canceled"]),
    limit: n(1, 100),
    skip: n(0, 100000),
  },
  { limit: 5, skip: 0 },
  "api-reference/tasks/list-tasks",
  {
    access: "owner",
    cost: "0 units",
    pagination: "offset",
    note: "Owner only. Provider supports up to 1,000 tasks; playground cap is 100. Pagination uses skip.",
  },
);
add(
  "usage",
  "Usage summary",
  "Tasks & usage",
  "GET",
  "/v2/billing/usage/summary",
  {},
  {},
  "api-reference/billing/usage-summary",
  { access: "owner", cost: "0 units" },
);
add(
  "daily",
  "Daily usage",
  "Tasks & usage",
  "GET",
  "/v2/billing/usage/daily",
  { from: date, to: date, meter: s() },
  {},
  "api-reference/billing/usage-daily",
  {
    access: "owner",
    cost: "0 units",
    note: "Owner only. Up to 90 inclusive days. Supply both dates or omit both for provider defaults.",
  },
);
const techExtra: Partial<Operation> = {
  access: "unavailable",
  cost: "Not callable",
  note: "Provider explicitly marks this beta as coming soon, not callable yet. A synthetic illustration of the documented shape is available.",
};
add(
  "tech-search",
  "Search technologies",
  "Technologies · coming soon",
  "GET",
  "/v2/technologies/search",
  { q: req(s()), category: s(), limit: n(1, 100) },
  { q: "snowflake", limit: 5 },
  "api-reference/technologies/search-technologies",
  techExtra,
);
add(
  "tech-categories",
  "Technology categories",
  "Technologies · coming soon",
  "GET",
  "/v2/technologies/categories",
  {},
  {},
  "api-reference/technologies/list-categories",
  techExtra,
);
add(
  "technology",
  "Technology profile",
  "Technologies · coming soon",
  "GET",
  "/v2/technologies/{slug}",
  { slug: req(slug), months: n(1, 120) },
  { slug: "snowflake", months: 12 },
  "api-reference/technologies/get-technology",
  techExtra,
);
add(
  "company-tech",
  "Company technology stack",
  "Technologies · coming soon",
  "GET",
  "/v2/hirebase/companies/{company_slug}/technologies",
  {
    company_slug: req(slug),
    technologies: s(),
    categories: s(),
    min_tier: s("", ["high", "medium", "low"]),
    include_inactive: b,
  },
  { company_slug: "ramp", min_tier: "medium" },
  "api-reference/technologies/company-technologies",
  techExtra,
);
add(
  "tech-lookup",
  "Look up company stacks",
  "Technologies · coming soon",
  "POST",
  "/v2/technologies/lookup",
  {
    companies: req({
      type: "objects",
      min: 1,
      max: 100,
      fields: { domain: s(), linkedin_url: url, company_slug: slug },
    }),
    technologies: a(),
    categories: a(),
    min_tier: s("", ["high", "medium", "low"]),
  },
  { companies: [{ domain: "example.com" }] },
  "api-reference/technologies/lookup",
  techExtra,
);
const webhookFields: Fields = {
  url: req(url),
  search: req(obj(webhookSearch)),
  events: a(["job.new", "company.new"]),
  max_jobs_per_day: n(1, 5000),
  description: s(),
  header: obj({ name: s(), value: s() }),
};
add(
  "webhook-estimate",
  "Estimate webhook volume",
  "Webhooks",
  "POST",
  "/v2/webhooks/estimate",
  { search: req(obj(webhookSearch)) },
  { search: { job_titles: ["Software Engineer"] } },
  "guides/webhooks",
  {
    cost: "0 units",
    note: "Average daily matching jobs and companies over the last 7 days. No subscription is created.",
  },
);
for (const [key, title, method, path, fields, preset] of [
  [
    "create",
    "Create webhook",
    "POST",
    "/v2/webhooks",
    webhookFields,
    {
      url: "https://example.com/hirebase",
      search: { job_titles: ["Software Engineer"] },
      events: ["job.new"],
      max_jobs_per_day: 5,
    },
  ],
  ["list", "List webhooks", "GET", "/v2/webhooks", {}, {}],
  [
    "get",
    "Get webhook",
    "GET",
    "/v2/webhooks/{id}",
    { id: req(slug) },
    { id: "example-webhook" },
  ],
  [
    "update",
    "Update webhook",
    "PATCH",
    "/v2/webhooks/{id}",
    {
      ...Object.fromEntries(
        Object.entries(webhookFields).map(([k, v]) => [
          k,
          { ...v, required: false },
        ]),
      ),
      id: req(slug),
      status: s("", ["paused", "active"]),
    },
    { id: "example-webhook", status: "paused" },
  ],
  [
    "delete",
    "Delete webhook",
    "DELETE",
    "/v2/webhooks/{id}",
    { id: req(slug) },
    { id: "example-webhook" },
  ],
  [
    "test",
    "Send test event",
    "POST",
    "/v2/webhooks/{id}/test",
    { id: req(slug) },
    { id: "example-webhook" },
  ],
  [
    "rotate",
    "Rotate signing secret",
    "POST",
    "/v2/webhooks/{id}/rotate-secret",
    { id: req(slug) },
    { id: "example-webhook" },
  ],
  [
    "deliveries",
    "Webhook deliveries",
    "GET",
    "/v2/webhooks/{id}/deliveries",
    { id: req(slug), status: s() },
    { id: "example-webhook", status: "failed" },
  ],
  [
    "account-secret",
    "Export signing secret",
    "GET",
    "/v2/webhooks/account-secret",
    {},
    {},
  ],
] as const)
  add(
    `webhook-${key}`,
    title,
    "Webhooks",
    method,
    path,
    fields as Fields,
    preset,
    "guides/webhooks",
    {
      access: "sample",
      cost: "Events consume job units",
      note: "Sample only. Persistent subscriptions, external deliveries and signing secrets are unsuitable for this demo. Some response schemas are not specified; those examples are workflow illustrations, not asserted contracts.",
    },
  );
export const operations = ops;
export const families = [...new Set(ops.map((o) => o.family))];
