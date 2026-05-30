// ── Income tab ──────────────────────────────────────────────────────────────
import { store } from "../store.js";
import { el, icon, fmtMVR, fmtNum, fmtDate, todayISO, toast, openModal, confirmDialog,
         toCSV, download, sum, escapeHtml, monthKey, monthLabel } from "../utils.js";
import { shopForm } from "./shop-form.js";

const state = { q:"", shop:"", status:"", month:"" };
const STATUSES = ["Paid","Unpaid","Pending"];

function filtered(){
  let rows = store.list("incomes").slice();
  if(state.shop)   rows = rows.filter(r => (r.shopId||r.shop) === state.shop);
  if(state.status) rows = rows.filter(r => (r.status||"Paid") === state.status);
  if(state.month)  rows = rows.filter(r => monthKey(r.date) === state.month);
  if(state.q){
    const q = state.q.toLowerCase();
    rows = rows.filter(r => [r.product, r.batchNo, store.shopName(r.shopId)].join(" ").toLowerCase().includes(q));
  }
  return rows.sort((a,b)=> (b.date||"").localeCompare(a.date||""));
}

function statusPill(s){
  s = s || "Paid";
  const cls = s==="Paid" ? "green" : s==="Unpaid" ? "red" : "amber";
  return `<span class="pill ${cls} dot">${s}</span>`;
}

function shopOptions(selectedId){
  return store.shops().map(s => `<option value="${s.id}" ${s.id===selectedId?"selected":""}>${escapeHtml(s.name)}</option>`).join("")
    + `<option value="__new__">+ Add new shop…</option>`;
}

