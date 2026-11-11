# Hirebase｜功能測試

保留 `hirebase-streamlit` 的簡潔流程，使用獨立設計的側欄按鈕、搜尋分頁與分組表單。主畫面一次顯示一個功能，按下操作按鈕後才顯示表格或文字結果。全介面使用繁體中文，常用篩選直接顯示，其餘放在「更多篩選」。切換功能會保留輸入與結果，重新整理後清空。保留 Next.js 與現有伺服器連線。

本專案獨立於 Streamlit、AICon、job-source-lab 及 Railway，僅供本機使用，沒有部署。

## Run locally

Requires Node.js 20.9 or later and npm.

```bash
npm ci
cp -n .env.example .env.local
npm run dev
```

Open [http://127.0.0.1:3100](http://127.0.0.1:3100). Before running a query, set `HIREBASE_API_KEY` in `.env.local` and restart. The key is read by the server only; never use a `NEXT_PUBLIC_` variable. The UI receives only whether a key is configured.

Set `HIREBASE_OWNER_MODE=true` locally to enable resume processing, task reads and usage reads. Resume upload stores the file with Hirebase; parsing updates that stored record. Embedding is documented as stateless. Owner mode is an intentional local capability gate, not user authentication. Keep this app bound to loopback; do not deploy or expose it through a tunnel.

## 功能

- **職位搜尋**：名稱、文字條件或招聘連結。支援國家／城市／省州、工作模式、經驗、聘用類型、刊登時間、公司、關鍵字、規模、行業、薪酬及簽證篩選；名稱搜尋另支援嚴格地點比對、公里範圍及排除中介。可按相關程度、日期、薪酬或經驗排序，每頁 5／10／25 筆並手動翻頁。
- **公司資料**：按名稱、總部地點、規模、行業及中介排除條件搜尋，支援相關程度、規模與成立時間排序及翻頁。
- **市場趨勢**：套用工作及地點條件查詢招聘數量、技能及招聘公司，預設最近 30 日。
- **薪酬參考**：依地點、工作模式、經驗、行業及刊登時間建立報告，再手動查看進度與年薪統計；即時操作需啟用 owner mode。
- **招聘歷程**：依日期範圍、地點、公司及關鍵字查看歷年統計及職位名稱例子。

測試頁只使用即時資料。未設定伺服器金鑰時會顯示設定提示及停用查詢。各功能標示 Hirebase 的 API 名稱、HTTP 方法及路徑，各表單標示實際送出的欄位與選項值。所有查詢由按鈕觸發。

The [capability inventory](CAPABILITIES.md) remains repository documentation for the 46 underlying operations and their access restrictions. The page labels the endpoints used by its workflows. Administrative, export, billing, webhook and unavailable technology operations have no user-facing controls.

## Access and safety

- The server permits only catalogued operations on `https://api.hirebase.org`, with `x-api-key` attached upstream. It rejects arbitrary destinations and redirects.
- Requests require a matching loopback Origin/Host. The default dev and production start commands bind to `127.0.0.1:3100`.
- Exports, historical purchases, hiring contact research/reveals, webhook subscriptions/delivery tests and signing-secret endpoints are disabled for live requests. Test fixtures exercise their sample behavior. Technology APIs are marked unavailable because the provider documents them as coming soon.
- Requests default to 5 results and cap at 100. Some provider limits are larger or undocumented. Search estimates allow `limit: 0` without fetching records. Resume files are limited to one supported file of at most 5 MB.
- Search uses strict allowlisted fields and string boolean flags where documented. Neural search has a separate nested vector/lexical schema and pagination inside `lexical`. Unknown fields are rejected locally.
- Email notifications are disabled. No checkout, paid bulk job, subscription or contact-reveal request is submitted.
- Data stays in browser memory for the current page. There is no localStorage, browser database, request log or saved response history. Responses use `no-store`. No credentials are saved by the app.
- Known contact fields, signed download/checkout links, signing secrets and reflected API keys are redacted before reaching the browser. The interface displays only relevant user-facing information. This redaction is not a general anonymization guarantee.
- Job HTML is rendered as escaped plain text. Quota exhaustion and rate limiting have distinct messages, including manual retry guidance. Network exceptions never expose upstream exception strings.

## Evidence and known limitations

Contracts were checked on 11 November 2026 against the [official documentation](https://www.hirebase.org/docs), its [index](https://www.hirebase.org/docs/llms.txt), endpoint pages and the webhook guide. `/Users/gary/Downloads/Hirebase-API-Capability-Overview.md` was read first as supplied documentation, not treated as proof of live behavior.

No authenticated live requests were made from this project during implementation. Validation so far consists of local fixtures, mocked upstream responses, production compilation and browser checks. Account entitlement, billing behavior, real payload differences and live coverage still need explicit testing with the user's key.

Earlier job-source-lab findings recorded in Notion reported Hirebase HK location mismatches, including conflicts between normalized and raw location fields. Those findings remain unresolved. The HK/Singapore presets and fictional HK jobs here do not validate coverage or supersede that evidence.

Provider caveats represented in the explorer include:

- Company job pages may overlap, and accepted sorting fields are not applied. Do not interpret page counts as a count of distinct roles.
- Neural counts cap at 2,500; company search counts cap at 1,001.
- Historical search returns counts, sample titles and a quote, rather than full archived jobs.
- Expired-job reads return identifiers within a 14-day window. Daily usage accepts both dates together with a maximum of 90 inclusive days.
- Export JSON means NDJSON; expired exports are JSONL. Exports remain illustrative only.
- Resume embedding documentation conflicts about whether parsed resume data accompanies the embedding. The API catalog also covers stored resume upload and parsing.
- Public reference pages also document authentication error cases. This app permits explicit keyless reference requests but reports any provider error honestly.
- Technology endpoints and future technology filters remain unavailable. Some webhook response schemas are unspecified and are not invented as validated contracts.

## Verify and maintain

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

Tests cover strict contracts, search mapping, the initial empty form, required key state, API field labels, table renderers, safe posting links, fixed routing, same-origin checks, file limits, owner/sample restrictions, mocked upstream transport, redaction, rate/quota errors and task fixtures. Chrome checks of the redesigned interface cover sample search, pagination and feature navigation. These are not authenticated provider integration tests.

The end-user interface lives in `src/components/playground.tsx`; display helpers and user-search mapping live in `src/lib/features.ts`. The operation catalog lives in `src/lib/catalog.ts`; field definitions and validation live in `src/lib/fields.ts` and `src/lib/validation.ts`. The transport is in `src/lib/server.ts` and `src/app/api/hirebase/route.ts`. Fixtures are in `src/lib/samples.ts`. Update the catalog, validation and relevant tests together when the official contracts change.

## Filter mapping

Controls submit only on explicit actions. Pagination preserves the last submitted conditions; a new search returns to page 1. Resetting filters preserves the query and previous results without requesting data. URL lookup has no filter controls. Aggregate reports and history have no unsupported sorting controls. Industry options currently contain the documented technology and healthcare examples, not the complete provider list. Salary ranges retain source values and the chosen currency without assuming a standardized salary period.

The mapping in `src/lib/search.ts` follows the official [job search](https://www.hirebase.org/docs/api-reference/jobs/search-post), [neural search](https://www.hirebase.org/docs/api-reference/jobs/neural-search-post), [company search](https://www.hirebase.org/docs/api-reference/companies/search-companies), [market insights](https://www.hirebase.org/docs/api-reference/jobs/insights) and [salary benchmark](https://www.hirebase.org/docs/api-reference/jobs/salary-benchmark) contracts. No authenticated live requests were made during this update.
