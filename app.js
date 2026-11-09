// ===== EDIT THIS =====
const CONFIG = { name1: "Abdul Moiz", name2: "Nimra Ali", monogram: "M&N" };
// =====================
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const norm = c => c.toUpperCase().replace(/[^A-Z0-9]/g, "");

$("monogram").textContent = CONFIG.monogram;
$("lt1").textContent = `${CONFIG.name1} & ${CONFIG.name2}`;
document.title = `${CONFIG.name1} & ${CONFIG.name2} | Wedding`;

function show(id){
  const cur = document.querySelector(".view.active");
  const next = $(id);
  cur.classList.remove("show");
  setTimeout(() => {
    cur.classList.remove("active"); next.classList.add("active");
    requestAnimationFrame(() => requestAnimationFrame(() => next.classList.add("show")));
    const f = next.querySelector("input"); if (f) f.focus();
  }, 800);
}
function toast(msg){
  const t = $("toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 4000);
}

// Show envelope on load
requestAnimationFrame(() => $("v-envelope").classList.add("show"));
$("openBtn").addEventListener("click", () => { $("env").classList.add("open"); setTimeout(() => show("v-code"), 6000); });

// Decrypt the invitation file that matches the code
async function unlock(raw){
  const code = norm(raw);
  if (code.length !== 8) throw new Error("notfound");
  if (!window.crypto || !crypto.subtle) throw new Error("insecure");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
  const name = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
  const r = await fetch(`data/${name}.json`, { cache: "no-store" });
  if (!r.ok) { console.warn("No file at", r.url, "status", r.status); throw new Error("notfound"); }
  const p = await r.json();
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(code), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: b64(p.salt), iterations: 200000, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(p.iv) }, key, b64(p.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}

$("codeInput").addEventListener("input", e => {
  const c = norm(e.target.value).slice(0, 8);
  e.target.value = c.length > 4 ? c.slice(0, 4) + "-" + c.slice(4) : c;
});

$("codeForm").addEventListener("submit", async e => {
  e.preventDefault();
  const btn = $("codeBtn"); btn.disabled = true; btn.textContent = "Checking...";
  const reset = () => { btn.disabled = false; btn.textContent = "View my invitation"; };
  let data;
  try { data = await unlock($("codeInput").value); }
  catch (err) {
    console.error(err);
    toast(err.message === "notfound" ? "That invitation code was not found. Please check your card and try again."
        : err.message === "insecure" ? "This page must be opened from the https website or http://localhost, not as a file."
        : "The invitation was found but could not be opened. The data files may be out of date.");
    return reset();
  }
  try { render(data); show("v-event"); }
  catch (err) { console.error(err); toast("The page files are out of sync. Please upload index.html and app.js from the same version."); }
  reset();
});


const MON=["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"], DAY=["SUN","MON","TUE","WED","THU","FRI","SAT"];
const NUM=["","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve"];
function renderDate(ev){
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ev.dateISO || "");
  if (!m) { $("datebar").textContent = ev.date; return; }
  const d = new Date(+m[1], +m[2]-1, +m[3]);
  $("datebar").innerHTML = `<span>${MON[d.getMonth()]}</span><i></i><span class="stack"><span>${DAY[d.getDay()]}</span><span>${d.getDate()}</span></span><i></i><span>${m[1]}</span>`;
}
function timeDigits(t){
  const m = /(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i.exec(t || "");
  if (!m) return t || "";
  let h = +m[1]; let ap = (m[3] || "").toUpperCase();
  if (!ap) ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m[2]} ${ap}`;
}

function render(d){
  const ev = d.event, n = d.guests.length;
  $("family").textContent = d.family;
  $("evName").textContent = ev.name;
  renderDate(ev);
  $("evTime").textContent = timeDigits(ev.time);
  $("evVenue").innerHTML = `${esc(ev.venue)}<br>${esc(ev.address)}`;
  $("evDress").textContent = ev.dressCode || "Formal";
  $("evNotes").textContent = ev.notes || "";
  if (ev.mapUrl) $("evMap").href = ev.mapUrl; else $("evMap").hidden = true;
  $("guestHead").textContent = n === 1 ? "This invitation is for 1 guest" : `This invitation is for ${n} guests`;
  $("guestList").innerHTML = d.guests.map(g => `<li>${esc(g)}</li>`).join("");
}
