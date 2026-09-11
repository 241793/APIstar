/* ============================================================
   APIStar 共享工具库
   ============================================================ */

/* ---------------- 鉴权与请求 ---------------- */
const Auth = {
  get token() { return localStorage.getItem("apistar_token") || ""; },
  get user() {
    try { return JSON.parse(localStorage.getItem("apistar_user") || "null"); }
    catch (e) { return null; }
  },
  save(token, user) {
    localStorage.setItem("apistar_token", token);
    localStorage.setItem("apistar_user", JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem("apistar_token");
    localStorage.removeItem("apistar_user");
  },
  /** 页面守卫：未登录跳转登录页；role 不符跳转到对应端 */
  guard(role) {
    const u = this.user;
    if (!this.token || !u) { location.replace("/login"); return null; }
    if (role === "admin" && u.role !== "admin") { location.replace("/console"); return null; }
    return u;
  }
};

async function api(path, opts = {}) {
  const { method = "GET", body, silent } = opts;
  const headers = { "Authorization": "Bearer " + Auth.token };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let res;
  try {
    res = await fetch(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch (e) {
    throw new Error("网络连接失败，请检查服务是否运行");
  }
  if (res.status === 401) {
    Auth.clear();
    location.replace("/login");
    throw new Error("登录已过期");
  }
  let data = {};
  try { data = await res.json(); } catch (e) { /* ignore */ }
  if (!res.ok) {
    const msg = data.detail || ("请求失败 (" + res.status + ")");
    if (!silent) toast(msg, "error");
    throw new Error(msg);
  }
  return data;
}

/* ---------------- 基础工具 ---------------- */
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function fmtNum(n) {
  n = Number(n) || 0;
  return n >= 10000 ? (n / 10000).toFixed(n % 10000 === 0 ? 0 : 1) + "w" : n.toLocaleString("en-US");
}
function fmtFull(n) { return (Number(n) || 0).toLocaleString("en-US"); }
function debounce(fn, ms = 350) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
function initials(name) {
  return (name || "?").trim().slice(0, 1).toUpperCase();
}

/* ---------------- Toast ---------------- */
function toast(msg, type = "success", ms = 2400) {
  let wrap = document.getElementById("toast-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "toast-wrap";
    document.body.appendChild(wrap);
  }
  const icons = { success: "✓", error: "✕", warn: "!", info: "i" };
  const el = document.createElement("div");
  el.className = "toast " + type;
  el.innerHTML = '<span class="ticon">' + (icons[type] || "i") + '</span><span>' + esc(msg) + "</span>";
  wrap.appendChild(el);
  setTimeout(() => {
    el.classList.add("out");
    el.addEventListener("animationend", () => el.remove(), { once: true });
  }, ms);
}

/* ---------------- 弹窗 ---------------- */
function openModal(html, { width } = {}) {
  let mask = document.createElement("div");
  mask.className = "modal-mask";
  mask.innerHTML = '<div class="modal"' + (width ? ' style="width:' + width + 'px"' : "") + ">" + html + "</div>";
  document.body.appendChild(mask);
  mask.classList.add("open");  // 同步添加，避免后台标签页 rAF 节流导致弹窗不显示
  const close = () => {
    mask.classList.remove("open");
    setTimeout(() => mask.remove(), 180);
  };
  mask.addEventListener("mousedown", e => { if (e.target === mask) close(); });
  mask.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", close));
  mask.close = close;
  return mask;
}

function confirmDialog(title, text, { danger = true, okText = "确认删除" } = {}) {
  return new Promise(resolve => {
    const mask = openModal(
      '<div class="modal-head"><b>' + esc(title) + '</b><button class="close" data-close>✕</button></div>' +
      '<div class="modal-body" style="color:var(--text-2);font-size:13.5px;line-height:1.7;padding-top:6px">' + text + "</div>" +
      '<div class="modal-foot">' +
      '<button class="btn btn-ghost" data-close>取消</button>' +
      '<button class="btn ' + (danger ? "btn-danger" : "btn-primary") + '" id="_cfm-ok">' + esc(okText) + "</button></div>",
      { width: 420 });
    mask.querySelector("#_cfm-ok").addEventListener("click", () => { mask.close(); resolve(true); });
    mask.addEventListener("mousedown", e => {
      if (e.target === mask) resolve(false);
      const c = e.target.closest("[data-close]");
      if (c) resolve(false);
    });
  });
}

/* ---------------- 徽标渲染 ---------------- */
function methodBadge(m) {
  const k = (m || "").toLowerCase();
  return '<span class="badge ' + k + '">' + esc(m) + "</span>";
}

function apiStatusTag(s) {
  if (s === "online") return '<span class="tag green"><i class="dot pulse"></i>在线</span>';
  if (s === "maintaining") return '<span class="tag amber"><i class="dot pulse"></i>维护中</span>';
  return '<span class="tag gray"><i class="dot"></i>已下线</span>';
}

function apiTypeTag(t) {
  if (t === "builtin") return '<span class="tag cyan"><i class="dot"></i>内置服务</span>';
  if (t === "plugin") return '<span class="tag amber"><i class="dot"></i>插件接口</span>';
  if (t === "external") return '<span class="tag blue"><i class="dot"></i>外部接口</span>';
  return '<span class="tag gray"><i class="dot"></i>自定义</span>';
}

function authTypeTag(a) {
  return a === "open"
    ? '<span class="tag green"><i class="dot"></i>免登录</span>'
    : '<span class="tag purple"><i class="dot"></i>需密钥</span>';
}

function codePill(code) {
  const cls = code >= 500 ? "c5" : code >= 400 ? "c4" : "c2";
  return '<span class="code-pill ' + cls + '">' + code + "</span>";
}

function latencyTag(ms) {
  const color = ms < 300 ? "#16a34a" : ms < 800 ? "#d97706" : "#dc2626";
  return '<span class="num" style="color:' + color + ';font-weight:600">' + ms + ' <small style="font-weight:400">ms</small></span>';
}

function userStatusSwitch(id, status, disabled) {
  return '<label class="switch" title="' + (disabled ? "不可操作" : "点击切换状态") + '">' +
    '<input type="checkbox" ' + (status ? "checked" : "") + (disabled ? " disabled" : "") +
    ' data-user-switch="' + id + '"><i></i></label>';
}

/* ---------------- 分页 ---------------- */
function renderPagination(el, total, page, pageSize, onChange) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) {
    el.innerHTML = '<span class="total">共 ' + fmtFull(total) + " 条</span>";
    return;
  }
  const nums = [];
  const win = 2;
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= win) nums.push(i);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }
  let html = '<span class="total">共 ' + fmtFull(total) + " 条 · 第 " + page + "/" + pages + " 页</span>" +
    '<button class="pg-btn" data-p="' + (page - 1) + '" ' + (page <= 1 ? "disabled" : "") + ">‹</button>";
  nums.forEach(n => {
    html += n === "…"
      ? '<span class="pg-btn" style="border:none;background:none;cursor:default">…</span>'
      : '<button class="pg-btn ' + (n === page ? "active" : "") + '" data-p="' + n + '">' + n + "</button>";
  });
  html += '<button class="pg-btn" data-p="' + (page + 1) + '" ' + (page >= pages ? "disabled" : "") + ">›</button>";
  el.innerHTML = html;
  el.querySelectorAll("[data-p]").forEach(b =>
    b.addEventListener("click", () => {
      const p = Number(b.dataset.p);
      if (p >= 1 && p <= pages && p !== page) onChange(p);
    }));
}

