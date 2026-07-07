/**
 * Free chat counter — aligned with Android DiabetesFreeChatCounter.kt
 */
(function (global) {
  "use strict";

  var FREE_LIMIT = 3;
  var STORAGE_KEY = "diabetes_advisor_chat";

  function storageKey(uid) {
    return "used_" + (uid || "guest");
  }

  function usedCount(uid) {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var map = raw ? JSON.parse(raw) : {};
      return map[storageKey(uid)] || 0;
    } catch (e) {
      return 0;
    }
  }

  function remainingFree(uid) {
    return Math.max(0, FREE_LIMIT - usedCount(uid));
  }

  function canSendFree(uid, isVip) {
    return !!isVip || usedCount(uid) < FREE_LIMIT;
  }

  function recordFreeUse(uid) {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var map = raw ? JSON.parse(raw) : {};
      var key = storageKey(uid);
      map[key] = (map[key] || 0) + 1;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch (e) {
      console.warn("[free-chat]", e);
    }
  }

  global.DiabetesFreeChatCounter = {
    FREE_LIMIT: FREE_LIMIT,
    usedCount: usedCount,
    remainingFree: remainingFree,
    canSendFree: canSendFree,
    recordFreeUse: recordFreeUse,
  };
})(typeof window !== "undefined" ? window : globalThis);
