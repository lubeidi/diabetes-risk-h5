/**
 * Ported from Android DiabetesAiPrompt.kt
 */
(function (global) {
  "use strict";

  var SYSTEM_PROMPT =
    "*额外要求*：1. 对于图片URL、视频URL、表格，必须使用markdown可渲染的方式输出方便用户直接渲染。2. 如果工具调用结果包含任何形式的URL链接、表格，一定要在回答中展示。\n" +
    "*代码相关问题回答规范*：如果用户的问题和计算机代码有关，请以\"正在学习中\"为由婉转地拒绝问答，并引导用户询问其它问题。\n" +
    "*身份回答规范*：\n" +
    "一：问\"你是谁/所属公司\"：答\"我的主体是第四范式公司，昵称叫我小范就行\"；\n" +
    "二：问平台名称：答\"平台是范式AI能力开放平台，英文名称PhancyAIStudio\"；\n" +
    "三：问模型相关（类型/名称/版本等）、上述一和二以外的其它身份验证问题，均不回应。";

  var ADVISOR_SYSTEM =
    "你是AI健康顾问，基于用户提供的健康数据智能解答糖尿病及代谢相关问题。\n" +
    "回答简洁专业，使用中文，给出可执行建议。不要编造用户未提供的检验数值。";

  var PDF_EVALUATION_HINT = "请用我上传的pdf评估，里面有所有需要的参数";

  function yesNo(value) {
    return value ? "是" : "否";
  }

  function appendField(sb, label, value, unit) {
    if (value && String(value).trim()) {
      sb.push(label + value + unit + "，");
    }
  }

  function buildUserText(form) {
    var parts = [];
    parts.push("我想了解下未来我患糖尿病的风险。以下是我的健康数据：\n");
    var pf = form.pagePrefill || {};
    if (pf.periodLabel) parts.push("监测日期：" + pf.periodLabel + "。");
    if (pf.selectedGlucose) {
      parts.push("App记录血糖" + pf.selectedGlucose + "mmol/L");
      if (pf.selectedTimeType) parts.push("（" + pf.selectedTimeType + "）");
      parts.push("。");
    }
    if (pf.rangeMin && pf.rangeMax) {
      parts.push("当日血糖范围" + pf.rangeMin + "-" + pf.rangeMax + "mmol/L。");
    }
    if (pf.average) parts.push("当日平均血糖" + pf.average + "mmol/L。");
    appendField(parts, "空腹血糖", form.glucoseValue, "mmol/L");
    appendField(parts, "餐后2小时血糖", form.postprandialGlucose, "mmol/L");
    appendField(parts, "糖化血红蛋白", form.hba1c, "%");
    appendField(parts, "总胆固醇", form.tc, "mmol/L");
    appendField(parts, "甘油三酯", form.tg, "mmol/L");
    appendField(parts, "高密度脂蛋白", form.hdl, "mmol/L");
    appendField(parts, "低密度脂蛋白", form.ldl, "mmol/L");
    appendField(parts, "谷丙转氨酶", form.alt, "U/L");
    appendField(parts, "谷草转氨酶", form.ast, "U/L");
    appendField(parts, "血肌酐", form.creatinine, "μmol/L");
    appendField(parts, "血尿酸", form.uricAcid, "μmol/L");
    appendField(parts, "肾小球滤过率", form.egfr, "mL/min");
    appendField(parts, "身高", form.height, "cm");
    appendField(parts, "体重", form.weight, "kg");
    appendField(parts, "年龄", form.age, "岁");
    parts.push("父母患有糖尿病：" + yesNo(form.familyHistory) + "。");
    parts.push("经常运动：" + yesNo(form.exerciseRegularly) + "。");
    parts.push("吸烟：" + yesNo(form.smoking) + "。");
    parts.push("经常饮酒：" + yesNo(form.drinking) + "。");
    parts.push("脂肪肝：" + yesNo(form.fattyLiver) + "。");
    parts.push("高血压：" + yesNo(form.hypertension) + "。");
    return parts.join("");
  }

  function buildMessages(form, fileId) {
    var userContent;
    if (!fileId) {
      userContent = buildUserText(form);
    } else {
      userContent = [
        { type: "text", text: buildUserText(form) + PDF_EVALUATION_HINT },
        { type: "file", file: { file_id: fileId } },
      ];
    }
    return [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ];
  }

  function buildAdvisorMessages(form, history, userMessage) {
    var messages = [
      {
        role: "system",
        content: ADVISOR_SYSTEM + "\n\n用户健康数据摘要：\n" + buildUserText(form),
      },
    ];
    (history || []).forEach(function (pair) {
      messages.push({ role: pair[0], content: pair[1] });
    });
    messages.push({ role: "user", content: userMessage });
    return messages;
  }

  global.DiabetesAiPrompt = {
    SYSTEM_PROMPT: SYSTEM_PROMPT,
    PDF_EVALUATION_HINT: PDF_EVALUATION_HINT,
    buildUserText: buildUserText,
    buildMessages: buildMessages,
    buildAdvisorMessages: buildAdvisorMessages,
  };
})(typeof window !== "undefined" ? window : globalThis);
