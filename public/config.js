/**
 * diabetes-risk-h5 runtime config.
 * Production: overridden by Helm ConfigMap (DIABETES_API_BASE = {apiBaseUrl}/moeagi).
 * Local dev: vite proxies /moeagi -> ac-adapter (see vite.config.js).
 *
 * Align with Android MoeAgiConfig:
 *   dev/dev2  -> .../dev/ac-adapter, .../dev2/ac-adapter
 *   preview   -> .../preview/ac-adapter
 *   stable    -> .../ac-adapter
 */
(function (global) {
  "use strict";

  global.DIABETES_API_BASE = global.DIABETES_API_BASE || "/moeagi";
  global.DIABETES_API_AUTH =
    global.DIABETES_API_AUTH || "Basic bGxtOlJtZjQjTGNHKGlGWnJqVTsySg==";
  global.DIABETES_MODEL = global.DIABETES_MODEL || "phanthy-lite";
  global.DIABETES_EXPERT = global.DIABETES_EXPERT || "expert-phanthy-diabetes_predict";
  global.DIABETES_LANGUAGE = global.DIABETES_LANGUAGE || "zh";
  global.DIABETES_MAX_FILES = global.DIABETES_MAX_FILES || 2;
  global.DIABETES_MAX_FILE_BYTES = global.DIABETES_MAX_FILE_BYTES || 100 * 1024 * 1024;

  // Browser-only tracking fallback (production uses Native bridge).
  // Override in Helm ConfigMap for test / overseas hosts.
  if (!global.DIABETES_TRACKING_PUSH_URL) {
    global.DIABETES_TRACKING_PUSH_URL =
      global.__IS_OVERSEAS__ === true
        ? "https://micro-life.iwhop.com/microLife/tracking/push"
        : "https://micro-life.iwhop.cn/microLife/tracking/push";
  }
})(typeof window !== "undefined" ? window : globalThis);
