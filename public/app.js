/**
 * diabetes-risk-h5 main application.
 * Full flow: lifestyle → mode select → upload/manual → processing → result → advisor / PDF preview.
 */
(function () {
  "use strict";

  var STAGE = {
    LIFESTYLE: "lifestyle",
    MODE_SELECT: "mode_select",
    UPLOAD: "upload",
    MANUAL: "manual",
    PROCESSING: "processing",
    UPLOAD_FAILED: "upload_failed",
    RESULT: "result",
    ADVISOR: "advisor",
    PDF_PREVIEW: "pdf_preview",
  };

  var PROCESSING_MESSAGES = [
    "正在全力上传文件",
    "文件指标读取中",
    "正在分析指标",
    "预测结果即将出炉",
    "为你输出健康建议",
  ];

  var NUMBER_PATTERN = /^\d+(\.\d+)?$/;
  var MAX_FILES = window.DIABETES_MAX_FILES || 2;
  var MAX_FILE_BYTES = window.DIABETES_MAX_FILE_BYTES || 100 * 1024 * 1024;
  var SAMPLE_PDF_PATH = "assets/diabetes_sample_report.pdf";
  var SAMPLE_PDF_NAME = "示例体检报告.pdf";

  var state = {
    stage: STAGE.LIFESTYLE,
    manualStep: 0,
    skipLifestyle: false,
    uploadPath: false,
    fromUploadZone: false,
    form: null,
    localFiles: [],
    resultAnswer: "",
    resultSource: DiabetesRiskTracker.RESULT_SOURCE_UPLOAD,
    fileIds: [],
    processingProgress: 0,
    processingStatusIndex: 0,
    processingTimer: null,
    processingStatusTimer: null,
    processingStatusLastSwitch: 0,
    advisorSending: false,
    advisorStreamText: "",
    pdfPreviewFile: null,
    pdfPreviewTitle: "",
    isVip: false,
    enableAdvisorLimit: false,
    fieldErrors: {},
  };

  var rootEl, headerTitleEl, headerMenuEl, mainEl, bottomBarEl, toastEl, unlockSheetEl;

  function parseQuery() {
    var q = {};
    try {
      new URLSearchParams(location.search).forEach(function (v, k) {
        q[k] = v;
      });
    } catch (e) {}
    return q;
  }

  function initFromUrl() {
    var q = parseQuery();
    if (q.userId) window.DIABETES_USER_ID = q.userId;
    if (q.tab) window.DIABETES_TRACK_TAB = q.tab;
    if (q.platform) window.DIABETES_PLATFORM = q.platform;
    if (q.height) state.form.height = q.height;
    if (q.weight) state.form.weight = q.weight;
    if (q.age) state.form.age = q.age;
    if (q.glucose) state.form.glucoseValue = q.glucose;
    if (q.periodLabel) state.form.pagePrefill.periodLabel = q.periodLabel;
    if (q.selectedTimeType) state.form.pagePrefill.selectedTimeType = q.selectedTimeType;
    if (q.rangeMin) state.form.pagePrefill.rangeMin = q.rangeMin;
    if (q.rangeMax) state.form.pagePrefill.rangeMax = q.rangeMax;
    if (q.average) state.form.pagePrefill.average = q.average;
    if (q.isVip === "1") state.isVip = true;

    if (q.mode === "manual") {
      state.stage = STAGE.MANUAL;
      state.manualStep = 0;
      state.skipLifestyle = false;
    } else {
      state.stage = STAGE.LIFESTYLE;
    }

    if (DiabetesBridge.isInApp()) {
      document.querySelector(".app").classList.add("in-app");
    }
  }

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("is-visible");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () {
      toastEl.classList.remove("is-visible");
    }, 2500);
  }

  function formatFileSize(bytes) {
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + " KB";
    return bytes + " B";
  }

  function isValidNumber(value) {
    return NUMBER_PATTERN.test(String(value || "").trim());
  }

  function validateNumericField(key, value, required, emptyMessage) {
    if (!value && required) {
      state.fieldErrors[key] = emptyMessage;
      return false;
    }
    if (value && !isValidNumber(value)) {
      state.fieldErrors[key] = "请输入有效数字";
      return false;
    }
    delete state.fieldErrors[key];
    return true;
  }

  function validateLifestyleFields() {
    var valid = true;
    valid =
      validateNumericField("height", state.form.height, true, "请填写身高") && valid;
    valid =
      validateNumericField("weight", state.form.weight, true, "请填写体重") && valid;
    valid = validateNumericField("age", state.form.age, true, "请填写年龄") && valid;
    return valid;
  }

  function validateManualStep0() {
    var valid = true;
    valid =
      validateNumericField(
        "glucoseValue",
        state.form.glucoseValue,
        true,
        "请填写空腹血糖"
      ) && valid;
    valid =
      validateNumericField("hba1c", state.form.hba1c, true, "请填写糖化血红蛋白") &&
      valid;
    ["postprandialGlucose", "tc", "tg", "hdl", "ldl"].forEach(function (key) {
      valid = validateNumericField(key, state.form[key], false, "") && valid;
    });
    return valid;
  }

  function validateManualStep1() {
    var valid = true;
    ["alt", "ast", "creatinine", "uricAcid", "egfr"].forEach(function (key) {
      valid = validateNumericField(key, state.form[key], false, "") && valid;
    });
    return valid;
  }

  function maxManualStep() {
    return state.skipLifestyle ? 1 : 1;
  }

  function renderBoolRow(label, key) {
    var val = !!state.form[key];
    return (
      '<div class="bool-row" data-bool-key="' +
      key +
      '">' +
      '<span class="bool-row__label">' +
      escapeHtml(label) +
      "</span>" +
      '<button type="button" class="bool-row__btn' +
      (val ? " is-selected" : "") +
      '" data-bool-val="1">是</button>' +
      '<button type="button" class="bool-row__btn' +
      (!val ? " is-selected" : "") +
      '" data-bool-val="0">否</button>' +
      "</div>"
    );
  }

  function renderField(key, label, unit, required, allowDecimal) {
    var err = state.fieldErrors[key];
    return (
      '<div class="field" data-field-key="' +
      key +
      '">' +
      '<div class="field__label' +
      (required ? " field__label--required" : "") +
      '">' +
      escapeHtml(label) +
      "</div>" +
      '<div class="field__row">' +
      '<input class="field__input" type="text" inputmode="decimal" data-input-key="' +
      key +
      '" value="' +
      escapeHtml(state.form[key] || "") +
      '" placeholder="请输入" />' +
      '<span class="field__unit">' +
      escapeHtml(unit) +
      "</span>" +
      "</div>" +
      '<div class="field__error' +
      (err ? " is-visible" : "") +
      '">' +
      escapeHtml(err || "") +
      "</div>" +
      "</div>"
    );
  }

  function renderLifestyleFields() {
    return (
      '<div class="card">' +
      '<div class="card__title">生活习惯 &amp; 基础病史</div>' +
      renderBoolRow("父母患有糖尿病", "familyHistory") +
      renderBoolRow("经常运动", "exerciseRegularly") +
      renderBoolRow("吸烟", "smoking") +
      renderBoolRow("经常饮酒", "drinking") +
      renderBoolRow("脂肪肝", "fattyLiver") +
      renderBoolRow("高血压", "hypertension") +
      "</div>" +
      '<div class="card">' +
      '<div class="card__title">身体基本信息</div>' +
      renderField("height", "身高", "cm", true) +
      renderField("weight", "体重", "kg", true) +
      renderField("age", "年龄", "岁", true) +
      "</div>" +
      '<div class="tip-card"><span>ℹ</span><span>填写完成后，请选择上传体检报告或手动填写指标</span></div>'
    );
  }

  function renderManualStep0() {
    return (
      '<div class="card">' +
      '<div class="card__title">血糖值</div>' +
      renderField("glucoseValue", "空腹血糖", "mmol/L", true) +
      renderField("postprandialGlucose", "餐后2小时血糖", "mmol/L", false) +
      "</div>" +
      '<div class="card">' +
      '<div class="card__title">糖化血红蛋白 (HbA1c)</div>' +
      renderField("hba1c", "HbA1c", "%", true) +
      "</div>" +
      '<div class="card">' +
      '<div class="card__title">血脂四项</div>' +
      renderField("tc", "总胆固醇 (TC)", "mmol/L", false) +
      renderField("tg", "甘油三酯 (TG)", "mmol/L", false) +
      renderField("hdl", "高密度脂蛋白 (HDL-C)", "mmol/L", false) +
      renderField("ldl", "低密度脂蛋白 (LDL-C)", "mmol/L", false) +
      "</div>"
    );
  }

  function renderManualStep1() {
    return (
      '<div class="card">' +
      '<div class="card__title">肝功能指标</div>' +
      renderField("alt", "谷丙转氨酶 (ALT)", "U/L", false) +
      renderField("ast", "谷草转氨酶 (AST)", "U/L", false) +
      "</div>" +
      '<div class="card">' +
      '<div class="card__title">肾功能指标</div>' +
      renderField("creatinine", "血肌酐", "μmol/L", false) +
      renderField("uricAcid", "血尿酸", "μmol/L", false) +
      renderField("egfr", "肾小球滤过率 (eGFR)", "mL/min", false) +
      "</div>"
    );
  }

  function renderSteps() {
    var labels = ["血糖血脂", "肝肾功能"];
    var html = '<div class="steps">';
    labels.forEach(function (label, i) {
      var done = i < state.manualStep;
      var active = i === state.manualStep;
      html +=
        '<div class="step">' +
        '<div class="step__bar' +
        (done ? " is-done" : active ? " is-active" : "") +
        '"></div>' +
        '<div class="step__label' +
        (done || active ? " is-active" : "") +
        '">' +
        (done ? "✓ " : "") +
        escapeHtml(label) +
        "</div></div>";
    });
    html += "</div>";
    return html;
  }

  function renderLifestyle() {
    headerTitleEl.textContent = "糖尿病风险AI预测";
    headerMenuEl.classList.add("hidden");
    DiabetesRiskTracker.lifeExposure();
    return (
      '<p class="subtitle">第一步：填写生活习惯，用于AI综合评估风险</p>' +
      renderLifestyleFields()
    );
  }

  function renderModeSelect() {
    headerTitleEl.textContent = "糖尿病风险预测";
    headerMenuEl.classList.add("hidden");
    // MODE_SELECT 主流程已跳过；仅历史回退路径可能进入，埋点统一在上传页上报
    return (
      '<p class="subtitle">选择数据输入方式</p>' +
      '<div class="mode-card" data-action="upload">' +
      '<div class="mode-card__title">上传体检报告 <span class="mode-card__tag">AI 解读</span></div>' +
      '<p class="mode-card__desc">上传PDF体检报告，AI自动识别血糖、血脂、肝肾功能等指标，一键完成填写</p>' +
      "</div>" +
      '<div class="mode-card" data-action="manual">' +
      '<div class="mode-card__title">手动填写数据</div>' +
      '<p class="mode-card__desc">逐项输入血糖、血脂、肝肾功能及生活习惯，适合已知具体数值</p>' +
      "</div>" +
      '<div class="tip-card"><span>ℹ</span><span>AI模型基于50万+样本训练，综合血糖、血脂、肝肾功能及生活习惯评估未来1-3年患病概率</span></div>'
    );
  }

  function renderUpload() {
    headerTitleEl.textContent = "糖尿病风险预测";
    headerMenuEl.classList.remove("hidden");
    headerMenuEl.textContent = "示例文件";
    DiabetesRiskTracker.insertExposure();
    if (state.localFiles.length) DiabetesRiskTracker.uploadCompleteExposure();

    var filesHtml = "";
    state.localFiles.forEach(function (file, i) {
      filesHtml +=
        '<div class="file-item" data-file-index="' +
        i +
        '">' +
        "<div>" +
        '<div class="file-item__name">' +
        escapeHtml(file.name) +
        "</div>" +
        '<div class="file-item__meta">' +
        formatFileSize(file.size) +
        " · PDF · 查看文件</div>" +
        "</div></div>";
    });

    if (!state.localFiles.length) {
      return (
        '<p class="subtitle">上传PDF体检报告</p>' +
        '<div class="upload-zone" id="upload-zone">' +
        '<div>点击上传体检报告</div>' +
        '<div style="font-size:12px;margin-top:8px">仅支持 PDF，最多 ' +
        MAX_FILES +
        " 个，单文件 ≤ 100MB</div>" +
        "</div>" +
        '<input type="file" id="file-input" accept="application/pdf,.pdf" class="hidden" />' +
        '<p class="subtitle" style="margin-top:16px">AI将自动识别报告中的血糖、血脂、肝肾功能等指标，无需手动填写</p>'
      );
    }

    return (
      '<p class="subtitle">文件已就绪</p>' +
      filesHtml +
      '<input type="file" id="file-input" accept="application/pdf,.pdf" class="hidden" />' +
      '<div class="btn-row">' +
      '<button type="button" class="btn btn--ghost" id="btn-reselect">重新选择文件</button>' +
      '<button type="button" class="btn btn--primary" id="btn-start-parse">开始 AI 解读</button>' +
      "</div>" +
      '<div class="btn-row">' +
      '<button type="button" class="btn btn--secondary" id="btn-upload-manual">手动填写数据</button>' +
      "</div>"
    );
  }

  function renderManual() {
    headerTitleEl.textContent = "糖尿病风险预测";
    headerMenuEl.classList.add("hidden");
    if (state.manualStep === 0) DiabetesRiskTracker.gluExposure();
    if (state.manualStep === 1) DiabetesRiskTracker.lrExposure();

    var body = renderSteps();
    if (state.manualStep === 0) body += renderManualStep0();
    else body += renderManualStep1();
    return body;
  }

  function renderProcessing() {
    headerTitleEl.textContent = "AI 正在解读报告";
    headerMenuEl.classList.add("hidden");
    return (
      '<div class="processing">' +
      '<div class="processing__spinner" aria-hidden="true"></div>' +
      '<div class="processing__title">AI 正在解读报告</div>' +
      '<div class="processing__status" id="processing-status">' +
      escapeHtml(PROCESSING_MESSAGES[state.processingStatusIndex]) +
      "</div>" +
      '<div class="progress"><div class="progress__bar" id="progress-bar" style="width:' +
      state.processingProgress +
      '%"></div></div>' +
      '<div class="progress__percent" id="progress-percent">' +
      state.processingProgress +
      "%</div>" +
      "</div>"
    );
  }

  function renderUploadFailed() {
    headerTitleEl.textContent = "糖尿病风险预测";
    headerMenuEl.classList.add("hidden");
    return (
      '<div class="fail-card">' +
      '<div class="fail-card__title">解析失败</div>' +
      '<p class="fail-card__hint">AI未能识别报告内容，可能原因：<br/>文件格式不支持、扫描不清晰或内容不完整。<br/>建议：确保文件为PDF格式，或拍摄清晰正面照片。</p>' +
      '<div class="btn-row">' +
      '<button type="button" class="btn btn--primary" id="btn-failed-reupload">重新上传</button>' +
      '<button type="button" class="btn btn--secondary" id="btn-failed-manual">手动填写数据</button>' +
      "</div></div>"
    );
  }

  function renderResult() {
    headerTitleEl.textContent = "分析结果";
    headerMenuEl.classList.add("hidden");
    DiabetesRiskTracker.resultExposure(state.resultSource);

    var unlocked = DiabetesReportAccess.isFullReportUnlocked(state.isVip);
    var contentHtml = unlocked
      ? DiabetesMarkdown.render(state.resultAnswer)
      : '<p>付费解锁完整分析报告</p>';

    var overlay = unlocked
      ? ""
      : '<div class="unlock-overlay__mask">' +
        '<div class="unlock-overlay__title">付费解锁完整分析报告</div>' +
        '<button type="button" class="btn btn--primary" id="btn-unlock" style="max-width:200px">立即解锁</button>' +
        "</div>";

    return (
      '<div class="unlock-overlay">' +
      '<div class="result-content" id="result-content">' +
      contentHtml +
      "</div>" +
      overlay +
      "</div>" +
      '<div class="disclaimer">本结果基于您提供的数据由 AI 模型生成，仅供健康参考，不能替代专业医疗诊断。</div>' +
      '<div class="result-bottom">' +
      '<div class="chips">' +
      '<button type="button" class="chip" data-chip="如何改善血糖？">如何改善血糖？</button>' +
      '<button type="button" class="chip" data-chip="推荐运动计划">推荐运动计划</button>' +
      '<button type="button" class="chip" data-chip="饮食调控方案">饮食调控方案</button>' +
      "</div>" +
      '<button type="button" class="btn btn--primary" id="btn-ask-ai">问AI · 获取个性化健康建议</button>' +
      "</div>"
    );
  }

  function renderAdvisor() {
    headerTitleEl.textContent = "AI健康顾问";
    headerMenuEl.classList.add("hidden");
    DiabetesRiskTracker.askExposure();

    var messages = [];
    if (!DiabetesAdvisorSession.isActive()) {
      messages.push({
        role: "ai",
        text: "您好！我是AI健康顾问，已结合您的健康数据为您提供个性化解答。请问有什么可以帮您？",
      });
    } else {
      DiabetesAdvisorSession.visibleMessages().forEach(function (pair) {
        messages.push({ role: pair[0] === "user" ? "user" : "ai", text: pair[1] });
      });
      if (!messages.length) {
        messages.push({
          role: "ai",
          text: "您好！我是AI健康顾问，已结合您的健康数据为您提供个性化解答。请问有什么可以帮您？",
        });
      }
    }

    var html = '<div class="advisor-messages" id="advisor-messages">';
    messages.forEach(function (m) {
      html +=
        '<div class="bubble bubble--' +
        m.role +
        '">' +
        (m.role === "ai" ? DiabetesMarkdown.render(m.text) : escapeHtml(m.text)) +
        "</div>";
    });
    html += "</div>";
    return html;
  }

  function renderPdfPreview() {
    headerTitleEl.textContent = state.pdfPreviewTitle || "查看文件";
    headerMenuEl.classList.add("hidden");
    return '<div class="pdf-preview" id="pdf-preview-container"><p>加载中…</p></div>';
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderBottomBar() {
    if (state.stage === STAGE.LIFESTYLE) {
      bottomBarEl.innerHTML =
        '<button type="button" class="btn btn--primary" id="btn-next">下一步</button>';
      bottomBarEl.classList.remove("hidden");
      return;
    }
    if (state.stage === STAGE.MANUAL) {
      var label =
        state.manualStep < maxManualStep() ? "下一步" : "开始 AI 分析";
      bottomBarEl.innerHTML =
        '<button type="button" class="btn btn--primary" id="btn-next">' +
        label +
        "</button>";
      bottomBarEl.classList.remove("hidden");
      return;
    }
    bottomBarEl.classList.add("hidden");
    bottomBarEl.innerHTML = "";
  }

  function render() {
    state.fieldErrors = {};
    var html = "";
    switch (state.stage) {
      case STAGE.LIFESTYLE:
        html = renderLifestyle();
        break;
      case STAGE.MODE_SELECT:
        html = renderModeSelect();
        break;
      case STAGE.UPLOAD:
        html = renderUpload();
        break;
      case STAGE.MANUAL:
        html = renderManual();
        break;
      case STAGE.PROCESSING:
        html = renderProcessing();
        break;
      case STAGE.UPLOAD_FAILED:
        html = renderUploadFailed();
        break;
      case STAGE.RESULT:
        html = renderResult();
        break;
      case STAGE.ADVISOR:
        html = renderAdvisor();
        break;
      case STAGE.PDF_PREVIEW:
        html = renderPdfPreview();
        break;
      default:
        html = renderLifestyle();
    }
    mainEl.innerHTML = html;
    renderBottomBar();
    bindStageEvents();
    trackStagePageClicks();
    if (state.stage === STAGE.RESULT || state.stage === STAGE.ADVISOR) {
      DiabetesMarkdown.hydrateImages(mainEl);
    }
    if (state.stage === STAGE.PDF_PREVIEW) loadPdfPreview();
    if (state.stage === STAGE.ADVISOR) setupAdvisorInput();
  }

  function collectFieldsFromDom() {
    mainEl.querySelectorAll("[data-input-key]").forEach(function (input) {
      var key = input.getAttribute("data-input-key");
      state.form[key] = input.value.trim();
    });
  }

  function trackStagePageClicks() {
    switch (state.stage) {
      case STAGE.LIFESTYLE:
        DiabetesRiskTracker.bindPageClick(mainEl, function () {
          DiabetesRiskTracker.lifePageClick();
        });
        break;
      case STAGE.UPLOAD:
        DiabetesRiskTracker.bindPageClick(mainEl, function () {
          DiabetesRiskTracker.uploadPageClick(state.localFiles.length > 0);
        });
        break;
      case STAGE.MANUAL:
        DiabetesRiskTracker.bindPageClick(mainEl, function () {
          if (state.manualStep === 0) DiabetesRiskTracker.gluPageClick();
          else DiabetesRiskTracker.lrPageClick();
        });
        break;
      case STAGE.RESULT:
        DiabetesRiskTracker.bindPageClick(mainEl, function () {
          DiabetesRiskTracker.resultPageClick(state.resultSource);
        });
        break;
      case STAGE.ADVISOR:
        DiabetesRiskTracker.bindPageClick(mainEl, function () {
          DiabetesRiskTracker.askPageClick();
        });
        break;
      default:
        break;
    }
  }

  function bindStageEvents() {
    mainEl.querySelectorAll("[data-bool-key]").forEach(function (row) {
      row.querySelectorAll("[data-bool-val]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var key = row.getAttribute("data-bool-key");
          state.form[key] = btn.getAttribute("data-bool-val") === "1";
          render();
        });
      });
    });

    mainEl.querySelectorAll("[data-input-key]").forEach(function (input) {
      input.addEventListener("input", function () {
        var key = input.getAttribute("data-input-key");
        state.form[key] = input.value.trim();
      });
    });

    var uploadZone = document.getElementById("upload-zone");
    var fileInput = document.getElementById("file-input");
    if (uploadZone && fileInput) {
      uploadZone.addEventListener("click", function () {
        DiabetesRiskTracker.uploadPageClick(state.localFiles.length > 0);
        DiabetesRiskTracker.insertUploadClick();
        fileInput.click();
      });
      fileInput.addEventListener("change", function () {
        handleFileSelect(fileInput.files);
        fileInput.value = "";
      });
    }

    var btnReselect = document.getElementById("btn-reselect");
    if (btnReselect) {
      btnReselect.addEventListener("click", function () {
        DiabetesRiskTracker.uploadPageClick(true);
        state.localFiles = [];
        state.form.uploadedFiles = [];
        render();
      });
    }

    var btnStartParse = document.getElementById("btn-start-parse");
    if (btnStartParse) {
      btnStartParse.addEventListener("click", function () {
        DiabetesRiskTracker.uploadPageClick(true);
        DiabetesRiskTracker.uploadAiClick();
        startAiInterpretation();
      });
    }

    var btnUploadManual = document.getElementById("btn-upload-manual");
    if (btnUploadManual) {
      btnUploadManual.addEventListener("click", function () {
        DiabetesRiskTracker.uploadPageClick(true);
        DiabetesRiskTracker.insertEditClick();
        DiabetesRiskTracker.uploadEditClick();
        state.uploadPath = false;
        state.fromUploadZone = true;
        state.stage = STAGE.MANUAL;
        state.manualStep = 0;
        render();
      });
    }

    var btnFailedReupload = document.getElementById("btn-failed-reupload");
    if (btnFailedReupload) {
      btnFailedReupload.addEventListener("click", function () {
        state.localFiles = [];
        state.form.uploadedFiles = [];
        state.stage = STAGE.UPLOAD;
        render();
        var fi = document.getElementById("file-input");
        if (fi) fi.click();
      });
    }

    var btnFailedManual = document.getElementById("btn-failed-manual");
    if (btnFailedManual) {
      btnFailedManual.addEventListener("click", function () {
        state.uploadPath = false;
        state.fromUploadZone = true;
        state.stage = STAGE.MANUAL;
        state.manualStep = 0;
        render();
      });
    }

    mainEl.querySelectorAll(".mode-card[data-action]").forEach(function (card) {
      card.addEventListener("click", function () {
        var action = card.getAttribute("data-action");
        if (action === "upload") {
          state.uploadPath = true;
          state.stage = STAGE.UPLOAD;
        } else {
          state.uploadPath = false;
          state.fromUploadZone = false;
          state.stage = STAGE.MANUAL;
          state.manualStep = 0;
        }
        render();
      });
    });

    mainEl.querySelectorAll(".file-item[data-file-index]").forEach(function (el) {
      el.addEventListener("click", function () {
        DiabetesRiskTracker.uploadPageClick(true);
        var idx = parseInt(el.getAttribute("data-file-index"), 10);
        var file = state.localFiles[idx];
        if (!file) return;
        openPdfPreview(file, file.name);
      });
    });

    var btnUnlock = document.getElementById("btn-unlock");
    if (btnUnlock) {
      btnUnlock.addEventListener("click", openUnlockSheet);
    }

    var btnAskAi = document.getElementById("btn-ask-ai");
    if (btnAskAi) {
      btnAskAi.addEventListener("click", function () {
        openAdvisor("");
      });
    }

    mainEl.querySelectorAll(".chip[data-chip]").forEach(function (chip) {
      chip.addEventListener("click", function () {
        openAdvisor(chip.getAttribute("data-chip"));
      });
    });

    var btnNext = document.getElementById("btn-next");
    if (btnNext) {
      btnNext.addEventListener("click", onNextClick);
    }
  }

  function handleFileSelect(fileList) {
    if (!fileList || !fileList.length) return;
    var file = fileList[0];
    if (state.localFiles.length >= MAX_FILES) {
      showToast("最多上传 " + MAX_FILES + " 个文件");
      return;
    }
    if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
      showToast("仅支持 PDF 格式");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      showToast("单文件不能超过 100MB");
      return;
    }
    state.localFiles.push(file);
    state.form.uploadedFiles.push({
      displayName: file.name,
      sizeBytes: file.size,
      fileId: "",
    });
    render();
  }

  function onNextClick() {
    collectFieldsFromDom();
    if (state.stage === STAGE.LIFESTYLE) {
      if (!validateLifestyleFields()) {
        render();
        return;
      }
      DiabetesRiskTracker.lifeNextClick();
      state.skipLifestyle = true;
      // Align with native flow: default to upload page, manual entry can be chosen within upload page.
      state.uploadPath = true;
      state.stage = STAGE.UPLOAD;
      render();
      return;
    }
    if (state.stage === STAGE.MANUAL) {
      state.fieldErrors = {};
      var valid = state.manualStep === 0 ? validateManualStep0() : validateManualStep1();
      if (!valid) {
        render();
        return;
      }
      if (state.manualStep < maxManualStep()) {
        if (state.manualStep === 0) DiabetesRiskTracker.gluNextClick();
        state.manualStep++;
        render();
        return;
      }
      DiabetesRiskTracker.lrAiClick();
      startManualAnalysis();
    }
  }

  function stopProcessingTimers() {
    if (state.processingTimer) clearInterval(state.processingTimer);
    if (state.processingStatusTimer) clearTimeout(state.processingStatusTimer);
    state.processingTimer = null;
    state.processingStatusTimer = null;
  }

  function updateProcessingProgress(progress) {
    state.processingProgress = progress;
    var bar = document.getElementById("progress-bar");
    var pct = document.getElementById("progress-percent");
    if (bar) bar.style.width = progress + "%";
    if (pct) pct.textContent = progress + "%";
  }

  function startProcessingStatusRotation() {
    stopProcessingTimers();
    state.processingStatusIndex = 0;
    state.processingProgress = 0;
    state.processingStatusLastSwitch = Date.now();
    updateProcessingProgress(0);
    scheduleNextProcessingStatus();
    state.processingTimer = setInterval(function () {
      var elapsed = (Date.now() - state.processingStatusLastSwitch) / 1000;
      var gain = Math.floor(elapsed * 4);
      if (gain > 0) {
        state.processingStatusLastSwitch = Date.now();
        updateProcessingProgress(Math.min(96, state.processingProgress + gain));
      }
    }, 1000);
  }

  function scheduleNextProcessingStatus() {
    var delay = 3000 + Math.floor(Math.random() * 2000);
    state.processingStatusTimer = setTimeout(function () {
      if (state.stage !== STAGE.PROCESSING) return;
      if (state.processingStatusIndex < PROCESSING_MESSAGES.length - 1) {
        state.processingStatusIndex++;
        var el = document.getElementById("processing-status");
        if (el) el.textContent = PROCESSING_MESSAGES[state.processingStatusIndex];
        scheduleNextProcessingStatus();
      }
    }, delay);
  }

  function beginProcessing(runTask) {
    state.stage = STAGE.PROCESSING;
    render();
    startProcessingStatusRotation();
    runTask();
  }

  function resolvePrimaryFileId() {
    if (state.fileIds && state.fileIds.length) return state.fileIds[0];
    var uploaded = state.form && state.form.uploadedFiles;
    if (uploaded && uploaded.length) {
      for (var i = 0; i < uploaded.length; i++) {
        if (uploaded[i].fileId) return uploaded[i].fileId;
      }
    }
    return "";
  }

  function ensureAdvisorSession() {
    if (!state.resultAnswer) return;
    DiabetesAdvisorSession.ensureReportContext(
      state.resultAnswer,
      DiabetesAiPrompt.buildUserText(state.form),
      resolvePrimaryFileId()
    );
  }

  function navigateToResult(answer, fileIds) {
    state.resultAnswer = DiabetesThinkingFilter.strip(answer);
    state.fileIds = fileIds || [];
    DiabetesAdvisorSession.beginResultSession(
      state.resultAnswer,
      DiabetesAiPrompt.buildUserText(state.form),
      resolvePrimaryFileId()
    );
    state.stage = STAGE.RESULT;
    render();
  }

  function startAiInterpretation() {
    if (!state.localFiles.length) {
      showToast("请先上传体检报告");
      return;
    }
    if (!DiabetesMoeAgiClient.isConfigured()) {
      showToast("AI 服务未配置，请检查网络或环境");
      return;
    }
    state.resultSource = DiabetesRiskTracker.RESULT_SOURCE_UPLOAD;
    beginProcessing(function () {
      var fileIds = [];
      var uploadChain = Promise.resolve();
      state.localFiles.forEach(function (file, index) {
        uploadChain = uploadChain.then(function () {
          return DiabetesAiRepository.uploadReport(file).then(function (id) {
            fileIds.push(id);
            if (state.form.uploadedFiles[index]) {
              state.form.uploadedFiles[index].fileId = id;
            }
          });
        });
      });
      uploadChain
        .then(function () {
          return DiabetesAiRepository.analyzeSync(state.form, fileIds);
        })
        .then(function (answer) {
          stopProcessingTimers();
          updateProcessingProgress(100);
          var statusEl = document.getElementById("processing-status");
          if (statusEl) statusEl.textContent = "解读完成✅";
          setTimeout(function () {
            navigateToResult(answer, fileIds);
          }, 500);
        })
        .catch(function () {
          stopProcessingTimers();
          state.stage = STAGE.UPLOAD_FAILED;
          render();
        });
    });
  }

  function startManualAnalysis() {
    if (!DiabetesMoeAgiClient.isConfigured()) {
      showToast("AI 服务未配置，请检查网络或环境");
      return;
    }
    state.resultSource = DiabetesRiskTracker.RESULT_SOURCE_MANUAL;
    beginProcessing(function () {
      DiabetesAiRepository.analyzeSync(state.form, [])
        .then(function (answer) {
          stopProcessingTimers();
          updateProcessingProgress(100);
          var statusEl = document.getElementById("processing-status");
          if (statusEl) statusEl.textContent = "解读完成✅";
          setTimeout(function () {
            navigateToResult(answer, []);
          }, 500);
        })
        .catch(function (err) {
          stopProcessingTimers();
          state.stage = STAGE.MANUAL;
          state.manualStep = maxManualStep();
          render();
          showToast((err && err.message) || "发送失败，请稍后重试");
        });
    });
  }

  function openAdvisor(prefill) {
    ensureAdvisorSession();
    DiabetesRiskTracker.resultAskAiClick(state.resultSource);
    state.stage = STAGE.ADVISOR;
    render();
    if (prefill) {
      var input = document.getElementById("advisor-input");
      if (input) {
        input.value = prefill;
        updateAdvisorSendButton();
      }
    }
  }

  function setupAdvisorInput() {
    var existing = document.getElementById("advisor-input-bar");
    if (existing) existing.remove();

    var bar = document.createElement("div");
    bar.id = "advisor-input-bar";
    bar.className = "advisor-input-bar";
    bar.innerHTML =
      '<input type="text" class="advisor-input" id="advisor-input" placeholder="请输入您的问题" />' +
      '<button type="button" class="advisor-send" id="advisor-send" disabled>➤</button>';
    document.body.appendChild(bar);

    var input = document.getElementById("advisor-input");
    var send = document.getElementById("advisor-send");
    input.addEventListener("input", updateAdvisorSendButton);
    send.addEventListener("click", sendAdvisorMessage);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") sendAdvisorMessage();
    });
    updateAdvisorSendButton();
    scrollAdvisorToBottom();
  }

  function updateAdvisorSendButton() {
    var input = document.getElementById("advisor-input");
    var send = document.getElementById("advisor-send");
    if (!input || !send) return;
    var canSend =
      input.value.trim() &&
      !state.advisorSending &&
      (!state.enableAdvisorLimit ||
        state.isVip ||
        DiabetesFreeChatCounter.canSendFree(window.DIABETES_USER_ID, state.isVip));
    send.disabled = !canSend;
  }

  function scrollAdvisorToBottom() {
    var el = document.getElementById("advisor-messages");
    if (el) el.scrollTop = el.scrollHeight;
    mainEl.scrollTop = mainEl.scrollHeight;
  }

  var advisorStreamRenderRaf = 0;

  function cancelAdvisorStreamRender() {
    if (advisorStreamRenderRaf) {
      cancelAnimationFrame(advisorStreamRenderRaf);
      advisorStreamRenderRaf = 0;
    }
  }

  function renderAdvisorStreamBubble(bubble, markdown, hydrateImages) {
    if (!bubble) return;
    bubble.innerHTML = DiabetesMarkdown.render(markdown);
    if (hydrateImages) DiabetesMarkdown.hydrateImages(bubble);
    scrollAdvisorToBottom();
  }

  function scheduleAdvisorStreamRender(bubble) {
    if (!bubble || advisorStreamRenderRaf) return;
    advisorStreamRenderRaf = requestAnimationFrame(function () {
      advisorStreamRenderRaf = 0;
      renderAdvisorStreamBubble(bubble, state.advisorStreamText, false);
    });
  }

  function appendAdvisorBubble(role, text, isMarkdown) {
    var container = document.getElementById("advisor-messages");
    if (!container) return null;
    var div = document.createElement("div");
    div.className = "bubble bubble--" + role;
    if (isMarkdown) div.innerHTML = DiabetesMarkdown.render(text);
    else div.textContent = text;
    container.appendChild(div);
    scrollAdvisorToBottom();
    return div;
  }

  function sendAdvisorMessage() {
    var input = document.getElementById("advisor-input");
    if (!input || state.advisorSending) return;
    var text = input.value.trim();
    if (!text) return;
    ensureAdvisorSession();
    if (
      state.enableAdvisorLimit &&
      !state.isVip &&
      !DiabetesFreeChatCounter.canSendFree(window.DIABETES_USER_ID, state.isVip)
    ) {
      openUnlockSheet();
      return;
    }

    appendAdvisorBubble("user", text, false);
    input.value = "";
    state.advisorSending = true;
    state.advisorStreamText = "";
    updateAdvisorSendButton();

    var streamBubble = appendAdvisorBubble("ai", "", true);

    DiabetesAiRepository.chatAdvisor(
      state.form,
      DiabetesAdvisorSession.contextForApi(),
      text,
      {
        onAnswerChunk: function (chunk) {
          state.advisorStreamText += chunk;
          scheduleAdvisorStreamRender(streamBubble);
        },
        onComplete: function (full) {
          cancelAdvisorStreamRender();
          var reply = DiabetesThinkingFilter.strip(full || state.advisorStreamText);
          renderAdvisorStreamBubble(streamBubble, reply, true);
          DiabetesAdvisorSession.appendExchange(text, reply);
          state.advisorSending = false;
          state.advisorStreamText = "";
          if (state.enableAdvisorLimit && !state.isVip) {
            DiabetesFreeChatCounter.recordFreeUse(window.DIABETES_USER_ID);
          }
          updateAdvisorSendButton();
        },
        onError: function (msg) {
          cancelAdvisorStreamRender();
          if (streamBubble && streamBubble.parentNode) {
            streamBubble.parentNode.removeChild(streamBubble);
          }
          state.advisorSending = false;
          state.advisorStreamText = "";
          showToast(msg || "发送失败，请稍后重试");
          updateAdvisorSendButton();
        },
      }
    );
  }

  function openUnlockSheet() {
    unlockSheetEl.classList.add("is-open");
  }

  function closeUnlockSheet() {
    unlockSheetEl.classList.remove("is-open");
  }

  function openPdfPreview(file, title) {
    state.pdfPreviewFile = file;
    state.pdfPreviewTitle = title || "查看文件";
    state.stage = STAGE.PDF_PREVIEW;
    render();
  }

  function loadPdfPreview() {
    var container = document.getElementById("pdf-preview-container");
    if (!container || !state.pdfPreviewFile) return;

    if (typeof pdfjsLib === "undefined") {
      container.innerHTML =
        '<p>PDF 预览库未加载，<a href="#" id="pdf-fallback-open">点击尝试打开</a></p>';
      var link = document.getElementById("pdf-fallback-open");
      if (link) {
        link.addEventListener("click", function (e) {
          e.preventDefault();
          var url = URL.createObjectURL(state.pdfPreviewFile);
          DiabetesBridge.jumpNative("pdfPreview", { url: url, title: state.pdfPreviewTitle });
        });
      }
      return;
    }

    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

    var url = URL.createObjectURL(state.pdfPreviewFile);
    container.innerHTML = "";

    pdfjsLib.getDocument(url).promise.then(function (pdf) {
      var renderPage = function (num) {
        return pdf.getPage(num).then(function (page) {
          var viewport = page.getViewport({ scale: 1.2 });
          var canvas = document.createElement("canvas");
          var ctx = canvas.getContext("2d");
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          container.appendChild(canvas);
          return page.render({ canvasContext: ctx, viewport: viewport }).promise;
        });
      };
      var chain = Promise.resolve();
      for (var i = 1; i <= pdf.numPages; i++) {
        (function (pageNum) {
          chain = chain.then(function () {
            return renderPage(pageNum);
          });
        })(i);
      }
    }).catch(function () {
      container.innerHTML = '<p>无法打开文件，请安装 PDF 阅读器</p>';
    });
  }

  function handleBack() {
    if (state.stage === STAGE.ADVISOR) {
      var bar = document.getElementById("advisor-input-bar");
      if (bar) bar.remove();
      state.stage = STAGE.RESULT;
      render();
      return;
    }
    if (state.stage === STAGE.PDF_PREVIEW) {
      state.stage = STAGE.UPLOAD;
      render();
      return;
    }
    if (state.stage === STAGE.RESULT) {
      // Align with native: result is a leaf page; back returns to upload page.
      state.stage = STAGE.UPLOAD;
      render();
      return;
    }
    if (state.stage === STAGE.LIFESTYLE) {
      DiabetesAdvisorSession.clear();
      DiabetesBridge.finish();
      return;
    }
    if (state.stage === STAGE.MODE_SELECT) {
      if (state.skipLifestyle) {
        state.stage = STAGE.LIFESTYLE;
        render();
      } else {
        DiabetesBridge.finish();
      }
      return;
    }
    if (state.stage === STAGE.UPLOAD) {
      if (state.skipLifestyle) {
        state.stage = STAGE.LIFESTYLE;
      } else {
        DiabetesAdvisorSession.clear();
        DiabetesBridge.finish();
        return;
      }
      render();
      return;
    }
    if (state.stage === STAGE.PROCESSING) {
      stopProcessingTimers();
      state.stage = state.uploadPath ? STAGE.UPLOAD : STAGE.MANUAL;
      render();
      return;
    }
    if (state.stage === STAGE.UPLOAD_FAILED) {
      state.stage = STAGE.UPLOAD;
      render();
      return;
    }
    if (state.stage === STAGE.MANUAL) {
      collectFieldsFromDom();
      if (state.manualStep > 0) {
        state.manualStep--;
        render();
        return;
      }
      if (state.fromUploadZone) {
        state.fromUploadZone = false;
        state.stage = STAGE.UPLOAD;
      } else if (state.skipLifestyle) {
        state.stage = STAGE.UPLOAD;
      } else {
        state.stage = STAGE.LIFESTYLE;
      }
      render();
    }
  }

  function resolveAssetUrl(relativePath) {
    var basePath = location.pathname;
    if (!basePath.endsWith("/")) {
      basePath = basePath.replace(/\/[^/]*$/, "/");
    }
    return basePath + String(relativePath || "").replace(/^\//, "");
  }

  function loadSampleFile() {
    fetch(resolveAssetUrl(SAMPLE_PDF_PATH))
      .then(function (res) {
        if (!res.ok) throw new Error("sample fetch failed");
        return res.blob();
      })
      .then(function (blob) {
        var file = new File([blob], SAMPLE_PDF_NAME, { type: "application/pdf" });
        state.localFiles = [file];
        state.form.uploadedFiles = [
          {
            displayName: SAMPLE_PDF_NAME,
            sizeBytes: file.size,
            fileId: "",
          },
        ];
        showToast("示例文件已加载");
        render();
      })
      .catch(function () {
        showToast("示例文件加载失败");
      });
  }

  function onHeaderMenuClick() {
    if (state.stage === STAGE.UPLOAD) {
      loadSampleFile();
    }
  }

  function boot() {
    rootEl = document.getElementById("app");
    headerTitleEl = document.getElementById("header-title");
    headerMenuEl = document.getElementById("header-menu");
    mainEl = document.getElementById("main");
    bottomBarEl = document.getElementById("bottom-bar");
    toastEl = document.getElementById("toast");
    unlockSheetEl = document.getElementById("unlock-sheet");

    state.form = DiabetesFormData.create();
    initFromUrl();

    document.getElementById("btn-back").addEventListener("click", handleBack);
    headerMenuEl.addEventListener("click", onHeaderMenuClick);
    document.getElementById("btn-sheet-close").addEventListener("click", closeUnlockSheet);
    document.querySelector(".sheet__backdrop").addEventListener("click", closeUnlockSheet);
    document.getElementById("btn-sheet-unlock").addEventListener("click", function () {
      closeUnlockSheet();
      DiabetesBridge.jumpNative("aiVip", {});
    });

    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
