import { plainText, uniqueJobs } from "@/lib/response";
import { record } from "@/lib/validation";
export function label(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (x) => x.toUpperCase());
}
function scalar(value: unknown, originalKeys: boolean) {
  if (originalKeys)
    return typeof value === "string" && value !== ""
      ? value
      : JSON.stringify(value);
  if (value === null || value === undefined) return "—";
  return typeof value === "string" ? plainText(value) : String(value);
}
export function DataView({
  data,
  depth = 0,
  originalKeys = false,
}: {
  data: unknown;
  depth?: number;
  originalKeys?: boolean;
}) {
  if (depth > 6)
    return <pre className="field-json">{JSON.stringify(data, null, 2)}</pre>;
  if (Array.isArray(data)) {
    if (!data.length)
      return (
        <span className="empty-small">
          {originalKeys ? "[]" : "No records returned."}
        </span>
      );
    if (data.every((x) => !record(x) && !Array.isArray(x)))
      return (
        <div className="tags">
          {data.length > 30 ? (
            <details>
              <summary>
                {data.length} {originalKeys ? "個值" : "values"}
              </summary>
              <p className="break">
                {data.map((value) => scalar(value, originalKeys)).join(" · ")}
              </p>
            </details>
          ) : (
            data.map((x, i) => (
              <span className="tag" key={i}>
                {scalar(x, originalKeys)}
              </span>
            ))
          )}
        </div>
      );
    if (!originalKeys && data.every(record)) {
      const columns = [...new Set(data.flatMap((x) => Object.keys(x)))];
      return (
        <div className="table-scroll" tabIndex={0} aria-label="Response table">
          <table>
            <thead>
              <tr>
                {columns.map((k) => (
                  <th key={k}>{label(k)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i}>
                  {columns.map((k) => (
                    <td key={k}>
                      {record(row[k]) || Array.isArray(row[k]) ? (
                        <details>
                          <summary>Details</summary>
                          <DataView data={row[k]} depth={depth + 1} />
                        </details>
                      ) : (
                        scalar(row[k], false)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    return (
      <ul>
        {data.map((x, i) => (
          <li key={i}>
            <DataView data={x} depth={depth + 1} originalKeys={originalKeys} />
          </li>
        ))}
      </ul>
    );
  }
  if (record(data)) {
    const entries = Object.entries(data);
    if (originalKeys && !entries.length) return <span>{"{}"}</span>;
    return (
      <dl className="data-list">
        {entries.map(([k, v]) => (
          <div key={k}>
            <dt>{originalKeys ? <code>{k}</code> : label(k)}</dt>
            <dd>
              <DataView
                data={v}
                depth={depth + 1}
                originalKeys={originalKeys}
              />
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  return <span className="break">{scalar(data, originalKeys)}</span>;
}
export function ResponseView({
  data,
  seen = [],
}: {
  data: unknown;
  seen?: string[];
}) {
  if (!record(data)) return <DataView data={data} />;
  const rawJobs = Array.isArray(data.jobs)
    ? data.jobs.filter(record)
    : data.job_title
      ? [data]
      : null;
  if (rawJobs) {
    const jobs = uniqueJobs(rawJobs, seen);
    const meta = Object.fromEntries(
      Object.entries(data).filter(([k]) => k !== "jobs"),
    );
    return (
      <>
        <div className="result-summary">
          <strong>
            {jobs.length} {data.job_title ? "job" : "unique jobs on this page"}
          </strong>
          {typeof data.total_count === "number" && (
            <span>{data.total_count.toLocaleString()} total matches</span>
          )}
        </div>
        {rawJobs.length > jobs.length && (
          <p className="notice">
            {rawJobs.length - jobs.length} repeated job IDs hidden in this
            presentation. JSON retains the original page.
          </p>
        )}
        {!jobs.length && (
          <div className="empty">
            No new jobs on this page. Try another page or adjust the filters.
          </div>
        )}
        {jobs.map((job, i) => (
          <article className="job-card" key={String(job._id ?? i)}>
            <div className="job-top">
              <span className="company-avatar">
                {String(job.company_name ?? "J").slice(0, 1)}
              </span>
              <div>
                <h3>{String(job.job_title ?? job.job_slug ?? job._id)}</h3>
                <p>
                  {String(
                    job.company_name ??
                      job.company_slug ??
                      "Expired job identifier",
                  )}
                </p>
              </div>
              {typeof job.location_type === "string" && (
                <span className="tag green">{job.location_type}</span>
              )}
            </div>
            <div className="job-facts">
              {typeof job.job_type === "string" && <span>{job.job_type}</span>}
              {Array.isArray(job.locations) && (
                <span>
                  {job.locations
                    .filter(record)
                    .map((x) => [x.city, x.country].filter(Boolean).join(", "))
                    .join(" · ")}
                </span>
              )}
              {record(job.salary_range) && (
                <span>
                  {job.salary_range.currency as string}{" "}
                  {Number(job.salary_range.min).toLocaleString()}–
                  {Number(job.salary_range.max).toLocaleString()} /{" "}
                  {String(job.salary_range.period ?? "period unspecified")}
                </span>
              )}
            </div>
            {typeof job.description === "string" && (
              <p className="description">{plainText(job.description)}</p>
            )}
            <details>
              <summary>View all job details</summary>
              <DataView data={job} />
            </details>
          </article>
        ))}
        {!data.job_title && Object.keys(meta).length > 0 && (
          <details className="response-detail">
            <summary>Pagination & additional response fields</summary>
            <DataView data={meta} />
          </details>
        )}
      </>
    );
  }
  if (record(data.headline))
    return (
      <>
        <div className="kpis">
          {Object.entries(data.headline)
            .filter(([, v]) => typeof v === "number" || typeof v === "string")
            .map(([k, v]) => (
              <div key={k}>
                <span>{label(k)}</span>
                <strong>
                  {typeof v === "number" ? v.toLocaleString() : String(v)}
                </strong>
              </div>
            ))}
        </div>
        {Object.entries(data)
          .filter(([k]) => k !== "headline")
          .map(([k, v]) => (
            <section className="response-section" key={k}>
              <h3>{label(k)}</h3>
              <DataView data={v} />
            </section>
          ))}
      </>
    );
  return <DataView data={data} />;
}
