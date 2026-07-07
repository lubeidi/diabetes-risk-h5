/**
 * moe-agi API client for diabetes-risk-h5.
 * Ported from Android MoeAgiChatClient + MoeAgiFileClient.
 */
(function (global) {
  "use strict";

  var THINKING_START = "<" + "think" + ">";
  var THINKING_END = "</" + "think" + ">";

  function apiBase() {
    return String(global.DIABETES_API_BASE || "/moeagi").replace(/\/+$/, "");
  }

  function authHeaders(userId) {
    var h = {
      Accept: "application/json",
      Authorization: global.DIABETES_API_AUTH || "",
    };
    var uid = userId || global.DIABETES_USER_ID || "";
    if (uid) h.userId = uid;
    return h;
  }

  function buildRequestBody(messages, stream) {
    return {
      model: global.DIABETES_MODEL || "phanthy-lite",
      stream: !!stream,
      messages: messages,
      expert_secrets: [global.DIABETES_EXPERT || "expert-phanthy-diabetes_predict"],
      language: global.DIABETES_LANGUAGE || "zh",
    };
  }

  function safeEmitPrefixLength(text, token) {
    for (var len = text.length; len >= 0; len--) {
      var suffix = text.substring(len);
      if (token.indexOf(suffix) === 0) return len;
    }
    return text.length;
  }

  function createAnswerRouter(onChunk) {
    var buffer = "";
    var insideThinking = false;

    function drain() {
      while (true) {
        var text = buffer;
        if (!insideThinking) {
          var start = text.indexOf(THINKING_START);
          if (start < 0) {
            var safeLen = safeEmitPrefixLength(text, THINKING_START);
            if (safeLen > 0) onChunk(text.substring(0, safeLen));
            buffer = text.substring(safeLen);
            return;
          }
          if (start > 0) onChunk(text.substring(0, start));
          buffer = text.substring(start + THINKING_START.length);
          insideThinking = true;
          continue;
        }
        var end = text.indexOf(THINKING_END);
        if (end < 0) {
          buffer = "";
          return;
        }
        buffer = text.substring(end + THINKING_END.length);
        insideThinking = false;
      }
    }

    return {
      push: function (chunk) {
        buffer += chunk;
        drain();
      },
      flush: function () {
        if (!insideThinking && buffer) {
          onChunk(buffer);
          buffer = "";
        }
        insideThinking = false;
      },
    };
  }

  function parseSSEChunk(buffer, onEvent) {
    var parts = buffer.split("\n\n");
    var rest = parts.pop() || "";
    parts.forEach(function (block) {
      block.split("\n").forEach(function (line) {
        if (line.indexOf("data:") !== 0) return;
        var raw = line.slice(5).trim();
        if (!raw || raw === "[DONE]") return;
        try {
          onEvent(JSON.parse(raw));
        } catch (e) {
          console.warn("[moeagi] SSE parse error", e, raw);
        }
      });
    });
    return rest;
  }

  function extractContentFromChoice(choice) {
    var delta = choice.delta || choice.message || {};
    return delta.content || "";
  }

  function chatCompletionsUrl() {
    return apiBase() + "/v1/chat/completions";
  }

  function filesUrl() {
    return apiBase() + "/v1/files";
  }

  function uploadFile(file, userId) {
    var form = new FormData();
    form.append("purpose", "assistants");
    form.append("file", file, file.name);
    return fetch(filesUrl(), {
      method: "POST",
      headers: authHeaders(userId),
      body: form,
    }).then(function (res) {
      return res.text().then(function (body) {
        if (!res.ok) throw new Error("upload failed: " + res.status + " " + body.slice(0, 200));
        var json = JSON.parse(body);
        if (!json.id) throw new Error("no file id in response");
        return json.id;
      });
    });
  }

  function chatSync(messages, userId) {
    return fetch(chatCompletionsUrl(), {
      method: "POST",
      headers: Object.assign(
        { "Content-Type": "application/json" },
        authHeaders(userId)
      ),
      body: JSON.stringify(buildRequestBody(messages, false)),
    }).then(function (res) {
      return res.text().then(function (body) {
        if (!res.ok) throw new Error("chat failed: " + res.status + " " + body.slice(0, 200));
        var json = JSON.parse(body);
        if (json.error && json.error.message) throw new Error(json.error.message);
        var choices = json.choices || [];
        if (!choices.length) throw new Error("empty choices");
        var content = (choices[0].message && choices[0].message.content) || "";
        return global.DiabetesThinkingFilter.strip(content);
      });
    });
  }

  function streamChat(messages, callbacks, answerOnly) {
    callbacks = callbacks || {};
    answerOnly = answerOnly !== false;
    var controller = new AbortController();
    var router = createAnswerRouter(function (text) {
      if (callbacks.onAnswerChunk) callbacks.onAnswerChunk(text);
    });

    fetch(chatCompletionsUrl(), {
      method: "POST",
      headers: Object.assign(
        {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        authHeaders()
      ),
      body: JSON.stringify(buildRequestBody(messages, true)),
      signal: controller.signal,
    })
      .then(function (res) {
        if (!res.ok) {
          return res.text().then(function (t) {
            throw new Error("stream failed: " + res.status + " " + (t || "").slice(0, 200));
          });
        }
        if (callbacks.onOpen) callbacks.onOpen();
        if (!res.body || !res.body.getReader) {
          return res.json().then(function (data) {
            var text =
              (data.choices &&
                data.choices[0] &&
                data.choices[0].message &&
                data.choices[0].message.content) ||
              "";
            if (callbacks.onAnswerChunk) callbacks.onAnswerChunk(text);
            if (callbacks.onComplete) callbacks.onComplete(global.DiabetesThinkingFilter.strip(text));
          });
        }
        var reader = res.body.getReader();
        var decoder = new TextDecoder();
        var buf = "";
        var acc = "";

        function pump() {
          return reader.read().then(function (result) {
            if (result.done) {
              router.flush();
              if (callbacks.onComplete) {
                callbacks.onComplete(global.DiabetesThinkingFilter.strip(acc));
              }
              return;
            }
            buf += decoder.decode(result.value, { stream: true });
            buf = parseSSEChunk(buf, function (ev) {
              if (ev.error) throw new Error(ev.error.message || String(ev.error));
              var choices = ev.choices;
              if (!choices || !choices.length) return;
              var chunk = extractContentFromChoice(choices[0]);
              if (!chunk) return;
              router.push(chunk);
              acc += chunk;
            });
            return pump();
          });
        }
        return pump();
      })
      .catch(function (err) {
        if (callbacks.onError) callbacks.onError(err.message || String(err));
      });

    return {
      stop: function () {
        controller.abort();
      },
    };
  }

  function chatStreamCollectSync(messages, answerOnly, timeoutMs) {
    answerOnly = answerOnly !== false;
    timeoutMs = timeoutMs || 180000;
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        if (handle) handle.stop();
        reject(new Error("request timeout"));
      }, timeoutMs);
      var acc = "";
      var handle = streamChat(
        messages,
        {
          onAnswerChunk: function (chunk) {
            acc += chunk;
          },
          onComplete: function (full) {
            clearTimeout(timer);
            resolve(global.DiabetesThinkingFilter.strip(full || acc));
          },
          onError: function (msg) {
            clearTimeout(timer);
            reject(new Error(msg));
          },
        },
        answerOnly
      );
    });
  }

  global.DiabetesMoeAgiClient = {
    uploadFile: uploadFile,
    chatSync: chatSync,
    streamChat: streamChat,
    chatStreamCollectSync: chatStreamCollectSync,
    isConfigured: function () {
      return !!(apiBase() && global.DIABETES_API_AUTH);
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