/* ---------------- 代码编辑器 / 代码块 ---------------- */
/**
 * 轻量代码编辑器：行号栏 + Tab 缩进 + 复制按钮，底层仍是原生 textarea（保证取值逻辑不变）
 * 返回 { getValue, setValue, focus }
 */
function createCodeEditor(host, { value = "", rows = 12, minHeight } = {}) {
  host.classList.add("code-editor");
  host.innerHTML =
    '<div class="ce-gutter"></div>' +
    '<div class="ce-area">' +
      '<button class="ce-copy" type="button" title="复制代码">📋 复制</button>' +
      '<textarea spellcheck="false" autocomplete="off" wrap="off"></textarea>' +
    "</div>";
  const gutter = host.querySelector(".ce-gutter");
  const ta = host.querySelector("textarea");
  ta.value = value;
  ta.rows = rows;
  if (minHeight) ta.style.minHeight = minHeight + "px";

  const sync = () => {
    const n = ta.value.split("\n").length;
    gutter.textContent = Array.from({ length: n }, (_, i) => i + 1).join("\n");
    gutter.scrollTop = ta.scrollTop;
  };
  ta.addEventListener("input", sync);
  ta.addEventListener("scroll", sync);
  ta.addEventListener("keydown", e => {
    // Tab / Shift+Tab 缩进，而不是跳出输入框
    if (e.key === "Tab") {
      e.preventDefault();
      const s = ta.selectionStart, t = ta.selectionEnd, v = ta.value;
      if (s === t && !e.shiftKey) {
        ta.value = v.slice(0, s) + "    " + v.slice(t);
        ta.selectionStart = ta.selectionEnd = s + 4;
      } else {
        const lineStart = v.lastIndexOf("\n", s - 1) + 1;
        const block = v.slice(lineStart, t);
        const shifted = e.shiftKey
          ? block.replace(/^ {1,4}/gm, "")
          : block.replace(/^/gm, "    ");
        ta.value = v.slice(0, lineStart) + shifted + v.slice(t);
        ta.selectionStart = lineStart;
        ta.selectionEnd = lineStart + shifted.length;
      }
      sync();
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  host.querySelector(".ce-copy").addEventListener("click", async e => {
    await copyText(ta.value, e.currentTarget);
  });
  sync();
  return {
    getValue: () => ta.value,
    setValue: v => { ta.value = v; sync(); },
    focus: () => ta.focus(),
    el: ta
  };
}

/** 把普通元素升级为带复制按钮的代码块 */
function withCopyBlock(el) {
  if (!el || el.querySelector(".cb-copy")) return el;
  el.classList.add("code-block");
  const btn = document.createElement("button");
  btn.className = "cb-copy";
  btn.type = "button";
  btn.textContent = "📋 复制";
  btn.addEventListener("click", async () => await copyText(el.textContent, btn));
  el.appendChild(btn);
  return el;
}

/** 复制文本到剪贴板（带降级方案） */
async function copyText(text, btn, msg) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta);
    ta.select(); document.execCommand("copy"); ta.remove();
  }
  if (btn) {
    const old = btn.textContent;
    btn.textContent = "✓ 已复制";
    btn.classList.add("copied-flash");
    setTimeout(() => { btn.textContent = old; btn.classList.remove("copied-flash"); }, 1400);
  }
  toast(msg || "已复制到剪贴板", "success", 1400);
}

