/**
 * Ported from Android DiabetesParsePrompt.kt
 */
(function (global) {
  "use strict";

  var SYSTEM =
    "你是体检报告 OCR 助手。请从用户上传的体检报告中提取检验指标，仅输出一个 JSON 对象，不要 markdown 代码块，不要其他说明。\n" +
    "字段名固定如下，未识别到的字段省略或留空字符串：\n" +
    "glucoseValue(空腹血糖 mmol/L), postprandialGlucose(餐后2小时 mmol/L), hba1c(%), tc, tg, hdl, ldl(mmol/L),\n" +
    "alt, ast(U/L), creatinine, uricAcid(μmol/L), egfr(mL/min)";

  function buildMessages(fileIds) {
    var parts = [
      { type: "text", text: "请识别附件体检报告中的检验指标，按 JSON 格式返回。" },
    ];
    (fileIds || []).forEach(function (id) {
      parts.push({ type: "file", file: { file_id: id } });
    });
    return [
      { role: "system", content: SYSTEM },
      { role: "user", content: parts },
    ];
  }

  function extractJsonObject(raw) {
    var trimmed = String(raw || "").trim();
    var fenceStart = trimmed.indexOf("```");
    if (fenceStart >= 0) {
      var afterFence = trimmed.substring(fenceStart + 3);
      var contentStart = afterFence.indexOf("\n");
      var inner = contentStart >= 0 ? afterFence.substring(contentStart + 1) : afterFence;
      var fenceEnd = inner.indexOf("```");
      if (fenceEnd >= 0) return inner.substring(0, fenceEnd).trim();
    }
    var start = trimmed.indexOf("{");
    var end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return trimmed.substring(start, end + 1);
    return trimmed;
  }

  function parseJsonResponse(raw) {
    try {
      var jsonText = extractJsonObject(raw);
      var json = JSON.parse(jsonText);
      var data = {
        glucoseValue: json.glucoseValue || "",
        postprandialGlucose: json.postprandialGlucose || "",
        hba1c: json.hba1c || "",
        tc: json.tc || "",
        tg: json.tg || "",
        hdl: json.hdl || "",
        ldl: json.ldl || "",
        alt: json.alt || "",
        ast: json.ast || "",
        creatinine: json.creatinine || "",
        uricAcid: json.uricAcid || "",
        egfr: json.egfr || "",
      };
      var count = global.DiabetesFormData.recognizedFieldCount(data);
      if (count === 0) throw new Error("未识别到有效指标");
      return { ok: true, data: data };
    } catch (e) {
      return { ok: false, error: e };
    }
  }

  global.DiabetesParsePrompt = {
    buildMessages: buildMessages,
    parseJsonResponse: parseJsonResponse,
  };
})(typeof window !== "undefined" ? window : globalThis);
