/**
 * Lightweight markdown renderer for diabetes results & advisor.
 */
(function (global) {
  "use strict";

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function inlineFormat(text) {
    var s = escapeHtml(text);
    s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    return s;
  }

  function render(markdown) {
    if (!markdown) return "";
    var lines = String(markdown).split("\n");
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

  global.DiabetesMarkdown = { render: render };
})(typeof window !== "undefined" ? window : globalThis);
