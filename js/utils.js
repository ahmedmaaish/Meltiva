// ── Meltiva shared utilities ───────────────────────────────────────────────

export const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Money — Maldivian Rufiyaa
export function fmtMVR(n, withCode = true){
  const v = Number(n || 0);
  const s = v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return withCode ? `MVR ${s}` : s;
}
export function fmtNum(n){ return Number(n || 0).toLocaleString("en-US"); }

// Dates — stored as ISO (yyyy-mm-dd), shown as dd/mm/yyyy
export function fmtDate(iso){
  if(!iso) return "—";
  const [y,m,d] = String(iso).split("-");
  if(!y||!m||!d) return iso;
  return `${d}/${m}/${y}`;
}
export function fmtDateShort(iso){ // dd/mm
  if(!iso) return "—";
  const [,m,d] = String(iso).split("-");
  return `${d}/${m}`;
}
export function todayISO(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
export function monthKey(iso){ return iso ? String(iso).slice(0,7) : "unknown"; }
export function monthLabel(key){
  if(!key || key==="unknown") return "Unknown";
  const [y,m] = key.split("-");
  return `${MONTHS[Number(m)-1]} ${y}`;
}
export function daysSince(iso){
  if(!iso) return 1;
  const then = new Date(iso+"T00:00:00"); const now = new Date();
  return Math.max(1, Math.round((now - then) / 86400000));
}

// IDs
export function uid(prefix="x"){
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
}

// DOM helper — el("div.klass#id", {attrs}, [children|string])
export function el(spec, attrs = {}, children = []){
  const parts = String(spec).split(/(?=[.#])/);
  const tag = parts[0] && parts[0][0] !== "." && parts[0][0] !== "#" ? parts[0] : "div";
  const node = document.createElement(tag);
  for(const tok of parts){
    if(tok[0] === ".") node.classList.add(tok.slice(1));
    else if(tok[0] === "#") node.id = tok.slice(1);
  }
  for(const k in (attrs || {})){
    const v = attrs[k];
    if(v == null || v === false) continue;
    if(k === "class"){ node.className += " " + v; }
    else if(k === "html"){ node.innerHTML = v; }
    else if(k === "text"){ node.textContent = v; }
    else if(k === "dataset"){ Object.assign(node.dataset, v); }
    else if(typeof v === "function" && k.slice(0,2) === "on"){ node.addEventListener(k.slice(2).toLowerCase(), v); }
    else { node.setAttribute(k, v); }
  }
  const kids = Array.isArray(children) ? children : [children];
  for(const c of kids){
    if(c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}
export function icon(name, extra=""){
  return `<span class="ms ${extra}">${name}</span>`;
}
export function clear(node){ while(node && node.firstChild) node.removeChild(node.firstChild); return node; }
export function escapeHtml(s){
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

// Toast
export function toast(msg, kind=""){
  let wrap = document.querySelector(".toast-wrap");
  if(!wrap){ wrap = el("div.toast-wrap"); document.body.append(wrap); }
  const ico = kind==="good" ? "check_circle" : kind==="bad" ? "error" : "info";
  const t = el("div.toast"+(kind?"."+kind:""), { html:`${icon(ico)}<span>${escapeHtml(msg)}</span>` });
  wrap.append(t);
  setTimeout(()=>{ t.style.opacity="0"; t.style.transform="translateY(8px)"; setTimeout(()=>t.remove(),250); }, 2600);
}

// Confirm dialog (promise-based)
export function confirmDialog({ title="Are you sure?", body="", okText="Delete", danger=true }={}){
  return new Promise(resolve => {
    const back = el("div.modal-back");
    back.innerHTML = `
      <div class="modal" style="max-width:420px">
        <div class="modal-head"><span class="ms lead">help</span><h3>${escapeHtml(title)}</h3></div>
        <div class="modal-body"><p class="muted" style="margin:0;line-height:1.6">${escapeHtml(body)}</p></div>
        <div class="modal-foot">
          <button class="btn btn-ghost" data-x="no">Cancel</button>
          <button class="btn ${danger?"btn-danger":"btn-primary"}" data-x="yes">${escapeHtml(okText)}</button>
        </div>
      </div>`;
    const done = v => { back.remove(); resolve(v); };
    back.addEventListener("click", e => { if(e.target===back) done(false); });
    back.querySelector('[data-x="no"]').addEventListener("click", ()=>done(false));
    back.querySelector('[data-x="yes"]').addEventListener("click", ()=>done(true));
    document.body.append(back);
  });
}

// Generic modal — returns { back, body, foot, close }
export function openModal({ title="", icon:ic="edit", wide=false }={}){
  const back = el("div.modal-back");
  back.innerHTML = `
    <div class="modal ${wide?"wide":""}">
      <div class="modal-head"><span class="ms lead">${ic}</span><h3>${escapeHtml(title)}</h3>
        <button class="btn-icon" data-x="close" style="margin-left:auto"><span class="ms">close</span></button>
      </div>
      <div class="modal-body"></div>
      <div class="modal-foot"></div>
    </div>`;
  const close = ()=> back.remove();
  back.addEventListener("click", e => { if(e.target===back) close(); });
  back.querySelector('[data-x="close"]').addEventListener("click", close);
  document.body.append(back);
  return { back, body: back.querySelector(".modal-body"), foot: back.querySelector(".modal-foot"), close };
}

// CSV export + download
export function toCSV(headers, rows){
  const esc = v => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
  };
  return [headers.map(esc).join(","), ...rows.map(r => r.map(esc).join(","))].join("\r\n");
}
export function download(filename, content, mime="text/csv;charset=utf-8"){
  const blob = content instanceof Blob ? content : new Blob(["﻿"+content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = el("a", { href:url, download:filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

export function sum(arr, fn = x=>x){ return arr.reduce((a,b)=>a+(Number(fn(b))||0),0); }
export function groupBy(arr, keyFn){
  const m = new Map();
  for(const x of arr){ const k = keyFn(x); if(!m.has(k)) m.set(k,[]); m.get(k).push(x); }
  return m;
}
