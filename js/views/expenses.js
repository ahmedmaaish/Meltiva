// ── Expenses tab ────────────────────────────────────────────────────────────
import { store } from "../store.js";
import { el, icon, fmtMVR, fmtDate, todayISO, toast, openModal, confirmDialog,
         toCSV, download, sum, escapeHtml, monthKey, monthLabel } from "../utils.js";

const state = { q:"", category:"", supplier:"", month:"" };

function filtered(){
  let rows = store.list("expenses").slice();
  if(state.category) rows = rows.filter(r => r.category === state.category);
  if(state.supplier) rows = rows.filter(r => r.supplier === state.supplier);
  if(state.month)    rows = rows.filter(r => monthKey(r.date) === state.month);
  if(state.q){
    const q = state.q.toLowerCase();
    rows = rows.filter(r => [r.description, r.supplier, r.category].join(" ").toLowerCase().includes(q));
  }
  return rows.sort((a,b)=> (b.date||"").localeCompare(a.date||""));
}

function openForm(existing){
  const isEdit = !!existing;
  const cats = store.list("categories");
  const sups = store.list("suppliers");
  const m = openModal({ title: isEdit ? "Edit expense" : "Add expense", icon: isEdit?"edit":"add_card" });
  const r = existing || { date:todayISO(), category:"Ingredients", description:"", supplier:"", quantity:"", amount:"" };
  m.body.innerHTML = `
    <datalist id="dlCats">${cats.map(c=>`<option value="${escapeHtml(c)}">`).join("")}</datalist>
    <datalist id="dlSups">${sups.map(c=>`<option value="${escapeHtml(c)}">`).join("")}</datalist>
    <div class="form-grid">
      <div class="form-grid cols-2">
        <label class="field">Date<input type="date" id="f_date" value="${r.date||todayISO()}"></label>
        <label class="field">Amount (MVR)<input type="number" step="0.01" min="0" id="f_amount" value="${r.amount}" placeholder="0.00"></label>
      </div>
      <div class="form-grid cols-2">
        <label class="field">Category<input list="dlCats" id="f_cat" value="${escapeHtml(r.category||"")}" placeholder="e.g. Ingredients"></label>
        <label class="field">Supplier / Shop<input list="dlSups" id="f_sup" value="${escapeHtml(r.supplier||"")}" placeholder="where you bought it"></label>
      </div>
      <label class="field">Description<input type="text" id="f_desc" value="${escapeHtml(r.description||"")}" placeholder="what was it for"></label>
      <label class="field">Quantity <span class="muted" style="font-weight:400">(optional, e.g. “2kg”, “60”)</span>
        <input type="text" id="f_qty" value="${escapeHtml(r.quantity||"")}"></label>
    </div>`;
  m.foot.innerHTML = `<button class="btn btn-ghost" data-x="cancel">Cancel</button>
                      <button class="btn btn-primary" data-x="save">${icon("check")} ${isEdit?"Save changes":"Add expense"}</button>`;
  m.foot.querySelector('[data-x="cancel"]').onclick = m.close;
  m.foot.querySelector('[data-x="save"]').onclick = () => {
    const data = {
      date: m.body.querySelector("#f_date").value,
      category: m.body.querySelector("#f_cat").value.trim() || "Other",
      description: m.body.querySelector("#f_desc").value.trim(),
      supplier: m.body.querySelector("#f_sup").value.trim(),
      quantity: m.body.querySelector("#f_qty").value.trim(),
      amount: Number(m.body.querySelector("#f_amount").value) || 0,
    };
    if(!data.amount){ toast("Enter an amount","bad"); return; }
    store.addToList("categories", data.category);
    if(data.supplier) store.addToList("suppliers", data.supplier);
    if(isEdit) store.update("expenses", existing.id, data);
    else store.add("expenses", data);
    toast(isEdit?"Expense updated":"Expense added","good");
    m.close(); render(document.getElementById("content"));
  };
}

function exportCSV(){
  const rows = filtered().map(r => [fmtDate(r.date), r.category, r.description, r.supplier, r.quantity, r.amount]);
  download(`meltiva-expenses-${todayISO()}.csv`, toCSV(["Date","Category","Description","Supplier","Quantity","Amount (MVR)"], rows));
  toast("Exported CSV","good");
}

