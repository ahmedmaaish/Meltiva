// ── Settings tab ────────────────────────────────────────────────────────────
import { store } from "../store.js";
import { el, icon, toast, escapeHtml, confirmDialog, download, todayISO, fmtMVR } from "../utils.js";
import { shopForm } from "./shop-form.js";

function basisPill(s){
  return `<span class="pill ${s.basis==="invoice"?"amber":"gray"} tag-basis">${s.basis}</span>`;
}
function commLabel(s){
  if(s.commissionType==="percent") return `${s.commissionValue}%`;
  if(s.commissionType==="perUnit") return `${fmtMVR(s.commissionValue,false)}/unit`;
  return "—";
}

function render(content){
  const st = store.settings();
  const wrap = el("div");
  wrap.innerHTML = `
    <!-- Business & invoice -->
    <div class="card card-pad section">
      <h3 style="margin-bottom:14px">${icon("storefront")} Business & invoice details</h3>
      <div class="form-grid">
        <div class="form-grid cols-2">
          <label class="field">Business name<input id="b_name" value="${escapeHtml(st.business?.name||"")}"></label>
          <label class="field">Tagline<input id="b_tag" value="${escapeHtml(st.business?.tagline||"")}"></label>
        </div>
        <div class="form-grid cols-2">
          <label class="field">Payment method<input id="b_pm" value="${escapeHtml(st.bank?.paymentMethod||"")}"></label>
          <label class="field">Bank name<input id="b_bank" value="${escapeHtml(st.bank?.bankName||"")}"></label>
        </div>
        <div class="form-grid cols-2">
          <label class="field">Account number<input id="b_accno" value="${escapeHtml(st.bank?.accountNumber||"")}"></label>
          <label class="field">Account name<input id="b_accname" value="${escapeHtml(st.bank?.accountName||"")}"></label>
        </div>
        <div class="form-grid cols-2">
          <label class="field">Invoice footer / terms<input id="b_terms" value="${escapeHtml(st.invoiceTerms||"")}"></label>
          <label class="field">Start-up date<input type="date" id="b_start" value="${st.startupDate||""}"></label>
        </div>
        <div><button class="btn btn-primary" id="saveBiz">${icon("check")} Save details</button></div>
      </div>
    </div>

    <!-- Shops -->
    <div class="card card-pad section">
      <div class="between" style="margin-bottom:14px">
        <h3>${icon("local_mall")} Shops & channels</h3>
        <button class="btn btn-soft btn-sm" id="addShop">${icon("add")} Add shop</button>
      </div>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>Shop</th><th>Basis</th><th>Commission</th><th>Invoice</th><th class="num">Default rate</th><th></th></tr></thead>
          <tbody>
            ${store.shops().map(s=>`
              <tr>
                <td><strong>${escapeHtml(s.name)}</strong>${s.isChannel?' <span class="pill gray">channel</span>':""}</td>
                <td>${basisPill(s)}</td>
                <td>${commLabel(s)}</td>
                <td>${escapeHtml(s.invoicePrefix||"—")}/${String(s.invoiceNext||1).padStart(3,"0")} <span class="muted">· ${s.invoiceCommissionMode||"net"}</span></td>
                <td class="num">${s.defaultRate?fmtMVR(s.defaultRate,false):"—"}</td>
                <td><div class="actions">
                  <button class="btn-icon" data-edit-shop="${s.id}">${icon("edit")}</button>
                  <button class="btn-icon danger" data-del-shop="${s.id}">${icon("delete")}</button>
                </div></td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Suppliers & categories -->
    <div class="grid grid-2 section">
      <div class="card card-pad">
        <h3 style="margin-bottom:12px">${icon("local_shipping")} Suppliers</h3>
        <div class="chips" id="supChips"></div>
        <div class="row" style="margin-top:12px"><input id="newSup" placeholder="Add supplier…" class="grow"><button class="btn btn-ghost btn-sm" id="addSup">${icon("add")}</button></div>
      </div>
      <div class="card card-pad">
        <h3 style="margin-bottom:12px">${icon("category")} Expense categories</h3>
        <div class="chips" id="catChips"></div>
        <div class="row" style="margin-top:12px"><input id="newCat" placeholder="Add category…" class="grow"><button class="btn btn-ghost btn-sm" id="addCat">${icon("add")}</button></div>
      </div>
    </div>

    <!-- Data -->
    <div class="card card-pad section">
      <h3 style="margin-bottom:6px">${icon("database")} Your data</h3>
      <p class="muted" style="font-size:13px;margin:0 0 14px">Everything is saved in this browser for now. Back it up regularly. Cloud sync (Firebase) is the next step.</p>
      <div class="row">
        <button class="btn btn-ghost" id="exportData">${icon("download")} Download backup</button>
        <button class="btn btn-ghost" id="importData">${icon("upload")} Restore backup</button>
        <button class="btn btn-danger" id="resetData" style="margin-left:auto">${icon("restart_alt")} Reset to original data</button>
      </div>
      <input type="file" id="importFile" accept="application/json" style="display:none">
    </div>`;
  content.append(wrap);

  // business save
  wrap.querySelector("#saveBiz").onclick = ()=>{
    store.saveSettings({
      business:{ name:wrap.querySelector("#b_name").value.trim(), tagline:wrap.querySelector("#b_tag").value.trim() },
      bank:{ paymentMethod:wrap.querySelector("#b_pm").value.trim(), bankName:wrap.querySelector("#b_bank").value.trim(),
             accountNumber:wrap.querySelector("#b_accno").value.trim(), accountName:wrap.querySelector("#b_accname").value.trim() },
      invoiceTerms:wrap.querySelector("#b_terms").value.trim(), startupDate:wrap.querySelector("#b_start").value,
    });
    toast("Details saved","good");
  };

  // shops
  wrap.querySelector("#addShop").onclick = ()=> shopForm(null, ()=>render(content));
  wrap.querySelectorAll("[data-edit-shop]").forEach(b=> b.onclick=()=> shopForm(store.shop(b.dataset.editShop), ()=>render(content)));
  wrap.querySelectorAll("[data-del-shop]").forEach(b=> b.onclick=async ()=>{
    const s=store.shop(b.dataset.delShop);
    if(await confirmDialog({ title:`Delete ${s.name}?`, body:"Income entries for this shop will keep their saved name." })){
      store.remove("shops", s.id); toast("Shop deleted"); render(content);
    }
  });

  // supplier/category chips
  const renderChips = (coll, mount)=>{
    mount.innerHTML = store.list(coll).map(v=>`<span class="chip">${escapeHtml(v)}<span class="ms" data-rm="${escapeHtml(v)}" style="font-size:15px;cursor:pointer">close</span></span>`).join("") || `<span class="muted" style="font-size:13px">None yet</span>`;
    mount.querySelectorAll("[data-rm]").forEach(x=> x.onclick=()=>{ store.removeFromList(coll, x.dataset.rm); renderChips(coll, mount); });
  };
  renderChips("suppliers", wrap.querySelector("#supChips"));
  renderChips("categories", wrap.querySelector("#catChips"));
  wrap.querySelector("#addSup").onclick = ()=>{ const v=wrap.querySelector("#newSup"); store.addToList("suppliers", v.value); v.value=""; renderChips("suppliers", wrap.querySelector("#supChips")); };
  wrap.querySelector("#addCat").onclick = ()=>{ const v=wrap.querySelector("#newCat"); store.addToList("categories", v.value); v.value=""; renderChips("categories", wrap.querySelector("#catChips")); };

  // data
  wrap.querySelector("#exportData").onclick = ()=>{ download(`meltiva-backup-${todayISO()}.json`, store.exportAll(), "application/json"); toast("Backup downloaded","good"); };
  wrap.querySelector("#importData").onclick = ()=> wrap.querySelector("#importFile").click();
  wrap.querySelector("#importFile").onchange = (e)=>{
    const f=e.target.files[0]; if(!f) return;
    const rd=new FileReader();
    rd.onload=()=>{ try{ store.importAll(rd.result); toast("Backup restored","good"); render(content); }catch(err){ toast("Invalid backup file","bad"); } };
    rd.readAsText(f);
  };
  wrap.querySelector("#resetData").onclick = async ()=>{
    if(await confirmDialog({ title:"Reset everything?", body:"This restores the original imported data and wipes any changes you've made in this browser. Download a backup first if unsure." })){
      store.resetToSeed(); toast("Reset complete"); render(content);
    }
  };
}

export default { title:"Settings", sub:"Shops, bank details & data", render };
