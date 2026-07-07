/**
 * Advisor session — aligned with Android DiabetesAdvisorSession.kt
 */
(function (global) {
  "use strict";

  var reportUserMessage = "";
  var reportAssistantMessage = "";
  var visibleChatHistory = [];
  var active = false;

  function beginResultSession(reportAnswer, userPrompt) {
    reportUserMessage = userPrompt || "";
    reportAssistantMessage = global.DiabetesThinkingFilter.strip(reportAnswer || "");
    visibleChatHistory = [];
    active = true;
  }

  function isActive() {
    return active;
  }

  function contextForApi() {
    var list = [];
    if (reportAssistantMessage) {
      list.push(["user", reportUserMessage]);
      list.push(["assistant", reportAssistantMessage]);
    }
    visibleChatHistory.forEach(function (pair) {
      list.push(pair);
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
    visibleChatHistory = [];
  }

  global.DiabetesAdvisorSession = {
    beginResultSession: beginResultSession,
    isActive: isActive,
    contextForApi: contextForApi,
    visibleMessages: visibleMessages,
    appendExchange: appendExchange,
    clear: clear,
  };
})(typeof window !== "undefined" ? window : globalThis);
