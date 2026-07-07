/**
 * Diabetes form data model — aligned with Android DiabetesFormData.kt
 */
(function (global) {
  "use strict";

  function createFormData(prefill) {
    prefill = prefill || {};
    return {
      glucoseValue: "",
      postprandialGlucose: "",
      hba1c: "",
      tc: "",
      tg: "",
      hdl: "",
      ldl: "",
      alt: "",
      ast: "",
      creatinine: "",
      uricAcid: "",
      egfr: "",
      familyHistory: false,
      exerciseRegularly: true,
      smoking: false,
      drinking: false,
      fattyLiver: false,
      hypertension: false,
      height: "",
      weight: "",
      age: "",
      pagePrefill: {
        periodLabel: prefill.periodLabel || "",
        selectedGlucose: prefill.selectedGlucose || "",
        selectedTimeType: prefill.selectedTimeType || "",
        rangeMin: prefill.rangeMin || "",
        rangeMax: prefill.rangeMax || "",
        average: prefill.average || "",
      },
      uploadedFiles: [],
    };
  }

  function applyPrefill(form, prefill) {
    if (!prefill) return;
    form.pagePrefill = Object.assign({}, form.pagePrefill, prefill);
    if (!form.glucoseValue && prefill.selectedGlucose) {
      form.glucoseValue = prefill.selectedGlucose;
    }
  }

  function mergeParsed(form, other) {
    [
      "glucoseValue",
      "postprandialGlucose",
      "hba1c",
      "tc",
      "tg",
      "hdl",
      "ldl",
      "alt",
      "ast",
      "creatinine",
      "uricAcid",
      "egfr",
    ].forEach(function (key) {
      if (other[key] && String(other[key]).trim()) {
        form[key] = String(other[key]).trim();
      }
    });
  }

  function recognizedFieldCount(form) {
    return [
      form.glucoseValue,
      form.postprandialGlucose,
      form.hba1c,
      form.tc,
      form.tg,
      form.hdl,
      form.ldl,
      form.alt,
      form.ast,
      form.creatinine,
      form.uricAcid,
      form.egfr,
    ].filter(function (v) {
      return v && String(v).trim();
    }).length;
  }

  function recognizedMetrics(form) {
    var list = [];
    function add(label, value, unit) {
      if (value && String(value).trim()) list.push({ label: label, value: value, unit: unit });
    }
    add("空腹血糖", form.glucoseValue, "mmol/L");
    add("餐后2小时血糖", form.postprandialGlucose, "mmol/L");
    add("糖化血红蛋白", form.hba1c, "%");
    add("总胆固醇 (TC)", form.tc, "mmol/L");
    add("甘油三酯 (TG)", form.tg, "mmol/L");
    add("高密度脂蛋白", form.hdl, "mmol/L");
    add("低密度脂蛋白", form.ldl, "mmol/L");
    add("谷丙转氨酶", form.alt, "U/L");
    add("谷草转氨酶", form.ast, "U/L");
    add("血肌酐", form.creatinine, "μmol/L");
    add("血尿酸", form.uricAcid, "μmol/L");
    add("肾小球滤过率", form.egfr, "mL/min");
    return list;
  }

  global.DiabetesFormData = {
    create: createFormData,
    applyPrefill: applyPrefill,
    mergeParsed: mergeParsed,
    recognizedFieldCount: recognizedFieldCount,
    recognizedMetrics: recognizedMetrics,
  };
})(typeof window !== "undefined" ? window : globalThis);
