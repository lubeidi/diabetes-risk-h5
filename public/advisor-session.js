/**
 * Advisor session — aligned with Android DiabetesAdvisorSession.kt
 */
(function (global) {
  "use strict";

  var reportUserMessage = "";
  var reportAssistantMessage = "";
  var reportPrimaryFileId = "";
  var visibleChatHistory = [];
  var active = false;

  function setReportContext(reportAnswer, userPrompt, primaryFileId, resetFileId) {
    reportUserMessage = userPrompt || "";
    reportAssistantMessage = global.DiabetesThinkingFilter.strip(reportAnswer || "");
    if (resetFileId) {
      reportPrimaryFileId = primaryFileId || "";
    } else if (primaryFileId && !reportPrimaryFileId) {
      reportPrimaryFileId = primaryFileId;
    }
    active = true;
  }

  function beginResultSession(reportAnswer, userPrompt, primaryFileId) {
    setReportContext(reportAnswer, userPrompt, primaryFileId, true);
    visibleChatHistory = [];
  }

  function hasReportContext() {
    return !!(reportAssistantMessage && reportUserMessage);
  }

  function ensureReportContext(reportAnswer, userPrompt, primaryFileId) {
    if (!reportAnswer) return;
    if (!hasReportContext()) {
      setReportContext(reportAnswer, userPrompt, primaryFileId, true);
      return;
    }
    if (primaryFileId && !reportPrimaryFileId) {
      reportPrimaryFileId = primaryFileId;
    }
  }

  function isActive() {
    return active;
  }

  function contextForApi() {
    var list = [];
    if (reportAssistantMessage) {
      var userContent = reportUserMessage;
      if (reportPrimaryFileId) {
        userContent = [
          {
            type: "text",
            text:
              reportUserMessage +
              (global.DiabetesAiPrompt && global.DiabetesAiPrompt.PDF_EVALUATION_HINT
                ? global.DiabetesAiPrompt.PDF_EVALUATION_HINT
                : ""),
          },
          { type: "file", file: { file_id: reportPrimaryFileId } },
        ];
      }
      list.push({ role: "user", content: userContent });
      list.push({ role: "assistant", content: reportAssistantMessage });
    }
    visibleChatHistory.forEach(function (pair) {
      list.push({ role: pair[0], content: pair[1] });
    });
    return list;
  }

  function visibleMessages() {
    return visibleChatHistory.slice();
  }

  function appendExchange(user, assistant) {
    visibleChatHistory.push(["user", user]);
    visibleChatHistory.push(["assistant", assistant]);
  }

  function clear() {
    active = false;
    reportUserMessage = "";
    reportAssistantMessage = "";
    reportPrimaryFileId = "";
    visibleChatHistory = [];
  }

  global.DiabetesAdvisorSession = {
    beginResultSession: beginResultSession,
    ensureReportContext: ensureReportContext,
    hasReportContext: hasReportContext,
    isActive: isActive,
    contextForApi: contextForApi,
    visibleMessages: visibleMessages,
    appendExchange: appendExchange,
    clear: clear,
  };
})(typeof window !== "undefined" ? window : globalThis);
