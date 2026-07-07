/**
 * Diabetes risk tracker — aligned with Android DiabetesRiskTracker.kt
 * + BuryPointPageId / BuryPointEventName / DiabetesTrackExtendInfo.
 *
 * H5 负责 diabetelife 及之后子页；血糖页入口（diabete）埋点由 Native 调用同名方法。
 * 上报走 DiabetesBridge.reportEvent → Native bridge；浏览器调试走 tracking/push fallback。
 */
(function (global) {
  "use strict";

  var RESULT_SOURCE_MANUAL = 1;
  var RESULT_SOURCE_UPLOAD = 2;

  var ACTION_EXPOSURE = "exposure";
  var ACTION_CLICK = "click";

  /** @type {Record<string, string>} */
  var PAGE_ID = {
    DIABETE: "diabete",
    DIABETE_LIFE: "diabetelife",
    DIABETE_INSERT: "diabeteinsert",
    DIABETE_UPLOAD: "diabeteupload",
    DIABETE_GLU: "diabeteglu",
    DIABETE_LR: "diabeteLR",
    DIABETE_RESULT: "diabeteresult",
    DIABETE_ASK: "diabeteask",
  };

  /** actionName 与 Android BuryPointEventName 完全一致（含大小写） */
  var EVENT_NAME = {
    DIABETE_PREDICT_EXPOSURE: "diabetepredict_exposure",
    DIABETE_PREDICT_CLICK: "diabetepredict_click",
    DIABETE_INPUT_EXPOSURE: "diabeteinput_exposure",
    DIABETE_INPUT_CLICK: "diabeteinput_click",
    DIABETE_LIFE_EXPOSURE: "diabetelife_exposure",
    DIABETE_LIFE_CLICK: "diabetelife_click",
    DIABETE_LIFE_NEXT_CLICK: "diabetelife_next_click",
    DIABETE_INSERT_EXPOSURE: "diabeteinsert_exposure",
    DIABETE_INSERT_CLICK: "diabeteinsert_click",
    DIABETE_INSERT_UPLOAD_CLICK: "diabeteinsert_upload_click",
    DIABETE_INSERT_EDIT_CLICK: "diabeteinsert_edit_click",
    DIABETE_UPLOAD_EXPOSURE: "diabeteupload_exposure",
    DIABETE_UPLOAD_CLICK: "diabeteupload_click",
    DIABETE_UPLOAD_AI_CLICK: "diabeteupload_AI_click",
    DIABETE_UPLOAD_EDIT_CLICK: "diabeteupload_edit_click",
    DIABETE_GLU_EXPOSURE: "diabeteglu_exposure",
    DIABETE_GLU_CLICK: "diabeteglu_click",
    DIABETE_GLU_NEXT_CLICK: "diabeteglu_next_click",
    DIABETE_LR_EXPOSURE: "diabeteLR_exposure",
    DIABETE_LR_CLICK: "diabeteLR_click",
    DIABETE_LR_AI_CLICK: "diabeteLR_AI_click",
    DIABETE_RESULT_EXPOSURE: "diabeteresult_exposure",
    DIABETE_RESULT_CLICK: "diabeteresult_click",
    DIABETE_RESULT_ASK_AI_CLICK: "diabeteresult_askAI_click",
    DIABETE_ASK_EXPOSURE: "diabeteask_exposure",
    DIABETE_ASK_CLICK: "diabeteask_click",
  };

  function readTab() {
    if (global.DIABETES_TRACK_TAB) return String(global.DIABETES_TRACK_TAB);
    try {
      return new URLSearchParams(global.location.search).get("tab") || "";
    } catch (e) {
      return "";
    }
  }

  function pickId(common, camel, upper) {
    var v = common[camel];
    if (v != null && v !== "") return String(v);
    v = common[upper];
    if (v != null && v !== "") return String(v);
    return "";
  }

  /**
   * 组装 extend，字段与 Android DiabetesTrackExtendInfo 一致：
   * { source, tab, launchId, sessionId }
   */
  function extendInfo(source, tab) {
    var bridge = global.DiabetesBridge || {};
    var common = typeof bridge.getTrackingCommonInfo === "function" ? bridge.getTrackingCommonInfo() : {};
    common = common || {};
    return {
      source: source || 0,
      tab: tab != null ? String(tab) : readTab(),
      launchId: pickId(common, "launchId", "launchID"),
      sessionId: pickId(common, "sessionId", "sessionID"),
    };
  }

  function post(actionType, actionName, pageId, source, tab) {
    var extend = extendInfo(source, tab);
    if (global.DIABETES_DEBUG_TRACK) {
      console.log("[DiabetesRiskTrack]", actionType, actionName, pageId, extend);
    }
    var bridge = global.DiabetesBridge;
    if (bridge && typeof bridge.reportEvent === "function") {
      bridge.reportEvent(actionType, actionName, pageId, extend);
    } else {
      console.warn("[DiabetesRiskTrack] DiabetesBridge.reportEvent unavailable");
    }
  }

  var pageClickHandlers = new WeakMap();

  /** 页面内任意点击（不消费事件，与 Android bindPageClick 对齐；重复绑定会替换旧监听） */
  function bindPageClick(el, onClick) {
    if (!el || typeof onClick !== "function") return;
    var prev = pageClickHandlers.get(el);
    if (prev) el.removeEventListener("pointerup", prev);
    var handler = function () {
      onClick();
    };
    pageClickHandlers.set(el, handler);
    el.addEventListener("pointerup", handler, { capture: false });
  }

  global.DiabetesRiskTracker = {
    RESULT_SOURCE_MANUAL: RESULT_SOURCE_MANUAL,
    RESULT_SOURCE_UPLOAD: RESULT_SOURCE_UPLOAD,
    PAGE_ID: PAGE_ID,
    EVENT_NAME: EVENT_NAME,
    ACTION_EXPOSURE: ACTION_EXPOSURE,
    ACTION_CLICK: ACTION_CLICK,

    // region 血糖页 · 功能入口（pageId = diabete，通常由 Native 调用）

    predictExposure: function (tab) {
      post(ACTION_EXPOSURE, EVENT_NAME.DIABETE_PREDICT_EXPOSURE, PAGE_ID.DIABETE, 0, tab);
    },
    predictClick: function (tab) {
      post(ACTION_CLICK, EVENT_NAME.DIABETE_PREDICT_CLICK, PAGE_ID.DIABETE, 0, tab);
    },
    manualInputExposure: function (tab) {
      post(ACTION_EXPOSURE, EVENT_NAME.DIABETE_INPUT_EXPOSURE, PAGE_ID.DIABETE, 0, tab);
    },
    manualInputClick: function (tab) {
      post(ACTION_CLICK, EVENT_NAME.DIABETE_INPUT_CLICK, PAGE_ID.DIABETE, 0, tab);
    },

    // endregion

    // region 生活习惯页（diabetelife）

    lifeExposure: function () {
      post(ACTION_EXPOSURE, EVENT_NAME.DIABETE_LIFE_EXPOSURE, PAGE_ID.DIABETE_LIFE);
    },
    lifePageClick: function () {
      post(ACTION_CLICK, EVENT_NAME.DIABETE_LIFE_CLICK, PAGE_ID.DIABETE_LIFE);
    },
    lifeNextClick: function () {
      post(ACTION_CLICK, EVENT_NAME.DIABETE_LIFE_NEXT_CLICK, PAGE_ID.DIABETE_LIFE);
    },

    // endregion

    // region 录入方式埋点（产品 actionName 为 diabeteinsert_*，实际在上传页 Stage.UPLOAD 触发）

    insertExposure: function () {
      post(ACTION_EXPOSURE, EVENT_NAME.DIABETE_INSERT_EXPOSURE, PAGE_ID.DIABETE_INSERT);
    },
    insertPageClick: function () {
      post(ACTION_CLICK, EVENT_NAME.DIABETE_INSERT_CLICK, PAGE_ID.DIABETE_INSERT);
    },
    insertUploadClick: function () {
      post(ACTION_CLICK, EVENT_NAME.DIABETE_INSERT_UPLOAD_CLICK, PAGE_ID.DIABETE_INSERT);
    },
    insertEditClick: function () {
      post(ACTION_CLICK, EVENT_NAME.DIABETE_INSERT_EDIT_CLICK, PAGE_ID.DIABETE_INSERT);
    },
    /** 上传页整体点击：与按钮级埋点叠加上报 */
    uploadPageClick: function (hasFiles) {
      this.insertPageClick();
      if (hasFiles) {
        this.uploadCompletePageClick();
      }
    },

    // endregion

    // region 报告上传完成页（diabeteupload）

    uploadCompleteExposure: function () {
      post(ACTION_EXPOSURE, EVENT_NAME.DIABETE_UPLOAD_EXPOSURE, PAGE_ID.DIABETE_UPLOAD);
    },
    uploadCompletePageClick: function () {
      post(ACTION_CLICK, EVENT_NAME.DIABETE_UPLOAD_CLICK, PAGE_ID.DIABETE_UPLOAD);
    },
    uploadAiClick: function () {
      post(ACTION_CLICK, EVENT_NAME.DIABETE_UPLOAD_AI_CLICK, PAGE_ID.DIABETE_UPLOAD);
    },
    uploadEditClick: function () {
      post(ACTION_CLICK, EVENT_NAME.DIABETE_UPLOAD_EDIT_CLICK, PAGE_ID.DIABETE_UPLOAD);
    },

    // endregion

    // region 手输血糖血脂页（diabeteglu）

    gluExposure: function () {
      post(ACTION_EXPOSURE, EVENT_NAME.DIABETE_GLU_EXPOSURE, PAGE_ID.DIABETE_GLU);
    },
    gluPageClick: function () {
      post(ACTION_CLICK, EVENT_NAME.DIABETE_GLU_CLICK, PAGE_ID.DIABETE_GLU);
    },
    gluNextClick: function () {
      post(ACTION_CLICK, EVENT_NAME.DIABETE_GLU_NEXT_CLICK, PAGE_ID.DIABETE_GLU);
    },

    // endregion

    // region 手输肝肾功能页（diabeteLR）

    lrExposure: function () {
      post(ACTION_EXPOSURE, EVENT_NAME.DIABETE_LR_EXPOSURE, PAGE_ID.DIABETE_LR);
    },
    lrPageClick: function () {
      post(ACTION_CLICK, EVENT_NAME.DIABETE_LR_CLICK, PAGE_ID.DIABETE_LR);
    },
    lrAiClick: function () {
      post(ACTION_CLICK, EVENT_NAME.DIABETE_LR_AI_CLICK, PAGE_ID.DIABETE_LR);
    },

    // endregion

    // region 分析结果页（diabeteresult）

    resultExposure: function (source) {
      post(ACTION_EXPOSURE, EVENT_NAME.DIABETE_RESULT_EXPOSURE, PAGE_ID.DIABETE_RESULT, source);
    },
    resultPageClick: function (source) {
      post(ACTION_CLICK, EVENT_NAME.DIABETE_RESULT_CLICK, PAGE_ID.DIABETE_RESULT, source);
    },
    resultAskAiClick: function (source) {
      post(ACTION_CLICK, EVENT_NAME.DIABETE_RESULT_ASK_AI_CLICK, PAGE_ID.DIABETE_RESULT, source);
    },

    // endregion

    // region 问 AI 对话页（diabeteask）

    askExposure: function () {
      post(ACTION_EXPOSURE, EVENT_NAME.DIABETE_ASK_EXPOSURE, PAGE_ID.DIABETE_ASK);
    },
    askPageClick: function () {
      post(ACTION_CLICK, EVENT_NAME.DIABETE_ASK_CLICK, PAGE_ID.DIABETE_ASK);
    },

    // endregion

    bindPageClick: bindPageClick,
    extendInfo: extendInfo,
  };
})(typeof window !== "undefined" ? window : globalThis);
