import { execute } from "./server";
import type { Feature } from "./features";
import type { Result } from "./response";

// Render only synthetic previews on first load. No background live calls.
export async function demoExamples(): Promise<
  Partial<Record<Feature, Result>>
> {
  const specs: [Feature, string, Record<string, unknown>][] = [
    ["jobs", "search", { page: 1, limit: 3 }],
    ["companies", "companies", { page: 1, limit: 5 }],
    ["market", "insights", { job_titles: ["軟件工程師"], days_ago: 30 }],
    ["salary", "task", { task_id: "79a854ab-0543-478f-8bc5-f7261ce42fda" }],
    ["resume", "resume-get", { resume_id: "6a3c15d537f33c238c70a14e" }],
    [
      "people",
      "contacts",
      {
        job_id: "6a2f14a48bea0df96e26ac7b",
        reveal_email: false,
        reveal_phone: false,
      },
    ],
    [
      "history",
      "historical",
      { date_posted_from: "2025-01-01", sample_size: 5 },
    ],
  ];
  return Object.fromEntries(
    await Promise.all(
      specs.map(async ([feature, operationId, input]) => [
        feature,
        await execute({ operationId, input, mode: "sample" }, {}),
      ]),
    ),
  );
}
