// ── Batch Log tab — track batches placed & expired per shop ─────────────────
import { store } from "../store.js";
import { el, icon, fmtNum, fmtMVR, fmtDate, todayISO, toast, openModal, confirmDialog,
         toCSV, download, sum, escapeHtml } from "../utils.js";

const state = { shop:"" };
const STATUSES = ["Placed","Billed","Expired"];

function filtered(){
  let rows = store.list("batches").slice();
  if(state.shop) rows = rows.filter(r => r.shopId === state.shop);
  return rows.sort((a,b)=> (b.date||"").localeCompare(a.date||""));
}

function openForm(existing){
  const isEdit = !!existing;
  const shops = store.shops().filter(s=>!s.isChannel);
  const m = openModal({ title:isEdit?"Edit batch":"Log a batch", icon:isEdit?"edit":"inventory_2" });
  const r = existing || { date:todayISO(), shopId:(shops[0]?.id||""), label:"", placed:"", expired:0, expiry:"", status:"Placed", notes:"" };
  m.body.innerHTML = `
    <div class="form-grid">
      <div class="form-grid cols-2">
        <label class="field">Date placed<input type="date" id="b_date" value="${r.date||todayISO()}"></label>
        <label class="field">Shop<select id="b_shop">${shops.map(s=>`<option value="${s.id}" ${s.id===r.shopId?"selected":""}>${escapeHtml(s.name)}</option>`).join("")}</select></label>
      </div>
      <div class="form-grid cols-2">
        <label class="field">Batch label<input id="b_label" value="${escapeHtml(r.label||"")}" placeholder="e.g. WG7, UB/022"></label>
        <label class="field">Status<select id="b_status">${STATUSES.map(s=>`<option ${(r.status||"Placed")===s?"selected":""}>${s}</option>`).join("")}</select></label>
      </div>
      <div class="form-grid cols-2">
        <label class="field">Quantity placed<input type="number" min="0" step="1" id="b_placed" value="${r.placed}" placeholder="0"></label>
        <label class="field">Quantity expired<input type="number" min="0" step="1" id="b_expired" value="${r.expired||0}"></label>
      </div>
      <label class="field">Expiry date <span class="muted" style="font-weight:400">(optional)</span><input type="date" id="b_expiry" value="${r.expiry||""}"></label>
      <label class="field">Notes<textarea id="b_notes" rows="2">${escapeHtml(r.notes||"")}</textarea></label>
      <div class="card card-pad" style="background:var(--card-2);display:flex;justify-content:space-between">
        <span class="muted" style="font-size:13px">Sold = placed − expired</span>
        <strong id="b_sold" style="color:var(--brand-700)">0</strong>
      </div>
    </div>`;
  m.foot.innerHTML = `<button class="btn btn-ghost" data-x="cancel">Cancel</button>
                      <button class="btn btn-primary" data-x="save">${icon("check")} ${isEdit?"Save":"Log batch"}</button>`;
  const sold = ()=>{ m.body.querySelector("#b_sold").textContent = fmtNum(Math.max(0,(Number(m.body.querySelector("#b_placed").value)||0)-(Number(m.body.querySelector("#b_expired").value)||0))); };
  ["#b_placed","#b_expired"].forEach(s=>m.body.querySelector(s).addEventListener("input", sold)); sold();
  m.foot.querySelector('[data-x="cancel"]').onclick = m.close;
  m.foot.querySelector('[data-x="save"]').onclick = ()=>{
    const shopId = m.body.querySelector("#b_shop").value;
    const data = {
      date:m.body.querySelector("#b_date").value, shopId, shopName:store.shopName(shopId),
      label:m.body.querySelector("#b_label").value.trim(),
      placed:Number(m.body.querySelector("#b_placed").value)||0,
      expired:Number(m.body.querySelector("#b_expired").value)||0,
      expiry:m.body.querySelector("#b_expiry").value||null,
      status:m.body.querySelector("#b_status").value, notes:m.body.querySelector("#b_notes").value.trim(),
    };
    if(!data.placed){ toast("Enter quantity placed","bad"); return; }
    if(isEdit) store.update("batches", existing.id, data); else store.add("batches", data);
    toast(isEdit?"Batch updated":"Batch logged","good");
    m.close(); render(document.getElementById("content"));
  };
}

function exportCSV(){
  const rows = filtered().map(r=>[fmtDate(r.date), r.label, store.shopName(r.shopId), r.placed, r.expired, (r.placed-r.expired), r.expiry?fmtDate(r.expiry):"", r.status, r.notes]);
  download(`meltiva-batches-${todayISO()}.csv`, toCSV(["Date","Batch","Shop","Placed","Expired","Sold","Expiry","Status","Notes"], rows));
  toast("Exported CSV","good");
}

