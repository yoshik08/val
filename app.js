/* val frontend: riot connect, daily shop, live match */
(function () {
"use strict";
const API = () => window.VAL_API || "";
const $ = (id) => document.getElementById(id);

/* theme (match yoshik.xyz) */
$("theme-btn").onclick = () => {
  const el = document.documentElement;
  const next = el.dataset.theme === "dark" ? "light" : "dark";
  el.dataset.theme = next;
  try { localStorage.setItem("val-theme", next); } catch (e) {}
};

async function call(path, opts) {
  opts = opts || {};
  const headers = { ...(opts.headers || {}) };
  let body = opts.body;
  if (body && typeof body === "object") { headers["Content-Type"] = "application/json"; body = JSON.stringify(body); }
  let r;
  try { r = await fetch(API() + path, { ...opts, headers, body }); }
  catch (e) { throw new Error("api unreachable"); }
  let d = null;
  try { d = await r.json(); } catch (e) {}
  if (!r.ok) throw new Error((d && d.error) || ("request failed: " + r.status));
  return d;
}

let mfaId = null;

async function refreshStatus() {
  try {
    const s = await call("/api/status");
    if (s.connected) {
      $("acct").textContent = s.gameName + " #" + s.tagLine;
      $("acct").classList.add("on");
      $("login-sec").classList.add("hidden");
      $("empty").classList.add("hidden");
      $("shop-sec").classList.remove("hidden");
      $("match-sec").classList.remove("hidden");
      $("disconnect-btn").classList.remove("hidden");
      loadShop(); loadMatch();
    } else {
      $("login-sec").classList.remove("hidden");
    }
  } catch (e) { $("login-err").textContent = e.message; }
}

$("connect-btn").onclick = async () => {
  $("login-err").textContent = "";
  try {
    const d = await call("/api/connect", { method: "POST",
      body: { username: $("ri").value.trim(), password: $("rp").value } });
    if (d.mfa) { mfaId = d.mfaId; $("mfa-row").classList.remove("hidden"); $("login-err").textContent = "2fa code sent — enter it below"; }
    else location.reload();
  } catch (e) { $("login-err").textContent = e.message; }
};

$("mfa-btn").onclick = async () => {
  $("login-err").textContent = "";
  try {
    await call("/api/connect/mfa", { method: "POST", body: { mfaId, code: $("mfa-code").value.trim() } });
    location.reload();
  } catch (e) { $("login-err").textContent = e.message; }
};

$("disconnect-btn").onclick = async () => {
  await call("/api/disconnect", { method: "POST" });
  location.reload();
};

function fmtTime(s) {
  s = Math.max(0, s | 0);
  const h = (s / 3600) | 0, m = ((s % 3600) / 60) | 0, sec = s % 60;
  return h + "h " + m + "m " + sec + "s";
}

async function loadShop() {
  try {
    const d = await call("/api/shop");
    $("shop-timer").textContent = "resets in " + fmtTime(d.expiresIn);
    $("shop-grid").innerHTML = d.offers.map((o) =>
      `<div class="offer">` +
      (o.icon ? `<img src="${o.icon}" alt="" loading="lazy">` : "") +
      `<div class="info"><div class="name">${esc(o.name)}</div>` +
      `<div class="weapon">${esc(o.weapon)}</div>` +
      `<div class="price">${o.price != null ? o.price.toLocaleString() + " VP" : "—"}</div></div></div>`
    ).join("");
  } catch (e) { $("shop-grid").innerHTML = `<p class="err">${esc(e.message)}</p>`; }
}

function teamList(players) {
  if (!players || !players.length) return "";
  return `<div class="team-list">` + players.map((p) =>
    `<div class="p"><span>${esc(p.name)}</span>${p.agent ? `<span class="a">${esc(p.agent)}</span>` : ""}</div>`
  ).join("") + `</div>`;
}

async function loadMatch() {
  try {
    const m = await call("/api/match");
    const el = $("match-body");
    if (!m.inGame) {
      el.innerHTML = `<p class="dim">not in a match right now. queue up and this updates live.</p>`;
    } else if (m.phase === "pregame") {
      el.innerHTML = `<div class="match-live">` +
        `<span class="pill pregame">agent select</span>` +
        `<h3 style="margin-top:8px">${esc(m.map)}${m.mode ? ` <span class="dim">· ${esc(m.mode)}</span>` : ""}</h3>` +
        (m.myAgent ? `<p class="match-meta">you locked <b>${esc(m.myAgent)}</b></p>` : `<p class="match-meta">picking agents…</p>`) +
        teamList(m.teammates) + `</div>`;
    } else {
      el.innerHTML = `<div class="match-live">` +
        `<span class="pill live">in match</span>` +
        `<h3 style="margin-top:8px">${esc(m.map)}${m.mode ? ` <span class="dim">· ${esc(m.mode)}</span>` : ""}</h3>` +
        (m.myAgent ? `<p class="match-meta">playing <b>${esc(m.myAgent)}</b></p>` : "") +
        teamList(m.teammates) + `</div>`;
    }
    $("match-refresh").textContent = "updated " + new Date().toLocaleTimeString();
  } catch (e) { $("match-body").innerHTML = `<p class="err">${esc(e.message)}</p>`; }
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

refreshStatus();
setInterval(() => { if (!$("match-sec").classList.contains("hidden")) loadMatch(); }, 30000);
})();
