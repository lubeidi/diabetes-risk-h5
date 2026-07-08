/**
 * Markdown renderer for diabetes results & advisor.
 * Image handling aligned with Android DiabetesMarkdownRenderer.kt.
 */
(function (global) {
  "use strict";

  var BARE_IMAGE_URL =
    /^https?:\/\/\S+\.(?:png|jpe?g|gif|webp|bmp)(?:\?\S*)?$/i;
  var MARKDOWN_IMAGE_LINK =
    /(?<!!)\[(.*?)\]\((https?:\/\/[^\s)]+?\.(?:png|jpe?g|gif|webp|bmp)(?:\?\S*)?)\)/gi;
  var MARKDOWN_IMAGE =
    /!\[[^\]]*]\((https?:\/\/[^\s)]+?\.(?:png|jpe?g|gif|webp|bmp)(?:\?\S*)?)\)/gi;
  var HTML_IMG_TAG = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isImageUrl(url) {
    return BARE_IMAGE_URL.test(String(url || "").trim());
  }

  function needsMoeAgiAuth(url) {
    var trimmed = String(url || "").trim();
    return (
      /4paradigm\.com/i.test(trimmed) &&
      (/moeagi/i.test(trimmed) || /fileserver/i.test(trimmed))
    );
  }

  function authHeaders() {
    var headers = {
      Authorization: global.DIABETES_API_AUTH || "",
    };
    var uid = global.DIABETES_USER_ID || "";
    if (uid) headers.userId = uid;
    return headers;
  }

  function dedupeMarkdownImages(text) {
    var seen = {};
    return text
      .replace(MARKDOWN_IMAGE, function (match) {
        var url = (match.match(/\((https?:\/\/[^)]+)\)/i) || [])[1];
        if (!url) return match;
        url = url.trim();
        if (seen[url]) return "";
        seen[url] = true;
        return match;
      })
      .replace(/\n{3,}/g, "\n\n");
  }

  function normalize(content) {
    if (!content) return "";
    var text = content;
    if (global.DiabetesThinkingFilter && global.DiabetesThinkingFilter.strip) {
      text = global.DiabetesThinkingFilter.strip(text);
    }
    text = String(text).replace(/\\n/g, "\n");

    text = text
      .split("\n")
      .map(function (line) {
        var trimmed = line.trim();
        if (isImageUrl(trimmed) && trimmed.indexOf("](") < 0) {
          return "![](" + trimmed + ")";
        }
        return line;
      })
      .join("\n");

    text = text.replace(MARKDOWN_IMAGE_LINK, function (match, _alt, url) {
      return match + "\n\n![](" + url.trim() + ")";
    });

    text = text.replace(HTML_IMG_TAG, function (match, url) {
      if (!isImageUrl(url)) return match;
      return "![](" + url.trim() + ")";
    });

    return dedupeMarkdownImages(text);
  }

  function renderImageTag(url, alt) {
    return (
      '<img class="md-image" data-auth-src="' +
      escapeHtml(url) +
      '" alt="' +
      escapeHtml(alt || "") +
      '" loading="lazy" />'
    );
  }

  function inlineFormat(text) {
    var s = escapeHtml(text);
    s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function (_match, alt, url) {
      if (isImageUrl(url)) return renderImageTag(url, alt);
      return escapeHtml("![" + alt + "](" + url + ")");
    });
    s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      function (_match, label, url) {
        if (isImageUrl(url)) {
          return renderImageTag(url, label);
        }
        return (
          '<a href="' +
          escapeHtml(url) +
          '" target="_blank" rel="noopener noreferrer">' +
          label +
          "</a>"
        );
      }
    );
    return s;
  }

  function render(markdown) {
    if (!markdown) return "";
    var lines = normalize(markdown).split("\n");
    var html = [];
    var inUl = false;
    var inOl = false;
    var inCode = false;
    var codeBuf = [];

    function closeLists() {
      if (inUl) {
        html.push("</ul>");
        inUl = false;
      }
      if (inOl) {
        html.push("</ol>");
        inOl = false;
      }
    }

    lines.forEach(function (line) {
      if (line.trim().indexOf("```") === 0) {
        if (!inCode) {
          closeLists();
          inCode = true;
          codeBuf = [];
        } else {
          html.push("<pre><code>" + escapeHtml(codeBuf.join("\n")) + "</code></pre>");
          inCode = false;
        }
        return;
      }
      if (inCode) {
        codeBuf.push(line);
        return;
      }

      var imageOnly = line.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
      if (imageOnly && isImageUrl(imageOnly[2])) {
        closeLists();
        html.push(renderImageTag(imageOnly[2], imageOnly[1]));
        return;
      }

      var h3 = line.match(/^###\s+(.+)/);
      var h2 = line.match(/^##\s+(.+)/);
      var h1 = line.match(/^#\s+(.+)/);
      var ul = line.match(/^[-*]\s+(.+)/);
      var ol = line.match(/^\d+\.\s+(.+)/);

      if (h1) {
        closeLists();
        html.push("<h1>" + inlineFormat(h1[1]) + "</h1>");
        return;
      }
      if (h2) {
        closeLists();
        html.push("<h2>" + inlineFormat(h2[1]) + "</h2>");
        return;
      }
      if (h3) {
        closeLists();
        html.push("<h3>" + inlineFormat(h3[1]) + "</h3>");
        return;
      }
      if (ul) {
        if (!inUl) {
          closeLists();
          html.push("<ul>");
          inUl = true;
        }
        html.push("<li>" + inlineFormat(ul[1]) + "</li>");
        return;
      }
      if (ol) {
        if (!inOl) {
          closeLists();
          html.push("<ol>");
          inOl = true;
        }
        html.push("<li>" + inlineFormat(ol[1]) + "</li>");
        return;
      }
      closeLists();
      if (!line.trim()) {
        html.push("<br/>");
      } else {
        html.push("<p>" + inlineFormat(line) + "</p>");
      }
    });
    closeLists();
    if (inCode && codeBuf.length) {
      html.push("<pre><code>" + escapeHtml(codeBuf.join("\n")) + "</code></pre>");
    }
    return html.join("");
  }

  function loadImage(img) {
    var url = img.getAttribute("data-auth-src");
    if (!url) return;
    if (!needsMoeAgiAuth(url)) {
      img.src = url;
      img.removeAttribute("data-auth-src");
      return;
    }
    fetch(url, { headers: authHeaders() })
      .then(function (res) {
        if (!res.ok) throw new Error("image fetch failed: " + res.status);
        return res.blob();
      })
      .then(function (blob) {
        img.src = URL.createObjectURL(blob);
        img.removeAttribute("data-auth-src");
      })
      .catch(function () {
        img.alt = "图片加载失败";
        img.classList.add("md-image--error");
      });
  }

  function hydrateImages(root) {
    if (!root) return;
    root.querySelectorAll("img[data-auth-src]").forEach(loadImage);
  }

  global.DiabetesMarkdown = {
    render: render,
    hydrateImages: hydrateImages,
    normalize: normalize,
    isImageUrl: isImageUrl,
  };
})(typeof window !== "undefined" ? window : globalThis);