function render(content, opts={}){
  const actions = opts.actions || el("div"); actions.innerHTML="";
  actions.append(
    el("button.btn.btn-ghost.btn-sm", { onclick:exportCSV, html:`${icon("download")} Export` }),
    el("button.btn.btn-primary", { onclick:()=>openForm(null), html:`${icon("add")} Log batch` }),
  );

  const rows = filtered();
  const placed = sum(rows, r=>r.placed), expired = sum(rows, r=>r.expired);
  const soldQty = placed - expired;
  const expRate = placed>0 ? (expired/placed*100) : 0;
  const shops = store.shops().filter(s=>!s.isChannel);

  const wrap = el("div");
  wrap.innerHTML = `
    <div class="chips" style="margin-bottom:16px">
      <span class="chip ${state.shop===""?"active":""}" data-shop="">${icon("apps")} All shops</span>
      ${shops.map(s=>`<span class="chip ${state.shop===s.id?"active":""}" data-shop="${s.id}">${escapeHtml(s.name)}</span>`).join("")}
    </div>
    <div class="grid grid-kpi section">
      <div class="kpi"><div class="ico">${icon("inventory_2")}</div><div class="label">Batches logged</div><div class="value">${fmtNum(rows.length)}</div></div>
      <div class="kpi good"><div class="ico">${icon("done_all")}</div><div class="label">Total placed</div><div class="value">${fmtNum(placed)}</div></div>
      <div class="kpi bad"><div class="ico">${icon("delete_sweep")}</div><div class="label">Total expired</div><div class="value">${fmtNum(expired)}</div></div>
      <div class="kpi warn"><div class="ico">${icon("percent")}</div><div class="label">Expiry rate</div><div class="value">${expRate.toFixed(1)}<small>%</small></div></div>
    </div>`;

  if(rows.length===0){
    wrap.append(el("div.card.empty", { html:`${icon("inventory_2")}<h3>No batches logged${state.shop?" for this shop":""}</h3><p>Log how many you placed and how many expired — billed together later.</p>` }));
  } else {
    const tbl = el("div.table-wrap");
    tbl.innerHTML = `
      <table class="data"><thead><tr>
        <th>Date</th><th>Batch</th><th>Shop</th><th class="num">Placed</th><th class="num">Expired</th><th class="num">Sold</th><th>Expiry</th><th>Status</th><th></th>
      </tr></thead><tbody>
        ${rows.map(r=>`<tr>
          <td>${fmtDate(r.date)}</td>
          <td>${escapeHtml(r.label||"—")}</td>
          <td>${escapeHtml(store.shopName(r.shopId))}</td>
          <td class="num">${fmtNum(r.placed)}</td>
          <td class="num">${r.expired?`<span class="amt-neg">${fmtNum(r.expired)}</span>`:"0"}</td>
          <td class="num">${fmtNum(r.placed-r.expired)}</td>
          <td>${r.expiry?fmtDate(r.expiry):"—"}</td>
          <td><span class="pill ${r.status==="Billed"?"green":r.status==="Expired"?"red":"amber"} dot">${r.status||"Placed"}</span></td>
          <td><div class="actions">
            <button class="btn-icon" data-edit="${r.id}">${icon("edit")}</button>
            <button class="btn-icon danger" data-del="${r.id}">${icon("delete")}</button>
          </div></td></tr>`).join("")}
      </tbody>
      <tfoot class="tfoot"><tr><td colspan="3">Total (${rows.length})</td><td class="num">${fmtNum(placed)}</td><td class="num">${fmtNum(expired)}</td><td class="num">${fmtNum(soldQty)}</td><td colspan="3"></td></tr></tfoot>
      </table>`;
    wrap.append(tbl);
    tbl.querySelectorAll("[data-edit]").forEach(b=> b.onclick=()=>openForm(store.get("batches", b.dataset.edit)));
    tbl.querySelectorAll("[data-del]").forEach(b=> b.onclick=async ()=>{
      const r=store.get("batches", b.dataset.del);
      if(await confirmDialog({ title:"Delete batch?", body:`${r.label||""} · ${store.shopName(r.shopId)}` })){ store.remove("batches", r.id); toast("Deleted"); render(content); }
    });
  }
  content.append(wrap);
  wrap.querySelectorAll("[data-shop]").forEach(c=> c.onclick=()=>{ state.shop=c.dataset.shop; render(content, {actions}); });
}

export default { title:"Batch Log", sub:"Batches placed & expired per shop", render };