function render(content, opts={}){
  const actions = opts.actions || el("div");
  actions.innerHTML = "";
  actions.append(
    el("button.btn.btn-ghost.btn-sm", { onclick:exportCSV, html:`${icon("download")} Export` }),
    el("button.btn.btn-primary", { onclick:()=>openForm(null), html:`${icon("add")} Add expense` }),
  );

  const rows = filtered();
  const total = sum(rows, r=>r.amount);
  const cats = store.list("categories");
  const sups = store.list("suppliers");
  const months = [...new Set(store.list("expenses").map(r=>monthKey(r.date)))].filter(k=>k!=="unknown").sort().reverse();

  const wrap = el("div");
  wrap.innerHTML = `
    <div class="toolbar">
      <div class="input-icon grow">${icon("search")}<input type="text" id="q" placeholder="Search description, supplier…" value="${escapeHtml(state.q)}"></div>
      <select id="fCat"><option value="">All categories</option>${cats.map(c=>`<option ${state.category===c?"selected":""}>${escapeHtml(c)}</option>`).join("")}</select>
      <select id="fSup"><option value="">All suppliers</option>${sups.map(c=>`<option ${state.supplier===c?"selected":""}>${escapeHtml(c)}</option>`).join("")}</select>
      <select id="fMonth"><option value="">All months</option>${months.map(k=>`<option value="${k}" ${state.month===k?"selected":""}>${monthLabel(k)}</option>`).join("")}</select>
    </div>
    <div class="between" style="margin-bottom:12px">
      <span class="muted" style="font-size:13px">${rows.length} ${rows.length===1?"expense":"expenses"}</span>
      <span class="pill">Total: ${fmtMVR(total)}</span>
    </div>`;

  if(rows.length === 0){
    wrap.append(el("div.card.empty", { html:`${icon("receipt_long")}<h3>No expenses found</h3><p>Try clearing filters, or add your first expense.</p>` }));
  } else {
    const tbl = el("div.table-wrap");
    tbl.innerHTML = `
      <table class="data">
        <thead><tr>
          <th>Date</th><th>Category</th><th>Description</th><th>Supplier</th>
          <th class="num">Qty</th><th class="num">Amount</th><th></th>
        </tr></thead>
        <tbody>
          ${rows.map(r=>`
            <tr data-id="${r.id}">
              <td>${fmtDate(r.date)}</td>
              <td><span class="pill gray">${escapeHtml(r.category||"—")}</span></td>
              <td>${escapeHtml(r.description||"—")}</td>
              <td>${escapeHtml(r.supplier||"—")}</td>
              <td class="num">${escapeHtml(r.quantity||"")}</td>
              <td class="num">${fmtMVR(r.amount)}</td>
              <td><div class="actions">
                <button class="btn-icon" data-edit="${r.id}" title="Edit">${icon("edit")}</button>
                <button class="btn-icon danger" data-del="${r.id}" title="Delete">${icon("delete")}</button>
              </div></td>
            </tr>`).join("")}
        </tbody>
        <tfoot class="tfoot"><tr><td colspan="5">Total (${rows.length})</td><td class="num">${fmtMVR(total)}</td><td></td></tr></tfoot>
      </table>`;
    wrap.append(tbl);
    tbl.querySelectorAll("[data-edit]").forEach(b => b.onclick = ()=>openForm(store.get("expenses", b.dataset.edit)));
    tbl.querySelectorAll("[data-del]").forEach(b => b.onclick = async ()=>{
      const r = store.get("expenses", b.dataset.del);
      if(await confirmDialog({ title:"Delete expense?", body:`${r.description||r.category} — ${fmtMVR(r.amount)}` })){
        store.remove("expenses", r.id); toast("Deleted"); render(content);
      }
    });
  }

  content.append(wrap);
  // filter handlers
  const reb = ()=>render(content, { actions });
  wrap.querySelector("#q").oninput = e => { state.q = e.target.value; };
  wrap.querySelector("#q").onsearch = reb;
  wrap.querySelector("#q").addEventListener("keyup", e=>{ if(e.key==="Enter") reb(); });
  wrap.querySelector("#q").addEventListener("input", debounce(reb, 220));
  wrap.querySelector("#fCat").onchange = e => { state.category = e.target.value; reb(); };
  wrap.querySelector("#fSup").onchange = e => { state.supplier = e.target.value; reb(); };
  wrap.querySelector("#fMonth").onchange = e => { state.month = e.target.value; reb(); };
}

function debounce(fn, ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }

export default { title:"Expenses", sub:"Track what you spend", render };
