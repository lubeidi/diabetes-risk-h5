/**
 * Native bridge + browser fallback for diabetes-risk-h5 tracking.
 *
 * Native（生产）:
 *   android_common.getTrackingCommonInfo() / WearfitBridge.getTrackingCommonInfo()
 *   android_common.reportEvent(type, name, pageId, extendJson)
 *   WearfitBridge.reportEvent / webkit.messageHandlers.reportEvent
 *
 * 浏览器调试 fallback:
 *   POST DIABETES_TRACKING_PUSH_URL（默认 micro-life/tracking/push）
 */
(function (global) {
  "use strict";

  var FALLBACK_QUEUE = [];
  var flushTimer = null;
  var cachedCommon = null;
  var fallbackSessionId = "s_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  var fallbackLaunchId = "l_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);

  function callBridge(method, args) {
    args = args || [];
    try {
      if (global.WearfitBridge && typeof global.WearfitBridge[method] === "function") {
        return global.WearfitBridge[method].apply(global.WearfitBridge, args);
      }
      if (global.android_common && typeof global.android_common[method] === "function") {
        return global.android_common[method].apply(global.android_common, args);
      }
      if (global.webkit && global.webkit.messageHandlers && global.webkit.messageHandlers[method]) {
        global.webkit.messageHandlers[method].postMessage(args.length === 1 ? args[0] : args);
        return true;
      }
    } catch (e) {
      console.warn("[DiabetesBridge]", method, e);
    }
    return null;
  }

  function hasNativeReportEvent() {
    if (global.WearfitBridge && typeof global.WearfitBridge.reportEvent === "function") return true;
    if (global.android_common && typeof global.android_common.reportEvent === "function") return true;
    if (global.webkit && global.webkit.messageHandlers && global.webkit.messageHandlers.reportEvent) return true;
    return false;
  }

  function isInApp() {
    try {
      var q = new URLSearchParams(global.location.search);
      if (q.get("inApp") === "1") return true;
    } catch (e) {
      /* ignore */
    }
    if (global.__NATIVE_COMMON__) return true;
    if (global.android_common || global.WearfitBridge) return true;
    return /WearfitPro/i.test(navigator.userAgent || "");
  }

  function parseCommon(raw) {
    if (!raw) return null;
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch (e) {
        return null;
      }
    }
    return raw;
  }

  function deviceId() {
    var key = "diabetes_h5_device_id";
    var id = null;
    try {
      id = global.localStorage.getItem(key);
    } catch (e) {
      /* ignore */
    }
    if (!id) {
      id = "web_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
      try {
        global.localStorage.setItem(key, id);
      } catch (e2) {
        /* ignore */
      }
    }
    return id;
  }

  function detectOs(ua) {
    if (/android/i.test(ua)) return "Android";
    if (/iPad|iPhone|iPod/i.test(ua)) return "iOS";
    if (/Windows/i.test(ua)) return "Windows";
    if (/Mac/i.test(ua)) return "macOS";
    return "unknown";
  }

  function detectOsVersion(ua) {
    var m = ua.match(/Android\s([\d.]+)/);
    if (m) return m[1];
    m = ua.match(/OS\s([\d_]+)/);
    return m ? m[1].replace(/_/g, ".") : "";
  }

  function detectModel(ua) {
    var m = ua.match(/;\s*([^;)]+)\s*Build\//);
    if (m) return m[1].trim();
    if (/iPad/i.test(ua)) return "iPad";
    if (/iPhone/i.test(ua)) return "iPhone";
    return "web";
  }

  function detectNetworkType() {
    var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return (conn && conn.effectiveType) || "unknown";
  }

  function detectAreaType() {
    if (global.__IS_OVERSEAS__ === true) return "2";
    var lang = navigator.language || "";
    return /^zh/i.test(lang) ? "1" : "2";
  }

  function readUserIdFromQuery() {
    try {
      return new URLSearchParams(global.location.search).get("userId") || "";
    } catch (e) {
      return "";
    }
  }

  function buildFallbackCommon() {
    var ua = navigator.userAgent || "";
    return {
      userId: readUserIdFromQuery(),
      eId: deviceId(),
      appVersion: "1.0.0",
      areaType: detectAreaType(),
      country: "",
      city: "",
      province: "",
      longitude: 0,
      latitude: 0,
      ip: "",
      networkType: detectNetworkType(),
      model: detectModel(ua),
      os: detectOs(ua),
      osVersion: detectOsVersion(ua),
      businessType: "h5",
      channelId: "h5_organic",
      appId: "",
      expIds: "",
      currentMemory: 0,
      totalMemory: 0,
      sessionID: fallbackSessionId,
      launchID: fallbackLaunchId,
    };
  }

  function getTrackingCommonInfo() {
    if (cachedCommon) return cachedCommon;
    if (global.__NATIVE_COMMON__) {
      cachedCommon = global.__NATIVE_COMMON__;
      return cachedCommon;
    }
    var raw = callBridge("getTrackingCommonInfo");
    var parsed = parseCommon(raw);
    if (parsed) {
      cachedCommon = parsed;
      return cachedCommon;
    }
    if (isInApp()) return {};
    cachedCommon = buildFallbackCommon();
    return cachedCommon;
  }

  function trackingPushUrl() {
    if (global.DIABETES_TRACKING_PUSH_URL) return global.DIABETES_TRACKING_PUSH_URL;
    try {
      var host = global.location && global.location.hostname;
      if (host === "127.0.0.1" || host === "localhost") {
        return "/microLife/tracking/push";
      }
    } catch (e) {
      /* ignore */
    }
    if (global.__IS_OVERSEAS__ === true) {
      return "https://micro-life.iwhop.com/microLife/tracking/push";
    }
    return "https://micro-life.iwhop.cn/microLife/tracking/push";
  }

  function makeActionId() {
    return String(Date.now()) + String(Math.floor(1000 + Math.random() * 9000));
  }

  function randomUuid() {
    if (global.crypto && typeof global.crypto.randomUUID === "function") {
      return global.crypto.randomUUID().replace(/-/g, "");
    }
    return (
      Date.now().toString(16) +
      Math.random().toString(16).slice(2) +
      Math.random().toString(16).slice(2)
    );
  }

  function parseExtend(extendJson) {
    if (!extendJson) return {};
    if (typeof extendJson === "object") return extendJson;
    try {
      return JSON.parse(extendJson);
    } catch (e) {
      return {};
    }
  }

  function readSourcePageId() {
    try {
      var q = new URLSearchParams(global.location.search).get("sourcePageId");
      if (q) return q;
    } catch (e) {
      /* ignore */
    }
    return global.DIABETES_SOURCE_PAGE_ID || "";
  }

  function buildFallbackPayload(actionType, actionName, pageId, extendJson) {
    var extend = parseExtend(extendJson);
    if (!extend.uuid) extend.uuid = randomUuid();
    return {
      actionId: makeActionId(),
      actionType: actionType,
      actionName: actionName,
      pageId: pageId,
      sourcePageId: readSourcePageId(),
      currTime: Date.now(),
      extend: extend,
      common: getTrackingCommonInfo(),
    };
  }

  function flushFallbackQueue() {
    if (!FALLBACK_QUEUE.length) return;
    var batch = FALLBACK_QUEUE.splice(0, FALLBACK_QUEUE.length);
    var url = trackingPushUrl();
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batch),
      keepalive: true,
    }).catch(function () {
      FALLBACK_QUEUE.unshift.apply(FALLBACK_QUEUE, batch);
    });
  }

  function scheduleFallbackFlush() {
    if (flushTimer) return;
    flushTimer = setInterval(flushFallbackQueue, 5000);
  }

  function enqueueFallback(actionType, actionName, pageId, extendJson) {
    FALLBACK_QUEUE.push(buildFallbackPayload(actionType, actionName, pageId, extendJson));
    scheduleFallbackFlush();
    if (global.DIABETES_DEBUG_TRACK) {
      console.log("[DiabetesBridge:fallback]", actionType, actionName, pageId, extendJson);
    }
  }

  function reportEvent(actionType, actionName, pageId, extendJson) {
    var extend = typeof extendJson === "string" ? extendJson : JSON.stringify(extendJson || {});

    if (hasNativeReportEvent()) {
      callBridge("reportEvent", [actionType, actionName, pageId, extend]);
      return true;
    }

    if (!isInApp()) {
      enqueueFallback(actionType, actionName, pageId, extend);
      return true;
    }

    console.warn("[DiabetesBridge] reportEvent: in app but native bridge missing");
    return false;
  }

  function hasMethodOnBridge(bridge, method) {
    return !!(bridge && typeof bridge[method] === "function");
  }

  function hasWebkitHandler(name) {
    return !!(global.webkit && global.webkit.messageHandlers && global.webkit.messageHandlers[name]);
  }

  /** 按优先级探测 bridge 对象，只调用第一个命中的方法（避免 finish+goBack 双触发）。 */
  function invokeBridgeMethod(method, args) {
    args = args || [];
    var bridges = [
      global.WearfitBridge,
      global.android_common,
      global.ios_common,
      global.NativeBridge,
    ];
    var i;
    for (i = 0; i < bridges.length; i++) {
      if (hasMethodOnBridge(bridges[i], method)) {
        bridges[i][method].apply(bridges[i], args);
        return true;
      }
    }
    if (hasWebkitHandler(method)) {
      global.webkit.messageHandlers[method].postMessage(args.length === 1 ? args[0] : args);
      return true;
    }
    return false;
  }

  /**
   * 关闭 Native 容器页。preferGoBack=true 时优先 goBack（H5 内路由），否则优先 finish。
   * 仅调用一种 bridge 方法，不做返回值链式 fallback。
   */
  function closeNativePage(preferGoBack) {
    var primary = preferGoBack ? "goBack" : "finish";
    var secondary = preferGoBack ? "finish" : "goBack";
    if (invokeBridgeMethod(primary)) return true;
    return invokeBridgeMethod(secondary);
  }

  function finish() {
    return closeNativePage(false);
  }

  function goBack() {
    return closeNativePage(true);
  }

  function jumpNative(type, params) {
    var payload = params ? JSON.stringify(params) : "";
    return callBridge("jumpNative", [type, payload]);
  }

  global.addEventListener("beforeunload", function () {
    flushFallbackQueue();
    if (flushTimer) {
      clearInterval(flushTimer);
      flushTimer = null;
    }
  });

  global.DiabetesBridge = {
    getTrackingCommonInfo: getTrackingCommonInfo,
    reportEvent: reportEvent,
    finish: finish,
    goBack: goBack,
    jumpNative: jumpNative,
    isInApp: isInApp,
    hasNativeReportEvent: hasNativeReportEvent,
    flushFallbackQueue: flushFallbackQueue,
  };
})(typeof window !== "undefined" ? window : globalThis);