function openForm(existing){
  const isEdit = !!existing;
  const products = store.list("products");
  const m = openModal({ title:isEdit?"Edit income":"Add income", icon:isEdit?"edit":"point_of_sale" });
  const r = existing || { date:todayISO(), batchNo:"", product:"Fudgie Brownies", shopId:store.shops()[0]?.id||"",
                          quantity:"", remaining:0, rate:"", expiry:"", status:"Paid" };
  m.body.innerHTML = `
    <datalist id="dlProd">${products.map(c=>`<option value="${escapeHtml(c)}">`).join("")}</datalist>
    <div class="form-grid">
      <div class="form-grid cols-2">
        <label class="field">Date placed<input type="date" id="f_date" value="${r.date||todayISO()}"></label>
        <label class="field">Shop / channel
          <select id="f_shop">${shopOptions(r.shopId)}</select></label>
      </div>
      <div class="form-grid cols-2">
        <label class="field">Product / Type<input list="dlProd" id="f_prod" value="${escapeHtml(r.product||"")}"></label>
        <label class="field">Batch no. <span class="muted" style="font-weight:400">(optional)</span><input type="text" id="f_batch" value="${escapeHtml(r.batchNo||"")}" placeholder="e.g. WG/008"></label>
      </div>
      <div class="form-grid cols-2">
        <label class="field">Quantity placed<input type="number" min="0" step="1" id="f_qty" value="${r.quantity}" placeholder="0"></label>
        <label class="field">Remaining / expired<input type="number" min="0" step="1" id="f_rem" value="${r.remaining||0}"></label>
      </div>
      <div class="form-grid cols-2">
        <label class="field">Rate (MVR / unit)<input type="number" min="0" step="0.01" id="f_rate" value="${r.rate}" placeholder="0.00"></label>
        <label class="field">Status<select id="f_status">${STATUSES.map(s=>`<option ${(r.status||"Paid")===s?"selected":""}>${s}</option>`).join("")}</select></label>
      </div>
      <label class="field">Expiry date <span class="muted" style="font-weight:400">(optional)</span><input type="date" id="f_exp" value="${r.expiry||""}"></label>
      <div class="card card-pad" style="background:var(--card-2);display:flex;justify-content:space-between;align-items:center">
        <span class="muted" style="font-size:13px">Sold = qty − remaining &nbsp;·&nbsp; Amount = sold × rate</span>
        <strong id="f_calc" style="font-family:var(--brandfont);font-size:18px;color:var(--brand-700)">MVR 0.00</strong>
      </div>
    </div>`;
  m.foot.innerHTML = `<button class="btn btn-ghost" data-x="cancel">Cancel</button>
                      <button class="btn btn-primary" data-x="save">${icon("check")} ${isEdit?"Save changes":"Add income"}</button>`;

  const calc = ()=>{
    const q = Number(m.body.querySelector("#f_qty").value)||0;
    const rem = Number(m.body.querySelector("#f_rem").value)||0;
    const rate = Number(m.body.querySelector("#f_rate").value)||0;
    m.body.querySelector("#f_calc").textContent = fmtMVR(Math.max(0,(q-rem))*rate);
  };
  ["#f_qty","#f_rem","#f_rate"].forEach(s => m.body.querySelector(s).addEventListener("input", calc));
  calc();

  // shop select — handle "add new"
  const shopSel = m.body.querySelector("#f_shop");
  shopSel.addEventListener("change", () => {
    if(shopSel.value === "__new__"){
      shopForm(null, (newShop) => {
        shopSel.innerHTML = shopOptions(newShop.id);
      }, () => { shopSel.value = store.shops()[0]?.id || ""; });
    }
  });
  // pre-fill rate from shop default when adding
  if(!isEdit){
    shopSel.addEventListener("change", () => {
      const s = store.shop(shopSel.value);
      if(s && s.defaultRate && !m.body.querySelector("#f_rate").value){ m.body.querySelector("#f_rate").value = s.defaultRate; calc(); }
    });
  }

  m.foot.querySelector('[data-x="cancel"]').onclick = m.close;
  m.foot.querySelector('[data-x="save"]').onclick = () => {
    const shopId = shopSel.value === "__new__" ? (store.shops()[0]?.id||"") : shopSel.value;
    const data = {
      date: m.body.querySelector("#f_date").value,
      batchNo: m.body.querySelector("#f_batch").value.trim(),
      product: m.body.querySelector("#f_prod").value.trim(),
      shopId, shop: store.shopName(shopId),
      quantity: Number(m.body.querySelector("#f_qty").value)||0,
      remaining: Number(m.body.querySelector("#f_rem").value)||0,
      rate: Number(m.body.querySelector("#f_rate").value)||0,
      expiry: m.body.querySelector("#f_exp").value || null,
      status: m.body.querySelector("#f_status").value,
    };
    data.amount = (data.quantity - data.remaining) * data.rate;
    if(!data.quantity){ toast("Enter a quantity","bad"); return; }
    if(data.product) store.addToList("products", data.product);
    if(isEdit) store.update("incomes", existing.id, data);
    else store.add("incomes", data);
    toast(isEdit?"Income updated":"Income added","good");
    m.close(); render(document.getElementById("content"));
  };
}

function exportCSV(){
  const rows = filtered().map(r => [fmtDate(r.date), r.batchNo, r.product, store.shopName(r.shopId),
    r.quantity, r.remaining, (r.quantity-r.remaining), r.rate, store.incomeAmount(r), r.status||"Paid"]);
  download(`meltiva-income-${todayISO()}.csv`,
    toCSV(["Date","Batch","Product","Shop","Qty","Remaining","Sold","Rate","Amount (MVR)","Status"], rows));
  toast("Exported CSV","good");
}

