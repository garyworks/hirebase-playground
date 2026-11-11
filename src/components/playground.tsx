"use client";

import {
  Fragment,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  features,
  friendlyError,
  items,
  location,
  number,
  object,
  pay,
  safeLink,
  words,
  type Feature,
  type Item,
  type SearchValues,
} from "../lib/features";
import type { Result } from "../lib/response";
import {
  defaultFilters,
  featureRequest,
  filterError,
  pageRequest,
  pagination,
  type SearchRequest,
} from "../lib/search";
import { ApiKey, ApiOperation } from "./api-label";
import { DataView } from "./response-view";
import { ResponseJson } from "./response-json";
import { SearchFilters } from "./search-filters";

type PlaygroundFeature = Exclude<Feature, "resume" | "people" | "saved">;
const choices = features.filter(
  (feature): feature is (typeof features)[number] & { id: PlaygroundFeature } =>
    feature.id !== "resume" &&
    feature.id !== "people" &&
    feature.id !== "saved",
);

function Table({
  headings,
  rows,
  onSelect,
  expanded,
}: {
  headings: string[];
  rows: ReactNode[][];
  onSelect?: (index: number) => void;
  expanded?: { index: number; content: ReactNode; id: string };
}) {
  if (!rows.length) return <p className="caption">沒有符合條件的資料。</p>;
  return (
    <div className="table-scroll" tabIndex={0}>
      <table>
        <thead>
          <tr>
            {headings.map((label) => (
              <th key={label} scope="col">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const active = expanded?.index === index;
            return (
              <Fragment key={index}>
                <tr
                  className={onSelect ? "job-row" : undefined}
                  data-expanded={active || undefined}
                  onClick={onSelect && (() => onSelect(index))}
                >
                  {row.map((cell, column) => (
                    <td key={column}>{cell || "未提供"}</td>
                  ))}
                </tr>
                {active && (
                  <tr className="job-detail-row">
                    <td colSpan={headings.length} id={expanded.id}>
                      {expanded.content}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
function list(value: unknown) {
  return Array.isArray(value)
    ? value.map(words).filter(Boolean).join("、")
    : words(value);
}

export function JobDetails({ job }: { job: Item }) {
  const descriptionKey = words(job.description)
    ? "description"
    : "description_text";
  const description = words(job[descriptionKey]);
  const link = safeLink(job.application_link);
  const fields = Object.fromEntries(
    Object.entries(job).filter(
      ([key]) => key !== descriptionKey || !description,
    ),
  );
  return (
    <div className="job-detail">
      <h3>職位說明 {description && <ApiKey name={descriptionKey} />}</h3>
      <p>{description || "未提供職位說明。"}</p>
      {link && (
        <a href={link} target="_blank" rel="noreferrer">
          開啟招聘網頁
        </a>
      )}
      <DataView data={fields} originalKeys />
    </div>
  );
}

export function JobTable({ rows }: { rows: Item[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const detailId = useId();
  const job = selected === null ? undefined : rows[selected];
  return (
    <Table
      headings={["職位", "公司", "地點", "薪酬"]}
      onSelect={(index) =>
        setSelected((current) => (current === index ? null : index))
      }
      expanded={
        selected !== null && job
          ? { index: selected, id: detailId, content: <JobDetails job={job} /> }
          : undefined
      }
      rows={rows.map((row, index) => [
        <button
          key="title"
          type="button"
          className="job-title-button"
          aria-expanded={selected === index}
          aria-controls={selected === index ? detailId : undefined}
        >
          {words(row.job_title) || "查看職位詳情"}
        </button>,
        words(row.company_name),
        location(row.locations),
        pay(row.salary_range),
      ])}
    />
  );
}
export function FeatureResult({
  feature,
  data,
}: {
  feature: PlaygroundFeature;
  data: Item;
}) {
  if (feature === "jobs") return <JobTable rows={items(data.jobs)} />;
  if (feature === "companies") {
    const rows = items(data.companies);
    return (
      <>
        <Table
          headings={["公司", "行業", "員工人數範圍", "總部"]}
          rows={rows.map((row) => {
            const size = object(row.size_range);
            return [
              words(row.company_name),
              list(row.industries),
              size.min != null || size.max != null
                ? `${words(size.min)} – ${words(size.max)}`
                : "未提供",
              location([row.headquarters]),
            ];
          })}
        />
        {rows.map((row, index) => (
          <p key={index}>
            {words(row.company_name)}：
            {words(row.description_summary) || "未提供公司介紹。"}
          </p>
        ))}
      </>
    );
  }
  if (feature === "market") {
    const headline = object(data.headline);
    return (
      <>
        <Table
          headings={["符合條件職位數", "分析樣本數", "遙距工作比例（%）"]}
          rows={[
            [
              number(headline.total_count),
              number(headline.sample_size),
              number(headline.pct_remote),
            ],
          ]}
        />
        <h3>
          主要技能 <ApiKey name="top_skills" />
        </h3>
        <Table
          headings={["技能", "樣本內職位數"]}
          rows={items(data.top_skills).map((row) => [
            words(row.key),
            number(row.count),
          ])}
        />
        <h3>
          招聘公司 <ApiKey name="top_companies" />
        </h3>
        <Table
          headings={["公司", "樣本內職位數"]}
          rows={items(data.top_companies).map((row) => [
            words(row.company_name),
            number(row.count),
          ])}
        />
      </>
    );
  }
  if (feature === "salary") {
    if (["queued", "processing", "running"].includes(words(data.state)))
      return <p>報告正在處理，稍後按「查看報告進度」。</p>;
    if (["failed", "canceled", "cancelled"].includes(words(data.state)))
      return <p>報告未能完成或已取消。</p>;
    if (data.state !== "finished")
      return <p>暫未取得報告狀態，請稍後手動查詢。</p>;
    const salary = object(object(object(data.result).market).salary);
    return (
      <>
        <p className="caption">以下為年薪統計；貨幣以結果為準。</p>
        <Table
          headings={[
            "薪酬樣本數",
            "貨幣",
            "第 25 百分位",
            "中位數",
            "第 75 百分位",
          ]}
          rows={
            Object.keys(salary).length
              ? [
                  [
                    number(salary.count),
                    words(salary.currency),
                    number(salary.p25),
                    number(salary.p50),
                    number(salary.p75),
                  ],
                ]
              : []
          }
        />
      </>
    );
  }
  if (feature === "history")
    return (
      <>
        <p>歷史職位數：{number(data.total_count)}</p>
        <Table
          headings={["年份", "職位數"]}
          rows={items(data.by_year_posted).map((row) => [
            words(row.year),
            number(row.count),
          ])}
        />
        <Table
          headings={["公司", "職位數"]}
          rows={items(data.top_companies).map((row) => [
            words(row.company_name),
            number(row.count),
          ])}
        />
        <Table
          headings={["職位名稱例子", "刊登年份"]}
          rows={items(data.sample_titles).map((row) => [
            words(row.job_title),
            words(row.year_posted),
          ])}
        />
      </>
    );
  return null;
}

export function FeaturePanel({
  feature,
  configured,
  ownerMode,
}: {
  feature: PlaygroundFeature;
  configured: boolean;
  ownerMode: boolean;
}) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(() => defaultFilters(feature));
  const [kind, setKind] = useState<SearchValues["kind"]>("title");
  const [result, setResult] = useState<Result | null>(null);
  const [completedRequest, setCompletedRequest] =
    useState<SearchRequest | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [taskId, setTaskId] = useState("");
  const restricted = !ownerMode && feature === "salary";
  const disabled = !configured || restricted || busy;

  async function run(operationId: string, input: Item): Promise<Item | null> {
    if (pending.current || !configured || restricted) return null;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    setResult(null);
    try {
      const payload = { operationId, input, mode: "live" };
      const response = await fetch("/api/hirebase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
        signal: AbortSignal.timeout(90000),
      });
      const value = (await response.json()) as Result;
      if (!response.ok || value.status >= 400 || value.error) {
        setError(friendlyError(value.status || response.status, value.headers));
        return null;
      }
      setResult(value);
      setCompletedRequest({ operationId, input: structuredClone(input) });
      return object(value.data);
    } catch {
      setError("暫時未能完成操作，請稍後再試。");
      return null;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (disabled) return;
    const validation = filterError(feature, filters, kind);
    if (validation) {
      setError(validation);
      setResult(null);
      return;
    }
    if (feature === "salary") setTaskId("");
    const request = featureRequest(feature, query, filters, kind);
    const data = await run(request.operationId, request.input);
    if (feature === "salary" && data) {
      setTaskId(words(data.id));
      if (!data.id)
        setNotice(
          "已收到回應，但無法取得報告紀錄；請聯絡管理者，避免重複建立。",
        );
    }
  }
  const label =
    feature === "companies"
      ? "公司名稱或關鍵字"
      : feature === "jobs" && kind === "link"
        ? "招聘連結"
        : feature === "jobs" && kind === "idea"
          ? "文字條件"
          : "職位名稱";
  const placeholder =
    feature === "companies"
      ? "例如：software"
      : feature === "jobs" && kind === "link"
        ? "https://…"
        : feature === "jobs" && kind === "idea"
          ? "例如：使用 Python 開發資料產品的工作"
          : "例如：Software Engineer";
  const operation = featureRequest(feature, query, filters, kind).operationId;
  const queryKey =
    {
      companies: "query",
      lookup: "urls",
      neural: "vector.query",
      salary: "job_title",
    }[operation] ?? "job_titles";
  const pageInfo =
    result &&
    completedRequest &&
    ["search", "neural", "companies"].includes(completedRequest.operationId)
      ? pagination(completedRequest, object(result.data))
      : null;
  async function turnPage(page: number) {
    if (!completedRequest) return;
    const request = pageRequest(completedRequest, page);
    await run(request.operationId, request.input);
  }
  const actions = (label: string) => (
    <div className="form-actions">
      <button className="primary" disabled={busy}>
        {busy ? "處理中…" : label}
        <span aria-hidden="true"> →</span>
      </button>
      <button
        type="button"
        className="text-button"
        disabled={busy}
        onClick={() => setFilters(defaultFilters(feature))}
      >
        重設篩選
      </button>
      <span className="caption">按下按鈕才會查詢</span>
    </div>
  );
  return (
    <>
      {restricted && (
        <p className="notice">管理者尚未啟用這項功能的即時操作。</p>
      )}
      <form className="form-card" onSubmit={submit}>
        {feature === "jobs" && (
          <div className="search-tabs" aria-label="搜尋方式">
            {(
              [
                ["title", "職位名稱"],
                ["idea", "文字條件"],
                ["link", "招聘連結"],
              ] as const
            ).map(([value, text]) => (
              <button
                type="button"
                key={value}
                aria-pressed={kind === value}
                disabled={busy}
                onClick={() => setKind(value)}
              >
                {text}{" "}
                <ApiKey
                  name={
                    value === "title"
                      ? "job_titles"
                      : value === "idea"
                        ? "vector.query"
                        : "urls"
                  }
                />
              </button>
            ))}
          </div>
        )}
        <div className="operation-list">
          <ApiOperation id={operation} />
        </div>
        <fieldset disabled={disabled}>
          <label className="query-field">
            {label} <ApiKey name={queryKey} />
            <input
              type={feature === "jobs" && kind === "link" ? "url" : "text"}
              value={query}
              maxLength={12000}
              placeholder={placeholder}
              required={
                feature === "salary" || (feature === "jobs" && kind !== "title")
              }
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <SearchFilters
            feature={feature}
            kind={kind}
            value={filters}
            onChange={setFilters}
          />
          {actions(
            feature === "salary"
              ? "建立薪酬報告"
              : feature === "companies"
                ? "搜尋公司"
                : feature === "market"
                  ? "查詢市場趨勢"
                  : feature === "history"
                    ? "查詢招聘歷程"
                    : "搜尋職位",
          )}
        </fieldset>
      </form>
      {feature === "salary" && (
        <section className="form-card">
          <h2>
            薪酬報告進度 <ApiOperation id="task" />
          </h2>
          <p className="caption">
            使用報告的 <ApiKey name="task_id" /> 查詢進度。
          </p>
          <button
            disabled={disabled || !taskId}
            onClick={() => run("task", { task_id: taskId })}
          >
            查看報告進度
          </button>
        </section>
      )}
      <div aria-live="polite">
        {busy && <p role="status">正在查詢，請稍候…</p>}
        {notice && <p className="notice">{notice}</p>}
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {configured && result?.source === "live" && (
        <section className="results" aria-label="查詢結果">
          <div className="results-heading">
            <h2>查詢結果</h2>
            <div className="result-actions">
              {completedRequest && (
                <ApiOperation id={completedRequest.operationId} />
              )}
              <ResponseJson data={result.data} />
            </div>
          </div>
          <FeatureResult
            key={result.requestedAt}
            feature={feature}
            data={object(result.data)}
          />
          {pageInfo && (
            <div className="pagination">
              <span className="caption">
                第 {pageInfo.page} 頁 · 本頁 {pageInfo.count} 筆
              </span>
              <div className="actions">
                <button
                  disabled={busy || pageInfo.page <= 1}
                  onClick={() => turnPage(pageInfo.page - 1)}
                >
                  上一頁
                </button>
                <button
                  disabled={busy || !pageInfo.hasNext}
                  onClick={() => turnPage(pageInfo.page + 1)}
                >
                  下一頁
                </button>
              </div>
              <p className="caption">
                翻頁沿用上次查詢條件；調整篩選後請重新搜尋。
              </p>
            </div>
          )}
        </section>
      )}
    </>
  );
}

export default function Playground({
  configured,
  ownerMode,
}: {
  configured: boolean;
  ownerMode: boolean;
}) {
  const [selected, setSelected] = useState<PlaygroundFeature>("jobs");
  const [visited, setVisited] = useState<PlaygroundFeature[]>(["jobs"]);
  const active =
    choices.find((feature) => feature.id === selected) ?? choices[0];
  const descriptions: Record<PlaygroundFeature, string> = {
    jobs: "按職位、工作條件或招聘連結查詢。",
    companies: "按名稱、規模及總部地點查詢公司。",
    market: "選擇條件，查看招聘數量與技能分佈。",
    salary: "比較指定職位的薪酬統計，建立後可手動查看報告進度。",
    history: "按地點及日期查看歷史招聘統計。",
  };
  return (
    <div className="playground">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            h
          </span>
          <span>
            Hirebase<small>功能測試</small>
          </span>
        </div>
        <p className="nav-label">測試功能</p>
        <nav aria-label="功能選單">
          {choices.map((feature) => (
            <button
              type="button"
              key={feature.id}
              aria-current={active.id === feature.id ? "page" : undefined}
              aria-controls={`panel-${feature.id}`}
              onClick={() => {
                setSelected(feature.id);
                setVisited((current) =>
                  current.includes(feature.id)
                    ? current
                    : [...current, feature.id],
                );
              }}
            >
              {feature.label}
              <span className="nav-arrow" aria-hidden="true">
                ›
              </span>
            </button>
          ))}
        </nav>
        <p className="sidebar-note">選擇功能，設定條件後查詢。</p>
      </aside>
      <main>
        <header className="page-header">
          <div>
            <h1>{active.label}</h1>
            <p>{descriptions[active.id]}</p>
          </div>
          <span className="mode">
            <span aria-hidden="true" />
            {configured ? "即時資料" : "尚未連線"}
          </span>
        </header>
        {!configured && (
          <p className="notice" role="status">
            請在伺服器設定 <ApiKey name="HIREBASE_API_KEY" /> 後啟用查詢。
          </p>
        )}
        {choices.map(({ id: feature }) => (
          <div
            id={`panel-${feature}`}
            key={feature}
            hidden={active.id !== feature}
          >
            {visited.includes(feature) && (
              <FeaturePanel
                feature={feature}
                configured={configured}
                ownerMode={ownerMode}
              />
            )}
          </div>
        ))}
      </main>
    </div>
  );
}
