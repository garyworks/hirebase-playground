import { useId } from "react";
import { ApiKey } from "./api-label";
import type { Feature } from "../lib/features";
import { geography, type Filters } from "../lib/search";

type Option = readonly [string, string];
export const countries: Option[] = [
  ["", "不限地點"],
  ["Hong Kong", "香港"],
  ["Singapore", "新加坡"],
  ["Taiwan", "台灣"],
  ["China", "中國內地"],
  ["Japan", "日本"],
  ["United States", "美國"],
  ["United Kingdom", "英國"],
  ["Canada", "加拿大"],
  ["Australia", "澳洲"],
  ["other", "其他國家／地區"],
];
const work: Option[] = [
  ["", "不限"],
  ["Remote", "遙距工作"],
  ["Hybrid", "混合辦公"],
  ["In-Person", "辦公室工作"],
];
const levels: Option[] = [
  ["", "不限"],
  ["Entry", "入門"],
  ["Junior", "初級"],
  ["Mid", "中級"],
  ["Senior", "資深"],
  ["Executive", "管理層"],
];
const employment: Option[] = [
  ["", "不限"],
  ["Full Time", "全職"],
  ["Part Time", "兼職"],
  ["Contract", "合約"],
  ["Internship", "實習"],
];
const sizes: Option[] = [
  ["", "不限"],
  ...[
    "1-10",
    "11-50",
    "51-200",
    "201-500",
    "501-1000",
    "1001-5000",
    "5001-10000",
    "10000+",
  ].map((size): Option => [size, `${size} 人`]),
];
// Documented examples, not a claim to be the provider's complete industry list.
const industries: Option[] = [
  ["", "不限"],
  ["Tech, Software & IT Services", "科技、軟件及資訊服務"],
  ["Healthcare", "醫療保健"],
];
const jobSort: Option[] = [
  ["relevance:desc", "相關程度"],
  ["date_posted:desc", "刊登日期：最新優先"],
  ["date_posted:asc", "刊登日期：最早優先"],
  ["salary:desc", "薪酬：由高至低"],
  ["salary:asc", "薪酬：由低至高"],
  ["yoe:asc", "經驗要求：由少至多"],
];
const companySort: Option[] = [
  ["relevance:desc", "相關程度"],
  ["size:desc", "公司規模：由大至小"],
  ["size:asc", "公司規模：由小至大"],
  ["newest:desc", "最近成立的公司優先"],
];
const limits: Option[] = [
  ["5", "5 筆"],
  ["10", "10 筆"],
  ["25", "25 筆"],
];

