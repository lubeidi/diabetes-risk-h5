/**
 * AI repository — aligned with Android DiabetesAiRepository.kt
 */
(function (global) {
  "use strict";

  var currentStream = null;

  function uploadReport(file) {
    return global.DiabetesMoeAgiClient.uploadFile(file);
  }

  function parseReport(fileIds) {
    if (!fileIds || !fileIds.length) {
      return Promise.reject(new Error("no file ids"));
    }
    var messages = global.DiabetesParsePrompt.buildMessages(fileIds);
    return global.DiabetesMoeAgiClient.chatSync(messages).then(function (raw) {
      var parsed = global.DiabetesParsePrompt.parseJsonResponse(raw);
      if (!parsed.ok) throw parsed.error || new Error("parse failed");
      return parsed.data;
    });
  }

  function analyzeSync(form, fileIds) {
    fileIds = fileIds || [];
    var primaryFileId = fileIds[0] || null;
    var messages = global.DiabetesAiPrompt.buildMessages(form, primaryFileId);
    return global.DiabetesMoeAgiClient.chatStreamCollectSync(messages, true);
  }

  function chatAdvisor(form, history, userMessage, callbacks) {
    var messages = global.DiabetesAiPrompt.buildAdvisorMessages(form, history, userMessage);
    currentStream = global.DiabetesMoeAgiClient.streamChat(messages, callbacks, true);
    return currentStream;
  }

  function cancel() {
    if (currentStream && currentStream.stop) currentStream.stop();
    currentStream = null;
  }

  global.DiabetesAiRepository = {
    uploadReport: uploadReport,
    parseReport: parseReport,
    analyzeSync: analyzeSync,
    chatAdvisor: chatAdvisor,
    cancel: cancel,
  };
})(typeof window !== "undefined" ? window : globalThis);
