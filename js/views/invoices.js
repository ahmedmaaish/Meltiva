// ── Invoices tab — build, preview & download PDF ────────────────────────────
import { store } from "../store.js";
import { el, icon, fmtMVR, fmtDate, todayISO, toast, openModal, confirmDialog, escapeHtml } from "../utils.js";
import { buildInvoiceNode, computeInvoice, exportInvoicePDF } from "../invoice-pdf.js";

function newItemRow(it={description:"",qty:"",rate:""}){
  return `<tr class="li">
    <td><input class="li-desc" value="${escapeHtml(it.description||"")}" placeholder="Fudgie Brownies"></td>
    <td style="width:90px"><input class="li-qty" type="number" min="0" step="1" value="${it.qty}" placeholder="0"></td>
    <td style="width:110px"><input class="li-rate" type="number" min="0" step="0.01" value="${it.rate}" placeholder="0.00"></td>
    <td style="width:120px;text-align:right" class="li-total num">0.00</td>
    <td style="width:34px"><button class="btn-icon danger li-del" title="Remove">${icon("close")}</button></td>
  </tr>`;
}

function openInvoiceForm(existing){
  const isEdit = !!existing;
  const shops = store.shops().filter(s=>!s.isChannel);
  const firstShop = existing ? store.shop(existing.shopId) : shops[0];
  const m = openModal({ title:isEdit?`Edit invoice ${existing.number}`:"New invoice", icon:"description", wide:true });
  const autoNumber = firstShop ? store.nextInvoiceNumber(firstShop) : "";

  const inv = existing || {
    shopId:firstShop?.id||"", number:autoNumber, datePlacedFrom:"", datePlacedTo:"",
    dateIssued:todayISO(), items:[{description:"Fudgie Brownies",qty:"",rate:firstShop?.defaultRate||""}],
    commissionMode:firstShop?.invoiceCommissionMode||"net",
  };

  m.body.innerHTML = `
    <div class="form-grid">
      <div class="form-grid cols-2">
        <label class="field">Shop
          <select id="i_shop">${shops.map(s=>`<option value="${s.id}" ${s.id===inv.shopId?"selected":""}>${escapeHtml(s.name)}</option>`).join("")}</select></label>
        <label class="field">Invoice No.<input id="i_number" value="${escapeHtml(inv.number)}"></label>
      </div>
      <div class="form-grid cols-2">
        <label class="field">Date placed — from<input type="date" id="i_from" value="${inv.datePlacedFrom||""}"></label>
        <label class="field">Date placed — to<input type="date" id="i_to" value="${inv.datePlacedTo||""}"></label>
      </div>
      <div class="form-grid cols-2">
        <label class="field">Date issued<input type="date" id="i_issued" value="${inv.dateIssued||todayISO()}"></label>
        <label class="field">Commission on invoice
          <select id="i_mode">
            <option value="net" ${inv.commissionMode==="net"?"selected":""}>Show “—” (rate is net)</option>
            <option value="deduct" ${inv.commissionMode==="deduct"?"selected":""}>Deduct commission line</option>
          </select></label>
      </div>

      <div class="between"><div class="field" style="margin:0">Line items</div>
        <button class="btn btn-ghost btn-sm" id="i_pull">${icon("download_for_offline")} Add from this shop's sales</button></div>
      <div class="table-wrap">
        <table class="data" style="min-width:auto"><thead><tr>
          <th>Description</th><th>QTY</th><th>Rate</th><th class="num">Total</th><th></th>
        </tr></thead><tbody id="i_items">${(inv.items||[]).map(newItemRow).join("")}</tbody></table>
      </div>
      <button class="btn btn-ghost btn-sm" id="i_add" style="justify-self:start">${icon("add")} Add line</button>

      <div class="card card-pad" style="background:var(--card-2)">
        <div class="between" style="padding:3px 0"><span class="muted">Subtotal</span><strong id="i_sub">MVR 0.00</strong></div>
        <div class="between" style="padding:3px 0"><span class="muted">Commission</span><strong id="i_comm">–</strong></div>
        <hr class="divider" style="margin:8px 0">
        <div class="between" style="padding:3px 0"><span style="font-weight:700">TOTAL</span><strong id="i_tot" style="font-family:var(--brandfont);font-size:19px;color:var(--brand-700)">MVR 0.00</strong></div>
      </div>
    </div>`;
  m.foot.innerHTML = `<button class="btn btn-ghost" data-x="cancel">Cancel</button>
    <button class="btn btn-soft" data-x="preview">${icon("visibility")} Preview</button>
    <button class="btn btn-primary" data-x="save">${icon("download")} Save & download PDF</button>`;

  const $ = s => m.body.querySelector(s);
  const itemsBody = $("#i_items");

  function gather(){
    const items = [...itemsBody.querySelectorAll("tr.li")].map(tr=>({
      description: tr.querySelector(".li-desc").value.trim(),
      qty: Number(tr.querySelector(".li-qty").value)||0,
      rate: Number(tr.querySelector(".li-rate").value)||0,
    })).filter(it=>it.description || it.qty || it.rate);
    return {
      id: existing?.id, shopId:$("#i_shop").value, shopName:store.shopName($("#i_shop").value),
      number:$("#i_number").value.trim(), datePlacedFrom:$("#i_from").value, datePlacedTo:$("#i_to").value,
      dateIssued:$("#i_issued").value, commissionMode:$("#i_mode").value, items,
    };
  }
  function recalc(){
    itemsBody.querySelectorAll("tr.li").forEach(tr=>{
      const t=(Number(tr.querySelector(".li-qty").value)||0)*(Number(tr.querySelector(".li-rate").value)||0);
      tr.querySelector(".li-total").textContent = t.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
    });
    const data = gather(); const shop = store.shop(data.shopId);
    const c = computeInvoice(data, shop);
    $("#i_sub").textContent = fmtMVR(c.subtotal);
    $("#i_comm").textContent = c.commissionLabel==="–" ? "–" : c.commissionLabel;
    $("#i_tot").textContent = fmtMVR(c.total);
  }
  function bind(){
    itemsBody.querySelectorAll("input").forEach(i=> i.oninput = recalc);
    itemsBody.querySelectorAll(".li-del").forEach(b=> b.onclick = ()=>{ b.closest("tr").remove(); recalc(); });
  }
  bind(); recalc();

  $("#i_add").onclick = ()=>{ itemsBody.insertAdjacentHTML("beforeend", newItemRow()); bind(); recalc(); };
  $("#i_shop").onchange = ()=>{
    const s = store.shop($("#i_shop").value);
    if(s){ if(!isEdit) $("#i_number").value = store.nextInvoiceNumber(s); $("#i_mode").value = s.invoiceCommissionMode||"net"; }
    recalc();
  };
  ["#i_from","#i_to","#i_issued","#i_mode","#i_number"].forEach(s=> $(s).oninput = recalc);

  // pull sales: group this shop's income rows by product within range (or all)
  $("#i_pull").onclick = ()=>{
    const sid = $("#i_shop").value, from=$("#i_from").value, to=$("#i_to").value;
    let rows = store.list("incomes").filter(r=>(r.shopId||r.shop)===sid);
    if(from) rows = rows.filter(r=> (r.date||"") >= from);
    if(to)   rows = rows.filter(r=> (r.date||"") <= to);
    if(rows.length===0){ toast("No sales found for this shop / range","bad"); return; }
    const byProd = new Map();
    rows.forEach(r=>{ const sold=(r.quantity-r.remaining); const k=r.product||"Fudgie Brownies";
      const o=byProd.get(k)||{description:k,qty:0,rate:r.rate}; o.qty+=sold; o.rate=r.rate; byProd.set(k,o); });
    // replace blank starter rows
    if([...itemsBody.querySelectorAll("tr.li")].every(tr=>!tr.querySelector(".li-desc").value && !tr.querySelector(".li-qty").value)) itemsBody.innerHTML="";
    [...byProd.values()].forEach(it=> itemsBody.insertAdjacentHTML("beforeend", newItemRow(it)));
    bind(); recalc(); toast(`Added ${byProd.size} line(s)`,"good");
  };

  function persist(data){
    const c = computeInvoice(data, store.shop(data.shopId));
    const rec = { ...data, subtotal:c.subtotal, commission:c.commission, total:c.total, createdAt: existing?.createdAt || new Date().toISOString() };
    if(isEdit){ store.update("invoices", existing.id, rec); return store.get("invoices", existing.id); }
    const saved = store.add("invoices", rec);
    // bump shop counter if number matched the auto value
    const shop = store.shop(data.shopId);
    if(shop && data.number === store.nextInvoiceNumber(shop)) store.bumpInvoiceCounter(shop.id);
    return saved;
  }

  m.foot.querySelector('[data-x="cancel"]').onclick = m.close;
  m.foot.querySelector('[data-x="preview"]').onclick = ()=> previewInvoice(gather());
  m.foot.querySelector('[data-x="save"]').onclick = async ()=>{
    const data = gather();
    if(!data.number){ toast("Enter an invoice number","bad"); return; }
    if(data.items.length===0){ toast("Add at least one line item","bad"); return; }
    const saved = persist(data);
    toast("Invoice saved","good");
    m.close(); render(document.getElementById("content"));
    try{ await exportInvoicePDF(saved); }catch(e){ console.error(e); toast("PDF export failed","bad"); }
  };
}

