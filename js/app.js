// ── Meltiva app shell + router ──────────────────────────────────────────────
import { store } from "./store.js";
import { auth } from "./auth.js";
import { el, icon, clear } from "./utils.js";

import dashboard from "./views/dashboard.js";
import expenses  from "./views/expenses.js";
import income    from "./views/income.js";
import invoices  from "./views/invoices.js";
import batches   from "./views/batches.js";
import recipes   from "./views/recipes.js";
import settings  from "./views/settings.js";

const ROUTES = {
  dashboard: { ...dashboard, icon:"insights",       label:"Dashboard" },
  expenses:  { ...expenses,  icon:"receipt_long",    label:"Expenses" },
  income:    { ...income,    icon:"payments",        label:"Income" },
  invoices:  { ...invoices,  icon:"description",     label:"Invoices" },
  batches:   { ...batches,   icon:"inventory_2",     label:"Batch Log" },
  recipes:   { ...recipes,   icon:"menu_book",       label:"Recipes" },
  settings:  { ...settings,  icon:"settings",        label:"Settings" },
};
const ORDER = ["dashboard","expenses","income","invoices","batches","recipes","settings"];

const app = document.getElementById("app");

function currentRoute(){
  const key = (location.hash.replace(/^#\/?/, "") || "dashboard").split("?")[0];
  return ROUTES[key] ? key : "dashboard";
}

function renderShell(){
  app.removeAttribute("aria-busy");
  const shell = el("div.shell");
  shell.innerHTML = `
    <aside class="sidebar" id="sidebar">
      <div class="brand">
        <svg class="logo" viewBox="0 0 100 108" fill="none" stroke="currentColor" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="M50 6 L86 26 Q90 28 90 33 L90 71 Q90 76 86 78 L54 96 Q50 98 46 96 L14 78 Q10 76 10 71 L10 33 Q10 28 14 26 Z"/>
          <path d="M30 60 Q30 44 39 44 Q47 44 47 58 Q47 50 53 50 Q59 50 59 60"/>
          <path d="M44.5 56 Q44.5 74 44.5 86 Q44.5 92 49 92 Q53.5 92 53.5 86 L53.5 62"/>
        </svg>
        <div class="name">meltiva<small>Business Hub</small></div>
      </div>
      <nav class="nav" id="nav">
        ${ORDER.map(k => `<a href="#/${k}" data-route="${k}">${icon(ROUTES[k].icon)} ${ROUTES[k].label}</a>`).join("")}
      </nav>
      <div class="nav-foot">
        <a href="#" id="logoutBtn" style="color:var(--bad)">${icon("logout")} Sign out</a>
      </div>
    </aside>
    <div class="scrim" id="scrim"></div>
    <div class="main">
      <header class="topbar">
        <button class="btn-icon hamburger" id="hamburger">${icon("menu")}</button>
        <div>
          <div class="page-title" id="pageTitle">Dashboard</div>
          <div class="page-sub" id="pageSub"></div>
        </div>
        <div class="spacer"></div>
        <div id="topActions" class="row"></div>
      </header>
      <main class="content" id="content"></main>
    </div>`;
  app.replaceChildren(shell);

  const sidebar = shell.querySelector("#sidebar");
  const scrim = shell.querySelector("#scrim");
  const closeNav = ()=>{ sidebar.classList.remove("open"); scrim.classList.remove("show"); };
  shell.querySelector("#hamburger").onclick = ()=>{ sidebar.classList.toggle("open"); scrim.classList.toggle("show"); };
  scrim.onclick = closeNav;
  shell.querySelector("#logoutBtn").onclick = (e)=>{ e.preventDefault(); auth.logout(); };
  shell.querySelectorAll("#nav a").forEach(a => a.addEventListener("click", closeNav));

  window.addEventListener("hashchange", renderRoute);
  renderRoute();
}

function renderRoute(){
  const key = currentRoute();
  const route = ROUTES[key];
  document.querySelectorAll("#nav a").forEach(a => a.classList.toggle("active", a.dataset.route === key));
  document.getElementById("pageTitle").textContent = route.label;
  document.getElementById("pageSub").textContent = route.sub || "";
  const actions = document.getElementById("topActions"); clear(actions);
  const content = document.getElementById("content");
  clear(content);
  content.scrollTop = 0; window.scrollTo(0,0);
  try{
    route.render(content, { actions });
  }catch(e){
    console.error(e);
    content.innerHTML = `<div class="empty">${icon("error")}<h3>Something went wrong</h3><p>${e.message}</p></div>`;
  }
}

function boot(){
  store.init();
  if(auth.isAuthed()) renderShell();
  else auth.renderLogin(app, renderShell);
}
boot();