/* ---------------- JSON 高亮 ---------------- */
function highlightJSON(obj) {
  const json = JSON.stringify(obj, null, 2);
  return esc(json).replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    m => {
      let cls = "jn";
      if (/^"/.test(m)) cls = /:$/.test(m) ? "jk" : "js";
      else if (/true|false/.test(m)) cls = "jb";
      else if (/null/.test(m)) cls = "jb";
      return '<span class="' + cls + '">' + m + "</span>";
    });
}

/* ---------------- ECharts 公共主题 ---------------- */
const CHART_COLORS = ["#2e7cf6", "#10b981", "#f59e0b", "#f43f5e", "#06b6d4", "#8b5cf6", "#ec4899", "#14b8a6"];

function initChart(el) {
  const chart = echarts.init(el);
  window.addEventListener("resize", () => chart.resize());
  return chart;
}

const AXIS_STYLE = {
  axisLine: { lineStyle: { color: "#e2e8f0" } },
  axisTick: { show: false },
  axisLabel: { color: "#94a3b8", fontSize: 11 },
  splitLine: { lineStyle: { color: "#eef2f7" } }
};

/* ---------------- 图标 ---------------- */
const ICONS = {
  dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  api: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  logs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  market: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
  key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>',
  plugin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 11H19V7a2 2 0 0 0-2-2h-4V3.5a2.5 2.5 0 0 0-5 0V5H4a2 2 0 0 0-2 2v3.8h1.5a2.7 2.7 0 0 1 0 5.4H2V20a2 2 0 0 0 2 2h3.8v-1.5a2.7 2.7 0 0 1 5.4 0V22H17a2 2 0 0 0 2-2v-4h1.5a2.5 2.5 0 0 0 0-5z"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  empty: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>'
};

/* ---------------- 密码强度校验（与后端策略保持一致） ---------------- */
const WEAK_PWDS = ["123456", "1234567", "12345678", "123456789", "111111", "000000", "123123",
  "abc123", "a123456", "password", "passwd", "admin", "admin123", "root", "qwerty",
  "iloveyou", "letmein", "welcome", "test123", "user123"];

function checkPwdStrength(pwd) {
  if (!pwd || pwd.length < 8) { toast("密码至少 8 位", "warn"); return false; }
  if (WEAK_PWDS.indexOf(pwd.toLowerCase()) >= 0) { toast("该密码过于常见，请更换", "warn"); return false; }
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(r => r.test(pwd)).length;
  if (kinds < 2) { toast("密码需包含字母、数字、符号中的至少两类", "warn"); return false; }
  return true;
}