function previewInvoice(inv){
  const m = openModal({ title:`Preview · ${inv.number||""}`, icon:"visibility", wide:true });
  const SCALE = 0.62;
  const node = buildInvoiceNode(inv);
  node.style.transformOrigin = "top left";
  node.style.transform = `scale(${SCALE})`;
  const inner = el("div", { style:`width:${Math.round(794*SCALE)}px;height:${Math.round(1123*SCALE)}px;flex:none` });
  inner.append(node);
  const holder = el("div", { style:"max-height:70dvh;overflow:auto;background:#ddd2c2;border-radius:12px;display:flex;justify-content:center;padding:16px" });
  holder.append(inner); m.body.append(holder);
  m.foot.innerHTML = `<button class="btn btn-ghost" data-x="c">Close</button><button class="btn btn-primary" data-x="dl">${icon("download")} Download PDF</button>`;
  m.foot.querySelector('[data-x="c"]').onclick = m.close;
  m.foot.querySelector('[data-x="dl"]').onclick = ()=> exportInvoicePDF(inv);
}

function render(content, opts={}){
  const actions = opts.actions || el("div"); actions.innerHTML="";
  actions.append(el("button.btn.btn-primary", { onclick:()=>openInvoiceForm(null), html:`${icon("add")} New invoice` }));

  const list = store.list("invoices").slice().sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));
  const wrap = el("div");
  if(list.length===0){
    wrap.append(el("div.card.empty", { html:`${icon("description")}<h3>No invoices yet</h3><p>Create your first invoice — it downloads as a PDF named after the invoice number.</p>
      <div style="margin-top:14px"><button class="btn btn-primary" id="first">${icon("add")} New invoice</button></div>` }));
    content.append(wrap);
    wrap.querySelector("#first").onclick = ()=>openInvoiceForm(null);
    return;
  }
  const tbl = el("div.table-wrap");
  tbl.innerHTML = `
    <table class="data"><thead><tr>
      <th>Invoice No.</th><th>Shop</th><th>Issued</th><th>Placed</th><th class="num">Total</th><th></th>
    </tr></thead><tbody>
      ${list.map(v=>`<tr>
        <td><strong>${escapeHtml(v.number)}</strong></td>
        <td>${escapeHtml(v.shopName||store.shopName(v.shopId))}</td>
        <td>${fmtDate(v.dateIssued)}</td>
        <td>${v.datePlacedFrom?fmtDate(v.datePlacedFrom):"—"}${v.datePlacedTo?" – "+fmtDate(v.datePlacedTo):""}</td>
        <td class="num">${fmtMVR(v.total)}</td>
        <td><div class="actions">
          <button class="btn-icon" data-dl="${v.id}" title="Download PDF">${icon("download")}</button>
          <button class="btn-icon" data-edit="${v.id}" title="Edit">${icon("edit")}</button>
          <button class="btn-icon danger" data-del="${v.id}" title="Delete">${icon("delete")}</button>
        </div></td></tr>`).join("")}
    </tbody></table>`;
  wrap.append(tbl); content.append(wrap);
  tbl.querySelectorAll("[data-dl]").forEach(b=> b.onclick=()=> exportInvoicePDF(store.get("invoices", b.dataset.dl)));
  tbl.querySelectorAll("[data-edit]").forEach(b=> b.onclick=()=> openInvoiceForm(store.get("invoices", b.dataset.edit)));
  tbl.querySelectorAll("[data-del]").forEach(b=> b.onclick=async ()=>{
    const v=store.get("invoices", b.dataset.del);
    if(await confirmDialog({ title:`Delete invoice ${v.number}?`, body:"This removes the saved record (any downloaded PDF stays on your computer)." })){
      store.remove("invoices", v.id); toast("Deleted"); render(content);
    }
  });
}

export default { title:"Invoices", sub:"Generate & download invoices", render };
