import { object, type Feature, type Item } from "./features";

export type Filters = {
  country: string;
  customCountry: string;
  city: string;
  region: string;
  work: string;
  level: string;
  employment: string;
  recent: string;
  company: string;
  keywords: string;
  size: string;
  industry: string;
  salaryMin: string;
  salaryMax: string;
  currency: string;
  includeNoSalary: boolean;
  yearsMin: string;
  yearsMax: string;
  hideAgencies: boolean;
  visa: boolean;
  geoMode: string;
  radius: string;
  sort: string;
  limit: string;
  since: string;
  until: string;
};
export type SearchRequest = { operationId: string; input: Item };
export function defaultFilters(feature: Feature): Filters {
  return {
    country: "",
    customCountry: "",
    city: "",
    region: "",
    work: "",
    level: "",
    employment: "",
    recent: feature === "market" ? "30" : feature === "salary" ? "90" : "",
    company: "",
    keywords: "",
    size: "",
    industry: "",
    salaryMin: "",
    salaryMax: "",
    currency: "USD",
    includeNoSalary: false,
    yearsMin: "",
    yearsMax: "",
    hideAgencies: false,
    visa: false,
    geoMode: "",
    radius: "",
    sort: "relevance:desc",
    limit: "5",
    since: "2024-01-01",
    until: "",
  };
}
export function geography(f: Filters) {
  const country = (f.country === "other" ? f.customCountry : f.country).trim();
  const value = {
    ...(country ? { country } : {}),
    ...(f.city.trim() ? { city: f.city.trim() } : {}),
    ...(f.region.trim() ? { region: f.region.trim() } : {}),
  };
  return Object.keys(value).length ? [value] : undefined;
}
function range(min: string, max: string) {
  return {
    ...(min.trim() ? { min: Number(min) } : {}),
    ...(max.trim() ? { max: Number(max) } : {}),
  };
}
function terms(text: string) {
  return text
    .split(/[,，、\n]/)
    .map((value) => value.trim())
    .filter(Boolean);
}
function ordering(f: Filters) {
  const [sort_by, sort_order] = f.sort.split(":");
  return { sort_by, sort_order };
}
function jobFilters(f: Filters, semantic: boolean): Item {
  const geo = geography(f);
  return {
    ...(geo ? { geo_locations: geo } : {}),
    ...(geo && !semantic && f.geoMode
      ? {
          geofilter_params: {
            mode: f.geoMode,
            ...(f.geoMode === "weak" && f.radius
              ? { radius: Number(f.radius), unit: "km" }
              : {}),
          },
        }
      : {}),
    ...(f.work ? { location_types: [f.work] } : {}),
    ...(f.level ? { experience: [f.level] } : {}),
    ...(f.employment ? { job_types: [f.employment] } : {}),
    ...(f.recent ? { days_ago: Number(f.recent) } : {}),
    ...(f.company.trim() ? { company_name: f.company.trim() } : {}),
    ...(terms(f.keywords).length ? { keywords: terms(f.keywords) } : {}),
    ...(f.size ? { company_types: [f.size] } : {}),
    ...(f.industry ? { industry: [f.industry] } : {}),
    ...(f.salaryMin || f.salaryMax
      ? {
          salary: range(f.salaryMin, f.salaryMax),
          currency: f.currency,
          include_no_salary: String(f.includeNoSalary),
        }
      : {}),
    ...(f.yearsMin || f.yearsMax ? { yoe: range(f.yearsMin, f.yearsMax) } : {}),
    ...(f.hideAgencies && !semantic
      ? { hide_recruiting_agencies: "true" }
      : {}),
    ...(f.visa ? { visa: "true" } : {}),
  };
}
export function featureRequest(
  feature: Feature,
  query: string,
  f: Filters,
  kind = "title",
  resumeId = "",
): SearchRequest {
  const geo = geography(f);
  const title = query.trim();
  if (feature === "jobs" && kind === "link")
    return { operationId: "lookup", input: { urls: [title] } };
  if (feature === "jobs" || feature === "resume") {
    const semantic = kind === "idea" || feature === "resume";
    const filters = {
      ...jobFilters(f, semantic),
      ...ordering(f),
      page: 1,
      limit: Number(f.limit),
    };
    return semantic
      ? {
          operationId: "neural",
          input: {
            vector:
              feature === "resume"
                ? { artifact_id: resumeId }
                : { query: title },
            lexical: filters,
          },
        }
      : {
          operationId: "search",
          input: { ...filters, ...(title ? { job_titles: [title] } : {}) },
        };
  }
  if (feature === "companies")
    return {
      operationId: "companies",
      input: {
        ...(title ? { query: title } : {}),
        ...(geo ? { hq_geolocations: geo } : {}),
        ...(f.size ? { company_types: [f.size] } : {}),
        ...(f.industry ? { industries: [f.industry] } : {}),
        hide_recruiter_agencies: f.hideAgencies,
        ...ordering(f),
        page: 1,
        limit: Number(f.limit),
      },
    };
  if (feature === "market")
    return {
      operationId: "insights",
      input: {
        ...jobFilters(f, false),
        ...(title ? { job_titles: [title] } : {}),
        top_companies_limit: 5,
      },
    };
  if (feature === "salary")
    return {
      operationId: "salary",
      input: {
        job_title: title,
        ...(geo ? { geo_locations: geo } : {}),
        ...(f.work ? { location_types: [f.work] } : {}),
        ...(f.level ? { experience_levels: [f.level] } : {}),
        ...(f.industry ? { industry: [f.industry] } : {}),
        ...(f.yearsMin || f.yearsMax
          ? { yoe_range: range(f.yearsMin, f.yearsMax) }
          : {}),
        days_ago: Number(f.recent || 90),
        notify: false,
      },
    };
  if (feature === "history")
    return {
      operationId: "historical",
      input: {
        ...(title ? { job_titles: [title] } : {}),
        ...(geo ? { geo_locations: geo } : {}),
        ...(f.company.trim() ? { company_names: [f.company.trim()] } : {}),
        ...(terms(f.keywords).length ? { keywords: terms(f.keywords) } : {}),
        date_posted_from: f.since,
        ...(f.until ? { date_posted_to: f.until } : {}),
        sample_size: Number(f.limit),
      },
    };
  throw new Error("Unsupported search feature");
}
export function filterError(feature: Feature, f: Filters, kind = "title") {
  if (feature === "jobs" && kind === "link") return "";
  if (f.country === "other" && !f.customCountry.trim())
    return "請填寫國家／地區名稱。";
  if (feature !== "companies" && feature !== "history") {
    if (f.yearsMin && f.yearsMax && Number(f.yearsMin) > Number(f.yearsMax))
      return "最低經驗年數不可大於最高年數。";
    if (
      feature !== "salary" &&
      f.salaryMin &&
      f.salaryMax &&
      Number(f.salaryMin) > Number(f.salaryMax)
    )
      return "最低薪酬不可大於最高薪酬。";
  }
  if (feature === "history" && f.until && f.since > f.until)
    return "開始日期不可晚於結束日期。";
  return "";
}
export function pageRequest(
  request: SearchRequest,
  page: number,
): SearchRequest {
  return {
    operationId: request.operationId,
    input:
      request.operationId === "neural"
        ? {
            ...request.input,
            lexical: { ...object(request.input.lexical), page },
          }
        : { ...request.input, page },
  };
}
export function pagination(request: SearchRequest, data: Item) {
  const values =
    request.operationId === "neural"
      ? object(request.input.lexical)
      : request.input;
  const page = Number(values.page ?? 1),
    limit = Number(values.limit ?? 5);
  const count = Array.isArray(data.jobs)
    ? data.jobs.length
    : Array.isArray(data.companies)
      ? data.companies.length
      : 0;
  const total =
    typeof data.total_count === "number" ? data.total_count : undefined;
  const pages =
    typeof data.total_pages === "number"
      ? data.total_pages
      : total !== undefined
        ? Math.ceil(total / limit)
        : undefined;
  return {
    page,
    count,
    total,
    hasNext: count > 0 && (pages !== undefined ? page < pages : count >= limit),
  };
}
