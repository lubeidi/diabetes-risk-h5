# diabetes-risk-h5

H5 sub-pages for diabetes AI risk prediction. Native entry + full in-WebView flow.

## Dev

```bash
cd /Users/4paradigm/lbd/diabetes-risk-h5
npm install
npm run dev
```

Open `http://127.0.0.1:5174/?userId=test&inApp=1&tab=day`

Vite proxies `/moeagi` to `https://ai-cloud-bk.4paradigm.com/dev/ac-adapter`.

## Flow

1. **生活习惯** — lifestyle & body basics
2. **录入方式** — upload PDF or manual entry
3. **上传 / 手输** — PDF pick + moe-agi file upload, or 2-step manual form
4. **处理中** — progress UI + `analyzeSync` SSE collect
5. **结果** — markdown report + unlock sheet + ask AI chips
6. **AI 顾问** — streaming chat via `chatAdvisor`
7. **PDF 预览** — pdf.js in-page render

Prompts and API calls are ported from Android `DiabetesAiPrompt` / `DiabetesParsePrompt` / `DiabetesAiRepository`.
