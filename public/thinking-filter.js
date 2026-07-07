/**
 * Strips model reasoning blocks from assistant message text.
 * Ported from Android MoeAgiThinkingFilter.kt
 */
(function (global) {
  "use strict";

  var THINKING_TAGS = ["think", "redacted_thinking"];
  var UNICODE_ESCAPE = /\\u([0-9a-fA-F]{4})/g;

  function decodeUnicodeEscapes(text) {
    if (text.indexOf("\\u") < 0) return text;
    return text.replace(UNICODE_ESCAPE, function (_, hex) {
      return String.fromCharCode(parseInt(hex, 16));
    });
  }

  function removeThinkingBlocks(text, tag) {
    var closed = new RegExp("<" + tag + ">.*?<\\/" + tag + ">", "gis");
    var open = new RegExp("<" + tag + ">.*", "is");
    var result = text;
    var prev;
    do {
      prev = result;
      result = result.replace(closed, "");
    } while (result !== prev);
    return result.replace(open, "");
  }

  function strip(content) {
    if (!content || !String(content).trim()) return content || "";
    var text = decodeUnicodeEscapes(String(content));
    THINKING_TAGS.forEach(function (tag) {
      text = removeThinkingBlocks(text, tag);
    });
    return text.trim();
  }

  global.DiabetesThinkingFilter = { strip: strip };
})(typeof window !== "undefined" ? window : globalThis);