function render(content, opts={}){
  const actions = opts.actions || el("div");
  actions.innerHTML = "";
  actions.append(
    el("button.btn.btn-ghost.btn-sm", { onclick:exportCSV, html:`${icon("download")} Export` }),
    el("button.btn.btn-primary", { onclick:()=>openForm(null), html:`${icon("add")} Add income` }),
  );

  const rows = filtered();
  const total = store.totalIncome(rows);
  const soldQty = store.qtySold(rows);
  const months = [...new Set(store.list("incomes").map(r=>monthKey(r.date)))].filter(k=>k!=="unknown").sort().reverse();

  const wrap = el("div");
  wrap.innerHTML = `
    <div class="toolbar">
      <div class="input-icon grow">${icon("search")}<input type="text" id="q" placeholder="Search product, batch, shop…" value="${escapeHtml(state.q)}"></div>
      <select id="fShop"><option value="">All shops</option>${store.shops().map(s=>`<option value="${s.id}" ${state.shop===s.id?"selected":""}>${escapeHtml(s.name)}</option>`).join("")}</select>
      <select id="fStatus"><option value="">All statuses</option>${STATUSES.map(s=>`<option ${state.status===s?"selected":""}>${s}</option>`).join("")}</select>
      <select id="fMonth"><option value="">All months</option>${months.map(k=>`<option value="${k}" ${state.month===k?"selected":""}>${monthLabel(k)}</option>`).join("")}</select>
    </div>
    <div class="between" style="margin-bottom:12px">
      <span class="muted" style="font-size:13px">${rows.length} entries · ${fmtNum(soldQty)} sold</span>
      <span class="pill green">Income: ${fmtMVR(total)}</span>
    </div>`;

  if(rows.length === 0){
    wrap.append(el("div.card.empty", { html:`${icon("payments")}<h3>No income found</h3><p>Try clearing filters, or record your first sale.</p>` }));
  } else {
    const tbl = el("div.table-wrap");
    tbl.innerHTML = `
      <table class="data">
        <thead><tr>
          <th>Date</th><th>Batch</th><th>Product</th><th>Shop</th>
          <th class="num">Qty</th><th class="num">Rem.</th><th class="num">Rate</th><th class="num">Amount</th><th>Status</th><th></th>
        </tr></thead>
        <tbody>
          ${rows.map(r=>`
            <tr data-id="${r.id}">
              <td>${fmtDate(r.date)}</td>
              <td>${escapeHtml(r.batchNo||"—")}</td>
              <td>${escapeHtml(r.product||"—")}</td>
              <td>${escapeHtml(store.shopName(r.shopId))}</td>
              <td class="num">${fmtNum(r.quantity)}</td>
              <td class="num">${r.remaining?`<span class="amt-neg">${fmtNum(r.remaining)}</span>`:"0"}</td>
              <td class="num">${fmtMVR(r.rate,false)}</td>
              <td class="num">${fmtMVR(store.incomeAmount(r))}</td>
              <td>${statusPill(r.status)}</td>
              <td><div class="actions">
                <button class="btn-icon" data-edit="${r.id}" title="Edit">${icon("edit")}</button>
                <button class="btn-icon danger" data-del="${r.id}" title="Delete">${icon("delete")}</button>
              </div></td>
            </tr>`).join("")}
        </tbody>
        <tfoot class="tfoot"><tr><td colspan="7">Total income (${rows.length})</td><td class="num">${fmtMVR(total)}</td><td colspan="2"></td></tr></tfoot>
      </table>`;
    wrap.append(tbl);
    tbl.querySelectorAll("[data-edit]").forEach(b => b.onclick = ()=>openForm(store.get("incomes", b.dataset.edit)));
    tbl.querySelectorAll("[data-del]").forEach(b => b.onclick = async ()=>{
      const r = store.get("incomes", b.dataset.del);
      if(await confirmDialog({ title:"Delete income entry?", body:`${r.product||""} — ${fmtMVR(store.incomeAmount(r))}` })){
        store.remove("incomes", r.id); toast("Deleted"); render(content);
      }
    });
  }

  content.append(wrap);
  const reb = ()=>render(content, { actions });
  wrap.querySelector("#q").addEventListener("input", debounce(()=>{ state.q = wrap.querySelector("#q").value; reb(); }, 220));
  wrap.querySelector("#fShop").onchange = e => { state.shop = e.target.value; reb(); };
  wrap.querySelector("#fStatus").onchange = e => { state.status = e.target.value; reb(); };
  wrap.querySelector("#fMonth").onchange = e => { state.month = e.target.value; reb(); };
}
function debounce(fn, ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }

export default { title:"Income", sub:"Record sales & deliveries", render };
