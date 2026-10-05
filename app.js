/* val frontend: riot connect, daily shop, live match */
(function () {
"use strict";
const API = () => window.VAL_API || "";
const $ = (id) => document.getElementById(id);

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
      loadShop(); loadMatch();
      const disc = $("disconnect-btn");
      if (!disc) {
        const b = document.createElement("button");
        b.id = "disconnect-btn"; b.className = "ghost disconnect"; b.textContent = "disconnect";
        b.onclick = async () => { await call("/api/disconnect", { method: "POST" }); location.reload(); };
        $("match-sec").appendChild(b);
      }
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

async function loadMatch() {
  try {
    const m = await call("/api/match");
    const el = $("match-body");
    if (!m.inGame) {
      el.innerHTML = `<p class="dim">not in a match right now.</p>`;
    } else if (m.phase === "pregame") {
      el.innerHTML = `<div class="live"><h3>agent select</h3><p class="meta">picking agents…</p></div>`;
    } else {
      el.innerHTML = `<div class="live"><h3>${esc(m.map)} · ${esc(m.mode)}</h3>` +
        `<div class="score"><span class="us">${m.scoreUs}</span> — ${m.scoreThem}</div>` +
        `<p class="meta">round ${m.round}${m.agent ? " · playing " + esc(m.agent) : ""}</p></div>`;
    }
    const now = new Date();
    $("match-refresh").textContent = "updated " + now.toLocaleTimeString();
  } catch (e) { $("match-body").innerHTML = `<p class="err">${esc(e.message)}</p>`; }
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

refreshStatus();
setInterval(() => { if (!$("match-sec").classList.contains("hidden")) loadMatch(); }, 30000);
})();
