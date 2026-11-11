export type Field = {
  type:
    | "string"
    | "number"
    | "boolean"
    | "strings"
    | "object"
    | "objects"
    | "vectors";
  required?: boolean;
  enum?: string[];
  min?: number;
  max?: number;
  pattern?: string;
  fields?: Fields;
  hint?: string;
};
export type Fields = Record<string, Field>;
export const s = (hint = "", values?: string[]): Field => ({
  type: "string",
  hint,
  enum: values,
});
export const n = (min = 0, max = 100): Field => ({ type: "number", min, max });
export const a = (values?: string[]): Field => ({
  type: "strings",
  enum: values,
  max: 100,
});
export const b: Field = { type: "boolean" };
export const flag = s(
  "String boolean, following the conservative documented contract.",
  ["true", "false"],
);
export const req = (f: Field): Field => ({ ...f, required: true });
export const obj = (fields: Fields): Field => ({ type: "object", fields });
export const range = obj({ min: n(0, 1e9), max: n(0, 1e9) });
export const geo: Field = {
  type: "objects",
  max: 100,
  fields: { city: s(), region: s(), country: s() },
};
export const date: Field = {
  ...s("Calendar date, YYYY-MM-DD"),
  pattern: "^\\d{4}-\\d{2}-\\d{2}$",
};
export const iso: Field = {
  ...s("ISO-8601 date or timestamp"),
  pattern: "^\\d{4}-\\d{2}-\\d{2}(T.*)?$",
};
export const id = s("24-character MongoDB ObjectId");
id.pattern = "^[a-fA-F0-9]{24}$";
export const slug: Field = {
  ...s("Slug or identifier; no slashes"),
  pattern: "^[A-Za-z0-9_.-]+$",
};
export const url: Field = {
  ...s("Public HTTPS URL"),
  pattern: "^https://[^\\s]+$",
};
export const pageFields: Fields = { page: n(1, 10000), limit: n(1, 100) };
export const searchFields: Fields = {
  job_titles: a(),
  keywords: a(),
  company_keywords: a(),
  location_types: a(["Remote", "Hybrid", "In-Person"]),
  geo_locations: geo,
  geofilter_params: obj({
    mode: s("", ["auto", "weak", "strict", "box"]),
    radius: n(0, 10000),
    unit: s("", ["mi", "km", "degrees"]),
  }),
  experience: a(["Entry", "Junior", "Mid", "Senior", "Executive"]),
  yoe: range,
  include_yoe: flag,
  job_types: a(["Full Time", "Part Time", "Contract", "Internship"]),
  job_category: a(),
  company_types: a([
    "1-10",
    "11-50",
    "51-200",
    "201-500",
    "501-1000",
    "1001-5000",
    "5001-10000",
    "10000+",
  ]),
  company_sizes: a(),
  job_board: a(),
  exclude_job_board: a(),
  company_name: s(),
  company_slug: a(),
  salary: range,
  currency: s(),
  include_no_salary: flag,
  industry: a(),
  sub_industry: a(),
  days_ago: n(0, 36500),
  date_posted: date,
  ingested_after: iso,
  ingested_before: iso,
  signals: a(["reposted"]),
  visa: flag,
  hide_recruiting_agencies: flag,
  hide_seen_jobs: flag,
  user_id: id,
  filter_incomplete_jobs: flag,
  return_raw_description: flag,
  sort_by: s("", [
    "relevance",
    "date_posted",
    "first_ingested",
    "salary",
    "yoe",
  ]),
  sort_order: s("", ["asc", "desc"]),
  ...pageFields,
};
export const lexicalFields: Fields = Object.fromEntries(
  Object.entries(searchFields).filter(
    ([k]) =>
      ![
        "geofilter_params",
        "company_sizes",
        "exclude_job_board",
        "signals",
        "hide_recruiting_agencies",
        "return_raw_description",
      ].includes(k),
  ),
);
Object.assign(lexicalFields, {
  job_slug: s(),
  location_group: s("Provider has not published a complete enum."),
  date_posted: s("Relative token; calendar dates are invalid.", [
    "today",
    "last_week",
    "last_month",
  ]),
  month: {
    ...s("Accepted but not applied by provider; prefer days_ago."),
    pattern: "^\\d{4}-\\d{2}$",
  },
  include_expired: flag,
  sort_by: s("", ["relevance", "date_posted", "salary", "yoe"]),
});
export const historical: Fields = {
  job_titles: a(),
  keywords: a(),
  geo_locations: geo,
  location_group: s(),
  company_names: a(),
  company_slugs: a(),
  date_posted_from: date,
  date_posted_to: date,
  date_expired_from: date,
  date_expired_to: date,
};
export const companyFields: Fields = {
  query: s(),
  company_name: s(),
  industries: a(),
  subindustries: a(),
  company_types: a(),
  types: a(),
  hq_geolocations: geo,
  linkedin_link: url,
  keywords: a(),
  hide_recruiter_agencies: b,
  is_recruiting_agency: b,
  is_3rd_party_agency: b,
  funding_types: a(),
  parent_company: s(),
  company_link: url,
  sort_by: s("", ["hottest", "relevance", "clout", "rated", "size", "newest"]),
  sort_order: s("", ["asc", "desc"]),
  ...pageFields,
};
export const contacts: Fields = {
  job_id: req(s()),
  functions: a(),
  relationships: a([
    "hiring_manager",
    "function_leader",
    "recruiter",
    "hr",
    "executive",
    "other",
  ]),
  exclude: obj({ linkedin_urls: a(), emails: a() }),
  reveal_email: b,
  reveal_phone: b,
  version: s("", ["v1", "v2"]),
};
export const webhookSearch: Fields = Object.fromEntries(
  Object.entries(searchFields).filter(
    ([k]) =>
      ![
        "page",
        "limit",
        "sort_by",
        "sort_order",
        "ingested_after",
        "ingested_before",
      ].includes(k),
  ),
);