type Props = {
  feature: Feature;
  kind: string;
  value: Filters;
  onChange: (value: Filters) => void;
};
export function SearchFilters({ feature, kind, value: f, onChange }: Props) {
  const id = useId();
  const semantic = feature === "resume" || kind === "idea";
  const jobLike = ["jobs", "market", "resume"].includes(feature);
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    onChange(
      key === "country"
        ? {
            ...f,
            country: String(value),
            customCountry: "",
            city: "",
            region: "",
          }
        : { ...f, [key]: value },
    );
  const prefix = semantic ? "lexical." : "";
  const geoKey =
    feature === "companies" ? "hq_geolocations" : prefix + "geo_locations";
  const yearsKey = feature === "salary" ? "yoe_range" : prefix + "yoe";
  const agencyKey =
    feature === "companies"
      ? "hide_recruiter_agencies"
      : "hide_recruiting_agencies";
  const select = (
    label: string,
    key: keyof Filters,
    apiKey: string,
    options: Option[],
  ) => (
    <label>
      {label} <ApiKey name={apiKey} />
      <select
        value={String(f[key])}
        onChange={(event) => set(key, event.target.value)}
      >
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}（
            {value === "other"
              ? "使用下方輸入值"
              : value
                ? key === "sort"
                  ? value.split(":").join(" / ")
                  : value
                : "省略欄位"}
            ）
          </option>
        ))}
      </select>
    </label>
  );
  const input = (
    label: string,
    key: keyof Filters,
    apiKey: string,
    placeholder = "",
    type = "text",
  ) => (
    <label>
      {label} <ApiKey name={apiKey} />
      <input
        type={type}
        value={String(f[key])}
        placeholder={placeholder}
        maxLength={200}
        min={type === "number" ? 0 : undefined}
        max={
          type === "number" ? (key.startsWith("years") ? 100 : 1e9) : undefined
        }
        step={type === "number" ? "1" : undefined}
        onChange={(event) => set(key, event.target.value)}
      />
    </label>
  );
  const check = (
    label: string,
    key: "hideAgencies" | "visa" | "includeNoSalary",
    apiKey: string,
    checkedValue: string,
    uncheckedValue = "省略欄位",
  ) => (
    <label className="choice">
      <input
        type="checkbox"
        checked={f[key]}
        onChange={(event) => set(key, event.target.checked)}
      />
      <span>
        {label} <ApiKey name={apiKey} />
        <small className="api-values">
          勾選 {checkedValue} · 未勾選 {uncheckedValue}
        </small>
      </span>
    </label>
  );
  if (feature === "jobs" && kind === "link")
    return <p className="caption">按招聘連結查找職位，無需設定篩選條件。</p>;
  const moreCount = [
    f.keywords,
    f.company,
    f.size,
    f.industry,
    f.salaryMin || f.salaryMax,
    f.yearsMin || f.yearsMax,
    !semantic && f.geoMode,
    f.visa,
    !semantic && f.hideAgencies,
  ].filter(Boolean).length;
  return (
    <>
      <div className="form-section">
        <h3>
          {feature === "companies" ? "公司總部地點" : "工作地點"}{" "}
          <ApiKey name={geoKey} />
        </h3>
        <div className="form-grid three">
          {select("國家／地區", "country", geoKey + "[].country", countries)}
          <label>
            城市 <ApiKey name={geoKey + "[].city"} />
            <input
              value={f.city}
              list={`${id}-cities`}
              placeholder="不限，可自行輸入"
              maxLength={200}
              onChange={(event) => set("city", event.target.value)}
            />
            <datalist id={`${id}-cities`}>
              {(f.country === "Hong Kong"
                ? ["Hong Kong"]
                : f.country === "Singapore"
                  ? ["Singapore"]
                  : f.country === "United States"
                    ? ["New York", "San Francisco", "Seattle", "Austin"]
                    : f.country === "United Kingdom"
                      ? ["London", "Manchester"]
                      : f.country === "Australia"
                        ? ["Sydney", "Melbourne"]
                        : []
              ).map((city) => (
                <option key={city} value={city} />
              ))}
            </datalist>
          </label>
          {input(
            "省／州／區域",
            "region",
            geoKey + "[].region",
            "不限，例如 California",
          )}
        </div>
        {f.country === "other" && (
          <label>
            國家／地區名稱 <ApiKey name={geoKey + "[].country"} />
            <input
              value={f.customCountry}
              required
              placeholder="例如 Germany"
              maxLength={200}
              onChange={(event) => set("customCountry", event.target.value)}
            />
          </label>
        )}
        {f.country === "Hong Kong" && (
          <p className="caption">香港地理資料曾出現不一致，結果仍需核對。</p>
        )}
      </div>
      {(jobLike || feature === "salary") && (
        <div className="form-section">
          <h3>工作條件 {semantic && <ApiKey name="lexical" />}</h3>
          <div className="form-grid three">
            {select("工作模式", "work", prefix + "location_types", work)}
            {select(
              "經驗級別",
              "level",
              feature === "salary"
                ? "experience_levels"
                : prefix + "experience",
              levels,
            )}
            {jobLike &&
              select(
                "聘用類型",
                "employment",
                prefix + "job_types",
                employment,
              )}
            {select("刊登時間", "recent", prefix + "days_ago", [
              ...(feature !== "salary" ? [["", "不限時間"] as Option] : []),
              ["1", "最近 24 小時"],
              ["7", "最近 7 日"],
              ["30", "最近 30 日"],
              ["90", "最近 90 日"],
              ["365", "最近一年"],
            ])}
          </div>
        </div>
      )}
      {feature === "history" && (
        <div className="form-section">
          <h3>招聘紀錄</h3>
          <div className="form-grid two">
            <label>
              開始日期 <ApiKey name="date_posted_from" />
              <input
                type="date"
                required
                value={f.since}
                max={f.until || undefined}
                onChange={(event) => set("since", event.target.value)}
              />
            </label>
            <label>
              結束日期 <ApiKey name="date_posted_to" />
              <input
                type="date"
                value={f.until}
                min={f.since}
                onChange={(event) => set("until", event.target.value)}
              />
            </label>
            {input("公司名稱", "company", "company_names", "不限公司")}
            {input("關鍵字", "keywords", "keywords", "例如 Python、SQL")}
          </div>
        </div>
      )}
      {feature === "companies" ? (
        <div className="form-section">
          <h3>公司條件</h3>
          <div className="form-grid two">
            {select("公司規模", "size", prefix + "company_types", sizes)}
            {select("行業", "industry", "industries", industries)}
          </div>
          {check(
            "排除招聘中介公司",
            "hideAgencies",
            agencyKey,
            "true",
            "false",
          )}
        </div>
      ) : (
        feature !== "history" && (
          <details className="more-filters">
            <summary>
              更多篩選
              {moreCount > 0 && <span className="count">{moreCount}</span>}
            </summary>
            <div className="filter-content">
              <div className="form-grid two">
                {jobLike &&
                  input(
                    "公司名稱",
                    "company",
                    prefix + "company_name",
                    "不限公司",
                  )}
                {jobLike &&
                  input(
                    "技能／關鍵字",
                    "keywords",
                    prefix + "keywords",
                    "以逗號分隔，例如 Python、SQL",
                  )}
                {jobLike &&
                  select("公司規模", "size", prefix + "company_types", sizes)}
                {select("行業", "industry", prefix + "industry", industries)}
                {input(
                  "最低經驗年數",
                  "yearsMin",
                  yearsKey + ".min",
                  "不限",
                  "number",
                )}
                {input(
                  "最高經驗年數",
                  "yearsMax",
                  yearsKey + ".max",
                  "不限",
                  "number",
                )}
              </div>
              {jobLike && (
                <>
                  <h4>
                    薪酬範圍 <ApiKey name={prefix + "salary"} />
                  </h4>
                  <div className="form-grid three">
                    {select("貨幣", "currency", prefix + "currency", [
                      ["USD", "美元"],
                      ["HKD", "港元"],
                      ["SGD", "新加坡元"],
                      ["GBP", "英鎊"],
                      ["EUR", "歐元"],
                      ["AUD", "澳元"],
                      ["CAD", "加元"],
                    ])}
                    {input(
                      "最低薪酬",
                      "salaryMin",
                      prefix + "salary.min",
                      "不限",
                      "number",
                    )}
                    {input(
                      "最高薪酬",
                      "salaryMax",
                      prefix + "salary.max",
                      "不限",
                      "number",
                    )}
                  </div>
                  <p className="caption">
                    按來源薪酬數值篩選；來源未明確統一月薪或年薪，請核對職位所列單位。
                  </p>
                  {check(
                    "薪酬篩選同時包含未列明薪酬的職位",
                    "includeNoSalary",
                    prefix + "include_no_salary",
                    '"true"',
                    '"false"',
                  )}
                </>
              )}
              {jobLike && !semantic && (
                <>
                  <h4>
                    地點範圍 <ApiKey name="geofilter_params" />
                  </h4>
                  <div className="form-grid two">
                    {select(
                      "地點比對方式",
                      "geoMode",
                      "geofilter_params.mode",
                      [
                        ["", "一般比對（包含鄰近地區）"],
                        ["strict", "嚴格比對"],
                        ["weak", "按距離搜尋"],
                      ],
                    )}
                    {f.geoMode === "weak" && (
                      <label>
                        搜尋半徑（公里）{" "}
                        <ApiKey name={'geofilter_params.radius · unit="km"'} />
                        <input
                          type="number"
                          min="1"
                          max="10000"
                          value={f.radius}
                          placeholder="例如 25"
                          required={Boolean(geography(f))}
                          onChange={(event) =>
                            set("radius", event.target.value)
                          }
                        />
                      </label>
                    )}
                  </div>
                  {f.geoMode && !geography(f) && (
                    <p className="caption">請先填寫地點，才會套用比對方式。</p>
                  )}
                </>
              )}
              {jobLike && (
                <div className="checkboxes">
                  {check(
                    "需要提供工作簽證支援",
                    "visa",
                    prefix + "visa",
                    '"true"',
                  )}
                  {!semantic &&
                    check(
                      "排除招聘中介職位",
                      "hideAgencies",
                      agencyKey,
                      '"true"',
                    )}
                </div>
              )}
            </div>
          </details>
        )
      )}
      {(["jobs", "resume", "companies"].includes(feature) ||
        feature === "history") && (
        <div className="form-section">
          <div className="form-grid two">
            {feature !== "history" &&
              select(
                "排序方式",
                "sort",
                prefix + "sort_by / " + prefix + "sort_order",
                feature === "companies" ? companySort : jobSort,
              )}
            {select(
              feature === "history" ? "職位例子數量" : "每頁顯示",
              "limit",
              feature === "history" ? "sample_size" : prefix + "limit",
              limits,
            )}
          </div>
        </div>
      )}
    </>
  );
}
