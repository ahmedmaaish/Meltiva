// ── Recipe Vault — secure recipe storage with per-tray quantities ───────────
import { store } from "../store.js";
import { el, icon, toast, openModal, confirmDialog, escapeHtml, uid } from "../utils.js";

function blankTray(){ return { id:uid("tray"), label:"", items:[{ ingredient:"", qty:"" }] }; }

function openEditor(existing){
  const isEdit = !!existing;
  const draft = existing
    ? structuredClone(existing)
    : { name:"", category:"Brownies", method:"", notes:"", trays:[blankTray()] };
  if(!draft.trays || draft.trays.length===0) draft.trays = [blankTray()];

  const m = openModal({ title:isEdit?"Edit recipe":"New recipe", icon:"menu_book", wide:true });
  m.body.innerHTML = `
    <div class="form-grid">
      <div class="form-grid cols-2">
        <label class="field">Recipe name<input id="r_name" value="${escapeHtml(draft.name||"")}" placeholder="e.g. Fudgie Brownies"></label>
        <label class="field">Category<input id="r_cat" value="${escapeHtml(draft.category||"")}" placeholder="e.g. Brownies"></label>
      </div>
      <div>
        <div class="between" style="margin-bottom:8px"><div class="field" style="margin:0">Tray sizes & quantities</div>
          <button class="btn btn-soft btn-sm" id="r_addtray">${icon("add")} Add tray size</button></div>
        <div id="r_trays" class="grid" style="gap:14px"></div>
      </div>
      <label class="field">Method / steps<textarea id="r_method" rows="5" placeholder="Step-by-step method…">${escapeHtml(draft.method||"")}</textarea></label>
      <label class="field">Notes<textarea id="r_notes" rows="2">${escapeHtml(draft.notes||"")}</textarea></label>
    </div>`;
  m.foot.innerHTML = `<button class="btn btn-ghost" data-x="cancel">Cancel</button>
                      <button class="btn btn-primary" data-x="save">${icon("check")} ${isEdit?"Save recipe":"Add recipe"}</button>`;

  const traysMount = m.body.querySelector("#r_trays");
  function renderTrays(){
    traysMount.innerHTML = draft.trays.map((t,ti)=>`
      <div class="card card-pad" data-tray="${ti}" style="background:var(--card-2)">
        <div class="between" style="margin-bottom:10px">
          <input class="t-label" data-ti="${ti}" value="${escapeHtml(t.label||"")}" placeholder="Tray size (e.g. Small 5&quot;, Large 9&quot;)" style="max-width:280px">
          <button class="btn-icon danger" data-deltray="${ti}" title="Remove tray">${icon("delete")}</button>
        </div>
        <table class="data" style="min-width:auto"><thead><tr><th>Ingredient</th><th style="width:130px">Quantity</th><th style="width:34px"></th></tr></thead>
          <tbody>
            ${t.items.map((it,ii)=>`<tr>
              <td><input class="t-ing" data-ti="${ti}" data-ii="${ii}" value="${escapeHtml(it.ingredient||"")}" placeholder="e.g. Cocoa powder"></td>
              <td><input class="t-qty" data-ti="${ti}" data-ii="${ii}" value="${escapeHtml(it.qty||"")}" placeholder="e.g. 250g"></td>
              <td><button class="btn-icon danger" data-delitem="${ti}.${ii}">${icon("close")}</button></td>
            </tr>`).join("")}
          </tbody></table>
        <button class="btn btn-ghost btn-sm" data-additem="${ti}" style="margin-top:8px">${icon("add")} Add ingredient</button>
      </div>`).join("");
    // wire
    traysMount.querySelectorAll(".t-label").forEach(i=> i.oninput=()=> draft.trays[+i.dataset.ti].label=i.value);
    traysMount.querySelectorAll(".t-ing").forEach(i=> i.oninput=()=> draft.trays[+i.dataset.ti].items[+i.dataset.ii].ingredient=i.value);
    traysMount.querySelectorAll(".t-qty").forEach(i=> i.oninput=()=> draft.trays[+i.dataset.ti].items[+i.dataset.ii].qty=i.value);
    traysMount.querySelectorAll("[data-additem]").forEach(b=> b.onclick=()=>{ draft.trays[+b.dataset.additem].items.push({ingredient:"",qty:""}); renderTrays(); });
    traysMount.querySelectorAll("[data-delitem]").forEach(b=> b.onclick=()=>{ const [ti,ii]=b.dataset.delitem.split(".").map(Number); draft.trays[ti].items.splice(ii,1); if(draft.trays[ti].items.length===0) draft.trays[ti].items.push({ingredient:"",qty:""}); renderTrays(); });
    traysMount.querySelectorAll("[data-deltray]").forEach(b=> b.onclick=()=>{ draft.trays.splice(+b.dataset.deltray,1); if(draft.trays.length===0) draft.trays.push(blankTray()); renderTrays(); });
  }
  renderTrays();
  m.body.querySelector("#r_addtray").onclick = ()=>{ draft.trays.push(blankTray()); renderTrays(); };

  m.foot.querySelector('[data-x="cancel"]').onclick = m.close;
  m.foot.querySelector('[data-x="save"]').onclick = ()=>{
    draft.name = m.body.querySelector("#r_name").value.trim();
    draft.category = m.body.querySelector("#r_cat").value.trim();
    draft.method = m.body.querySelector("#r_method").value.trim();
    draft.notes = m.body.querySelector("#r_notes").value.trim();
    if(!draft.name){ toast("Enter a recipe name","bad"); return; }
    // prune empty ingredient rows
    draft.trays.forEach(t=> t.items = t.items.filter(it=> it.ingredient || it.qty));
    if(isEdit) store.update("recipes", existing.id, draft); else store.add("recipes", draft);
    toast(isEdit?"Recipe saved":"Recipe added","good");
    m.close(); render(document.getElementById("content"));
  };
}

