// ── Reusable shop editor (customers we deliver to) ──────────────────────────
import { store } from "../store.js";
import { icon, toast, openModal, escapeHtml } from "../utils.js";

// shopForm(existingOrNull, onSave, onCancel)
export function shopForm(existing, onSave, onCancel){
  const isEdit = !!existing;
  const m = openModal({ title:isEdit?`Edit ${existing.name}`:"Add shop / channel", icon:"storefront" });
  const s = existing || { name:"", basis:"cash", commissionType:"none", commissionValue:0,
    invoicePrefix:"", invoiceNext:1, invoiceCommissionMode:"net", address:"", defaultRate:0, isChannel:false };

  m.body.innerHTML = `
    <div class="form-grid">
      <label class="field">Shop name<input type="text" id="s_name" value="${escapeHtml(s.name)}" placeholder="e.g. Uncle Bobo"></label>
      <div class="form-grid cols-2">
        <label class="field">Billing basis
          <select id="s_basis">
            <option value="cash" ${s.basis==="cash"?"selected":""}>Cash (paid on delivery)</option>
            <option value="invoice" ${s.basis==="invoice"?"selected":""}>Invoice (billed later)</option>
          </select></label>
        <label class="field">Default rate (MVR/unit)<input type="number" min="0" step="0.01" id="s_rate" value="${s.defaultRate||0}"></label>
      </div>
      <div class="card card-pad" style="background:var(--card-2)">
        <div class="field" style="margin-bottom:10px">Commission we give this shop</div>
        <div class="form-grid cols-2">
          <label class="field">Type
            <select id="s_ctype">
              <option value="none" ${s.commissionType==="none"?"selected":""}>None</option>
              <option value="percent" ${s.commissionType==="percent"?"selected":""}>Percentage (%)</option>
              <option value="perUnit" ${s.commissionType==="perUnit"?"selected":""}>Per unit (MVR)</option>
            </select></label>
          <label class="field">Value<input type="number" min="0" step="0.01" id="s_cval" value="${s.commissionValue||0}"></label>
        </div>
      </div>
      <div class="card card-pad">
        <div class="field" style="margin-bottom:10px">Invoicing</div>
        <div class="form-grid cols-2">
          <label class="field">Invoice prefix<input type="text" id="s_prefix" value="${escapeHtml(s.invoicePrefix||"")}" placeholder="e.g. WG"></label>
          <label class="field">Next number<input type="number" min="1" step="1" id="s_next" value="${s.invoiceNext||1}"></label>
        </div>
        <label class="field" style="margin-top:12px">How commission shows on the invoice
          <select id="s_imode">
            <option value="net" ${s.invoiceCommissionMode==="net"?"selected":""}>Rate is already net — show “—” (like your WS Green sample)</option>
            <option value="deduct" ${s.invoiceCommissionMode==="deduct"?"selected":""}>Deduct commission as a line on the invoice</option>
          </select></label>
      </div>
      <label class="field">Address <span class="muted" style="font-weight:400">(shown on invoice “Bill to”)</span>
        <textarea id="s_addr" rows="2" placeholder="Street&#10;Area">${escapeHtml(s.address||"")}</textarea></label>
      <label class="field" style="flex-direction:row;align-items:center;gap:8px">
        <input type="checkbox" id="s_channel" ${s.isChannel?"checked":""} style="width:auto"> This is a direct channel (Pre-order / walk-in), not a delivery shop
      </label>
    </div>`;
  m.foot.innerHTML = `<button class="btn btn-ghost" data-x="cancel">Cancel</button>
                      <button class="btn btn-primary" data-x="save">${icon("check")} ${isEdit?"Save shop":"Add shop"}</button>`;
  m.foot.querySelector('[data-x="cancel"]').onclick = ()=>{ m.close(); onCancel && onCancel(); };
  m.foot.querySelector('[data-x="save"]').onclick = ()=>{
    const name = m.body.querySelector("#s_name").value.trim();
    if(!name){ toast("Enter a shop name","bad"); return; }
    const data = {
      id: existing?.id, name,
      basis: m.body.querySelector("#s_basis").value,
      defaultRate: Number(m.body.querySelector("#s_rate").value)||0,
      commissionType: m.body.querySelector("#s_ctype").value,
      commissionValue: Number(m.body.querySelector("#s_cval").value)||0,
      invoicePrefix: m.body.querySelector("#s_prefix").value.trim() || name.slice(0,2).toUpperCase(),
      invoiceNext: Number(m.body.querySelector("#s_next").value)||1,
      invoiceCommissionMode: m.body.querySelector("#s_imode").value,
      address: m.body.querySelector("#s_addr").value.trim(),
      isChannel: m.body.querySelector("#s_channel").checked,
    };
    const saved = isEdit ? store.update("shops", existing.id, data) : store.addShop(data);
    toast(isEdit?"Shop updated":"Shop added","good");
    m.close(); onSave && onSave(saved);
  };
}
