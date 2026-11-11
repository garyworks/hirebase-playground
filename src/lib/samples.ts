import type { Operation } from "./catalog";
const job = {
  _id: "6a2f14a48bea0df96e26ac7b",
  job_title: "資深後端工程師",
  company_name: "創想科技（示範）",
  company_slug: "example-labs",
  job_slug: "senior-backend-engineer",
  location_type: "Hybrid",
  locations: [{ city: "Hong Kong", country: "Hong Kong" }],
  job_type: "Full Time",
  salary_range: { min: 50000, max: 70000, currency: "HKD", period: "monthly" },
  date_posted: "2026-11-10",
  first_ingested: "2026-11-10T04:00:00Z",
  job_categories: ["Software Engineer Jobs"],
  skills: ["TypeScript", "Distributed systems"],
  technologies: ["PostgreSQL", "Python"],
  description:
    "<p>與跨職能團隊合作，設計及開發可靠的數碼產品，持續改善服務效能與使用體驗。</p><p>我們重視清晰溝通、主動學習，以及把好想法落實的能力。此為虛構示範職位，並非現有空缺。</p>",
  application_link: "https://example.com/careers/backend-engineer",
  experience_level: "Senior",
};
const company = {
  company_name: "創想科技（示範）",
  company_slug: "example-labs",
  description_summary:
    "一家專注開發實用數碼產品的虛構科技公司，重視團隊協作、持續學習與彈性工作。",
  size_range: { min: 51, max: 200 },
  industries: ["Tech, Software & IT Services"],
  subindustries: ["AI & ML"],
  headquarters: { city: "Hong Kong", country: "Hong Kong" },
  type: "Startup",
};
const task = {
  id: "79a854ab-0543-478f-8bc5-f7261ce42fda",
  type: "salary_benchmark",
  state: "finished",
  progress: 1,
  result: {
    market: {
      salary: {
        count: 42,
        p25: 120000,
        p50: 150000,
        p75: 180000,
        currency: "USD",
      },
      salary_by_source: [
        { source: "live", count: 30, p50: 155000 },
        { source: "expired", count: 12, p50: 140000 },
      ],
    },
    confidence: { grade: "B" },
    proposed: {
      percentile: 62,
      verdict: "示範薪酬位於市場中段，實際待遇仍需按職責與經驗比較。",
    },
  },
  error: null,
};
const resume = {
  _id: "6a3c15d537f33c238c70a14e",
  status: "parsed",
  parsed_data: {
    personal_information: { data: { full_name: "陳曉晴（示範）" } },
    skills: [{ category: "Engineering", details: ["Python", "TypeScript"] }],
    summary_or_objective:
      "具備軟件開發經驗，熟悉 Python 與 TypeScript，喜歡與團隊合作，把複雜問題轉化為實用產品。此為虛構履歷。",
  },
  created_at: "2026-11-10T04:00:00Z",
};
export function sampleFor(
  op: Operation,
  input: Record<string, unknown>,
): unknown {
  const nested = (input.lexical ?? input) as Record<string, unknown>;
  const page = Number(nested.page ?? 1);
  const limit = Number(nested.limit ?? 5);
  const jobs = Array.from(
    { length: Math.min(limit, Math.max(0, 8 - (page - 1) * limit)) },
    (_, i) => ({
      ...job,
      _id: `6a2f14a48bea0df96e26ac7${(page - 1) * limit + i}`,
      job_title: [
        "資深後端工程師",
        "數據平台工程師",
        "產品工程師",
        "機器學習工程師",
        "工程團隊主管",
      ][i % 5],
    }),
  );
  const list = {
    jobs,
    total_count: 8,
    page,
    limit,
    total_pages: Math.ceil(8 / limit),
  };
  switch (op.id) {
    case "search":
    case "neural":
    case "company-jobs":
      return list;
    case "job":
      return job;
    case "company-job":
      return { jobs: [job] };
    case "lookup":
      return {
        jobs: [job],
        matches: [{ url: job.application_link, job_id: job._id }],
        not_found: ["https://example.com/missing"],
      };
    case "estimate":
      return { cost: limit === 0 ? 8 : Math.min(limit, 8) };
    case "expired":
      return {
        ...list,
        jobs: jobs.map((j) => ({
          _id: j._id,
          company_slug: j.company_slug,
          job_slug: j.job_slug,
          date_expired: "2026-11-10",
        })),
      };
    case "companies":
      return {
        companies: page === 1 ? [company] : [],
        total_count: 1,
        page,
        limit,
        total_pages: 1,
      };
    case "company":
      return { company, jobs: [job] };
    case "historical":
      return {
        total_count: 240,
        by_year_posted: [
          { year: 2024, count: 40 },
          { year: 2025, count: 150 },
          { year: 2026, count: 50 },
        ],
        top_companies: [{ company_name: "創想科技（示範）", count: 12 }],
        sample_titles: [{ job_title: "數據工程師", year_posted: 2025 }],
        coverage: {
          description_text_sample_pct: 75,
          note: "Synthetic illustration. Historical crawl coverage varies by year.",
        },
        export_quote: { record_count: 240, price_usd: 28.8 },
      };
    case "historical-export":
      return {
        task_id: "example-purchase-task",
        checkout_url: "[SAMPLE — no checkout created]",
        record_count: 5,
        price_usd: 0.6,
        status: "awaiting_payment",
      };
    case "export":
    case "expired-export":
      return {
        id: op.id === "export" ? "example-export-task" : "example-expired-task",
        type: op.id === "export" ? "export_job_data" : "export_expired_jobs",
        state: "queued",
        progress: 0,
        input,
      };
    case "insights":
    case "company-insights":
      return {
        headline: {
          total_count: 240,
          sample_size: 200,
          median_salary: 150000,
          salary_currency: "USD",
          pct_remote: 42,
          pct_disclosing_salary: 60,
        },
        salary: {
          count: 120,
          p25: 120000,
          p50: 150000,
          p75: 180000,
          p90: 220000,
          currency: "USD",
          histogram: [
            { lower: 100000, upper: 140000, count: 32 },
            { lower: 140000, upper: 180000, count: 55 },
          ],
        },
        top_technologies: [
          { key: "Python", count: 100, percent: 50 },
          { key: "TypeScript", count: 60, percent: 30 },
        ],
        top_companies: [
          { company_name: "創想科技（示範）", count: 12, percent: 6 },
        ],
        cached: false,
        generated_at: "2026-11-10T04:00:00Z",
      };
    case "salary":
      return { id: task.id, type: task.type, state: "queued", progress: 0 };
    case "task": {
      const id = String(input.task_id);
      if (
        [
          "example-export-task",
          "example-expired-task",
          "example-purchase-task",
        ].includes(id)
      )
        return {
          id,
          type:
            id === "example-expired-task"
              ? "export_expired_jobs"
              : "export_job_data",
          state: "finished",
          progress: 1,
          result: {
            download_url: "https://example.com/synthetic-export.jsonl",
            record_count: 5,
            file_size: 3455,
          },
          error: null,
        };
      if (id === "example-contact-task")
        return {
          id,
          type: "contacts_extraction",
          state: "finished",
          progress: 1,
          result: { contacts: [] },
          error: null,
        };
      return { ...task, id };
    }
    case "tasks":
      return Number(input.skip ?? 0) === 0 ? [task] : [];
    case "usage":
      return {
        billing_source: "stripe",
        plan_lookup_keys: ["free"],
        subscription_status: "active",
        meters: [
          {
            event_name: "m_jobs_api_calls",
            display_name: "Jobs",
            used: 25,
            included: 500,
            remaining: 475,
            overage_mode: "block",
          },
          {
            event_name: "m_salary_benchmarks",
            display_name: "Salary benchmarks",
            used: 0,
            included: 3,
            remaining: 3,
          },
        ],
      };
    case "daily":
      return {
        from_date: "2026-11-09",
        to_date: "2026-11-10",
        days: [
          { date: "2026-11-09", total: 10, meters: { m_jobs_api_calls: 10 } },
          { date: "2026-11-10", total: 15, meters: { m_jobs_api_calls: 15 } },
        ],
      };
    case "categories":
      return {
        categories: [
          "Software Engineer Jobs",
          "Data Analyst Jobs",
          "Engineering Jobs",
        ],
      };
    case "industries":
      return {
        industries: ["Tech, Software & IT Services", "Finance", "Healthcare"],
      };
    case "subindustries":
      return {
        subindustries:
          input.industry === "Healthcare"
            ? ["Hospitals", "Medical Practices"]
            : [
                "AI & ML",
                "Software Development & Engineering",
                "Cloud Technologies",
              ],
      };
    case "resume-upload":
      return { ...resume, status: "uploaded", parsed_data: null };
    case "resume-get":
    case "resume-parse":
      return resume;
    case "resume-embed":
      return {
        resume: resume.parsed_data,
        embedding: Array.from({ length: 768 }, (_, i) =>
          Number((Math.sin(i) / 100).toFixed(6)),
        ),
      };
    case "contacts":
      return {
        id: "example-contact-task",
        type: "contacts_extraction",
        state: "finished",
        result: {
          contacts: [
            {
              name: "林嘉欣（示範）",
              role: "招聘主管",
              function: "recruiting",
              relationship: "recruiter",
              reason:
                "示範招聘主管，協調工程團隊的人才招聘與面試安排。此為虛構人物。",
              email: null,
              phone_number: null,
            },
          ],
        },
      };
    case "contacts-batch":
      return {
        tasks: [
          { job_id: job._id, task_id: "example-contact-task", state: "queued" },
        ],
        errors: [],
      };
    case "reveal":
      return {
        name: "林嘉欣（示範）",
        role: "招聘主管",
        profile_url: "https://example.com/person",
        email: null,
        phone_number: null,
        reveals: { email: false, phone: false },
      };
    case "tech-search":
      return {
        technologies: [
          {
            slug: "snowflake",
            name: "Snowflake",
            vendor: "Snowflake",
            company_count: 100,
            category: { slug: "db.warehouse", name: "Cloud data warehouses" },
          },
        ],
      };
    case "tech-categories":
      return {
        groups: [
          {
            slug: "db",
            name: "Databases and Storage",
            categories: [
              {
                slug: "db.warehouse",
                name: "Cloud data warehouses",
                technology_count: 10,
              },
            ],
          },
        ],
      };
    case "technology":
      return {
        technology: {
          slug: "snowflake",
          name: "Snowflake",
          company_count: 100,
        },
        adoption: [
          { month: "2026-09", companies: 45, share: 0.02 },
          { month: "2026-10", companies: 50, share: 0.025 },
        ],
      };
    case "company-tech":
      return {
        company_slug: "example-labs",
        company_name: "創想科技（示範）",
        technologies: [
          {
            technology: { slug: "snowflake", name: "Snowflake" },
            tier: "high",
            postings: 12,
            trend: "rising",
          },
        ],
        total: 1,
      };
    case "tech-lookup":
      return {
        results: [
          {
            input: { domain: "example.com" },
            company_slug: "example-labs",
            company_name: "創想科技（示範）",
            technologies: [],
          },
        ],
        matched: 1,
      };
    default:
      return {
        demonstration:
          "Workflow illustration only; the provider guide does not specify a full response schema for this operation.",
        operation: op.name,
        live_request_sent: false,
      };
  }
}