function viewRecipe(r){
  const m = openModal({ title:r.name, icon:"menu_book", wide:true });
  m.body.innerHTML = `
    ${r.category?`<span class="pill" style="margin-bottom:14px;display:inline-flex">${escapeHtml(r.category)}</span>`:""}
    <div class="grid" style="gap:14px">
      ${(r.trays||[]).map(t=>`
        <div class="card card-pad">
          <h4 style="margin-bottom:10px">${icon("bakery_dining")} ${escapeHtml(t.label||"Tray")}</h4>
          <table class="data" style="min-width:auto"><tbody>
            ${(t.items||[]).map(it=>`<tr><td>${escapeHtml(it.ingredient)}</td><td class="num" style="font-weight:600">${escapeHtml(it.qty)}</td></tr>`).join("") || `<tr><td class="muted">No ingredients</td></tr>`}
          </tbody></table>
        </div>`).join("")}
    </div>
    ${r.method?`<div style="margin-top:16px"><h4 style="margin-bottom:8px">${icon("list_alt")} Method</h4><div class="card card-pad" style="white-space:pre-wrap;line-height:1.6;color:var(--ink-soft)">${escapeHtml(r.method)}</div></div>`:""}
    ${r.notes?`<div style="margin-top:14px" class="muted"><strong>Notes:</strong> ${escapeHtml(r.notes)}</div>`:""}`;
  m.foot.innerHTML = `<button class="btn btn-ghost" data-x="c">Close</button><button class="btn btn-primary" data-x="e">${icon("edit")} Edit</button>`;
  m.foot.querySelector('[data-x="c"]').onclick = m.close;
  m.foot.querySelector('[data-x="e"]').onclick = ()=>{ m.close(); openEditor(r); };
}

function render(content, opts={}){
  const actions = opts.actions || el("div"); actions.innerHTML="";
  actions.append(el("button.btn.btn-primary", { onclick:()=>openEditor(null), html:`${icon("add")} New recipe` }));

  const list = store.list("recipes");
  const wrap = el("div");
  wrap.append(el("div.card.card-pad", { style:"display:flex;align-items:center;gap:10px;margin-bottom:18px;background:var(--brand-tint);border-color:var(--brand-soft)",
    html:`${icon("lock","fill")}<span style="font-size:13.5px;color:var(--brand-700)"><strong>Private vault.</strong> These recipes are only visible after signing in to Meltiva.</span>` }));

  if(list.length===0){
    wrap.append(el("div.card.empty", { html:`${icon("menu_book")}<h3>No recipes yet</h3><p>Add your recipes with per-tray quantities — kept private behind your login.</p>
      <div style="margin-top:14px"><button class="btn btn-primary" id="first">${icon("add")} New recipe</button></div>` }));
    content.append(wrap);
    wrap.querySelector("#first").onclick = ()=>openEditor(null);
    return;
  }
  const grid = el("div.grid.grid-2");
  list.forEach(r=>{
    const card = el("div.card.card-pad", { style:"cursor:pointer" });
    card.innerHTML = `
      <div class="between">
        <h3>${escapeHtml(r.name)}</h3>
        <div class="actions">
          <button class="btn-icon" data-edit="${r.id}" title="Edit">${icon("edit")}</button>
          <button class="btn-icon danger" data-del="${r.id}" title="Delete">${icon("delete")}</button>
        </div>
      </div>
      <div class="row" style="margin-top:6px;gap:8px">
        ${r.category?`<span class="pill">${escapeHtml(r.category)}</span>`:""}
        <span class="pill gray">${icon("bakery_dining")} ${(r.trays||[]).length} tray size${(r.trays||[]).length===1?"":"s"}</span>
      </div>`;
    card.onclick = (e)=>{ if(e.target.closest("[data-edit],[data-del]")) return; viewRecipe(r); };
    card.querySelector("[data-edit]").onclick = ()=> openEditor(r);
    card.querySelector("[data-del]").onclick = async ()=>{
      if(await confirmDialog({ title:`Delete “${r.name}”?`, body:"This recipe will be permanently removed." })){ store.remove("recipes", r.id); toast("Deleted"); render(content); }
    };
    grid.append(card);
  });
  wrap.append(grid); content.append(wrap);
}

export default { title:"Recipes", sub:"Your secure recipe vault", render };
