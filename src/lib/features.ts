import { plainText } from "./response";

export type Item = Record<string, unknown>;
export type Feature =
  | "jobs"
  | "companies"
  | "market"
  | "salary"
  | "resume"
  | "people"
  | "history"
  | "saved";
export const features: {
  id: Feature;
  label: string;
  icon: string;
  heading: string;
  description: string;
}[] = [
  {
    id: "jobs",
    label: "職位搜尋",
    icon: "search",
    heading: "職位搜尋",
    description: "按職位名稱、工作條件或招聘連結搜尋，並查看職位詳情。",
  },
  {
    id: "companies",
    label: "公司資料",
    icon: "building",
    heading: "公司資料",
    description: "搜尋公司，查看公司介紹及招聘職位。",
  },
  {
    id: "market",
    label: "市場趨勢",
    icon: "chart",
    heading: "市場趨勢",
    description: "查詢招聘數量、技能分佈、薪酬及遙距工作比例。",
  },
  {
    id: "salary",
    label: "薪酬參考",
    icon: "wallet",
    heading: "薪酬參考",
    description: "輸入職位與地點，查看刊登薪酬的統計結果。",
  },
  {
    id: "resume",
    label: "履歷配對",
    icon: "document",
    heading: "履歷分析與職位配對",
    description: "分析履歷、查看技能與經歷摘要，再搜尋配對職位。",
  },
  {
    id: "people",
    label: "招聘團隊",
    icon: "people",
    heading: "招聘團隊",
    description: "查看與職位相關的招聘角色；目前僅提供虛構示例。",
  },
  {
    id: "history",
    label: "招聘歷程",
    icon: "clock",
    heading: "招聘歷程",
    description: "了解公司或職位的歷年招聘活動與需求變化。",
  },
  {
    id: "saved",
    label: "已收藏職位",
    icon: "bookmark",
    heading: "已收藏職位",
    description: "收藏清單只保留於這次瀏覽；重新載入後便會清空。",
  },
];
export function object(value: unknown): Item {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Item)
    : {};
}
export function items(value: unknown): Item[] {
  return Array.isArray(value)
    ? (value.filter(
        (v) => v && typeof v === "object" && !Array.isArray(v),
      ) as Item[])
    : [];
}
const labels: Record<string, string> = {
  "Hong Kong": "香港",
  Singapore: "新加坡",
  "United States": "美國",
  "United Kingdom": "英國",
  Canada: "加拿大",
  Australia: "澳洲",
  Remote: "遙距工作",
  Hybrid: "混合辦公",
  "In-Person": "辦公室工作",
  "Full Time": "全職",
  "Part Time": "兼職",
  Contract: "合約",
  Internship: "實習",
  Entry: "入門",
  Junior: "初級",
  Mid: "中級",
  Senior: "資深",
  Executive: "管理層",
  Startup: "初創企業",
  monthly: "月",
  yearly: "年",
  annually: "年",
  annual: "年",
  hourly: "小時",
  weekly: "週",
  daily: "日",
  "Tech, Software & IT Services": "科技、軟件及資訊服務",
  "AI & ML": "人工智能與機器學習",
  "Distributed systems": "分散式系統",
};
export function translate(value: string) {
  return labels[value] ?? value;
}
export function words(value: unknown): string {
  return typeof value === "string"
    ? translate(plainText(value))
    : typeof value === "number"
      ? String(value)
      : "";
}
export function number(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString()
    : "暫無資料";
}
export function safeLink(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  try {
    const u = new URL(value);
    if (["https:", "http:"].includes(u.protocol)) return u.href;
  } catch {}
}
export function jobKey(job: Item) {
  return (
    words(job._id ?? job.id) ||
    `${words(job.company_name)}:${words(job.job_title)}`
  );
}
export function location(value: unknown) {
  return items(value)
    .map((x) =>
      [words(x.city), words(x.region), words(x.country)]
        .filter((x, i, a) => x && a.indexOf(x) === i)
        .join(", "),
    )
    .filter(Boolean)
    .join(" · ");
}
export function pay(value: unknown) {
  const v = object(value);
  const low = typeof v.min === "number" ? number(v.min) : "";
  const high = typeof v.max === "number" ? number(v.max) : "";
  return low || high
    ? `${words(v.currency)} ${low}${low && high ? " – " : ""}${high}${v.period ? " / " + words(v.period) : ""}`
    : "未列明薪酬";
}
export type SearchValues = {
  query: string;
  country: string;
  work: string;
  level: string;
  employment: string;
  recent: string;
  kind: "title" | "idea" | "link";
};
export function jobSearch(v: SearchValues, page = 1) {
  const filters: Item = { page, limit: 5 };
  if (v.country) filters.geo_locations = [{ country: v.country }];
  if (v.work) filters.location_types = [v.work];
  if (v.level) filters.experience = [v.level];
  if (v.employment) filters.job_types = [v.employment];
  if (v.recent) filters.days_ago = Number(v.recent);
  if (v.kind === "link")
    return { operationId: "lookup", input: { urls: [v.query.trim()] } };
  if (v.kind === "idea")
    return {
      operationId: "neural",
      input: { vector: { query: v.query.trim() }, lexical: filters },
    };
  if (v.query.trim()) filters.job_titles = [v.query.trim()];
  return { operationId: "search", input: filters };
}
export function friendlyError(
  status: number,
  headers: Record<string, string> = {},
) {
  if (status === 429)
    return headers["x-billing-code"] === "limit_exceeded"
      ? "此工作區的服務額度已用完，請待額度更新後再試。"
      : "操作次數較多，請稍候片刻再試。";
  if (status === 401 || status === 503)
    return "暫時未能連接即時資料，請聯絡管理者。";
  if (status === 403 || status === 402)
    return "此工作區暫未開通這項功能，請聯絡管理者。";
  if (status === 404) return "找不到這項資料，它可能已不再提供。";
  if (status === 400 || status === 422)
    return "部分資料未能使用，請檢查選項後再試。";
  return "暫時未能完成操作，請稍後再試。";
}

export function resumeMatch(resumeId: string) {
  return { vector: { artifact_id: resumeId }, lexical: { page: 1, limit: 5 } };
}
