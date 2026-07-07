/**
 * Report access gate — aligned with Android DiabetesReportAccess.kt
 */
(function (global) {
  "use strict";

  var REQUIRE_AI_VIP_FOR_REPORT = false;

  function isFullReportUnlocked(isVip) {
    if (!REQUIRE_AI_VIP_FOR_REPORT) return true;
    return !!isVip;
  }

  global.DiabetesReportAccess = {
    isFullReportUnlocked: isFullReportUnlocked,
  };
})(typeof window !== "undefined" ? window : globalThis);
