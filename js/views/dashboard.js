// ── Dashboard + reports ─────────────────────────────────────────────────────
import { store } from "../store.js";
import { el, icon, fmtMVR, fmtNum, toast, toCSV, download, todayISO,
         monthLabel, daysSince, escapeHtml } from "../utils.js";

let charts = [];
function destroyCharts(){ charts.forEach(c=>{ try{c.destroy();}catch(e){} }); charts = []; }

const C = { brand:"#A67C52", brand2:"#C9A982", deep:"#6F4E33", good:"#5C8A5E", bad:"#B5544C",
            tint:"#EFE3D3", line:"#E8DDCC", ink:"#4A3B2E", muted:"#9A8772" };
const SHOP_COLORS = ["#A67C52","#C9A982","#6F4E33","#8C6442","#D8C3A4","#B5896B","#7E6A55","#E0CBA8","#9c6b43"];

function kpi(cls, ic, label, value, sub){
  return `<div class="kpi ${cls||""}">
    <div class="ico">${icon(ic)}</div>
    <div class="label">${label}</div>
    <div class="value">${value}</div>
    ${sub?`<div class="delta">${sub}</div>`:""}
  </div>`;
}

function render(content){
  destroyCharts();
  const incomeRows = store.list("incomes");
  const totalIncome = store.totalIncome();
  const totalExp = store.totalExpenses();
  const net = totalIncome - totalExp;
  const sold = store.qtySold();
  const unsold = store.qtyUnsold();
  const produced = store.qtyProduced();
  const avgPrice = sold>0 ? totalIncome/sold : 0;
  const margin = totalIncome>0 ? (net/totalIncome*100) : 0;
  const days = daysSince(store.settings().startupDate);
  const perDay = net/days;
  const byMonth = store.byMonth();
  const byShop = store.incomeByShop();
  const byCat = store.expensesByCategory();

  const wrap = el("div");
  wrap.innerHTML = `
    <div class="grid grid-kpi section">
      ${kpi("good","trending_up","Total income", fmtMVR(totalIncome))}
      ${kpi("bad","trending_down","Total expenses", fmtMVR(totalExp))}
      ${kpi(net>=0?"":"bad","savings","Net profit", `<span class="${net>=0?'amt-pos':'amt-neg'}">${fmtMVR(net)}</span>`, `${margin.toFixed(1)}% margin`)}
      ${kpi("","local_mall","Brownies sold", fmtNum(sold), `${fmtNum(unsold)} unsold of ${fmtNum(produced)}`)}
    </div>
    <div class="grid grid-kpi section">
      ${kpi("","sell","Avg. price / unit", fmtMVR(avgPrice))}
      ${kpi("","calendar_month","Avg. profit / day", fmtMVR(perDay))}
      ${kpi("","storefront","Active shops", fmtNum(store.shops(true).filter(s=>!s.isChannel).length))}
      ${kpi("","event","Days trading", fmtNum(days))}
    </div>

    <div class="grid grid-2 section">
      <div class="card card-pad">
        <div class="between" style="margin-bottom:14px"><h3>Income vs Expenses</h3><span class="muted" style="font-size:12px">by month</span></div>
        <div style="height:280px"><canvas id="cMonth"></canvas></div>
      </div>
      <div class="card card-pad">
        <div class="between" style="margin-bottom:14px"><h3>Income by shop</h3><span class="muted" style="font-size:12px">all time</span></div>
        <div style="height:280px"><canvas id="cShop"></canvas></div>
      </div>
    </div>

    <div class="grid grid-2 section">
      <div class="card card-pad">
        <div class="between" style="margin-bottom:14px"><h3>Expenses by category</h3></div>
        <div style="height:260px"><canvas id="cCat"></canvas></div>
      </div>
      <div class="card card-pad">
        <div class="between" style="margin-bottom:6px"><h3>Quality reports</h3></div>
        <p class="muted" style="font-size:13px;margin:0 0 14px">Download any report as a CSV (opens in Excel).</p>
        <div class="grid" style="gap:10px">
          ${reportBtn("summary","Profit & Loss summary","summarize")}
          ${reportBtn("month","Monthly performance","calendar_month")}
          ${reportBtn("shop","Income by shop","storefront")}
          ${reportBtn("product","Sales by product","cake")}
          ${reportBtn("category","Expenses by category","receipt_long")}
          ${reportBtn("unsold","Wastage / unsold report","delete_sweep")}
        </div>
      </div>
    </div>`;
  content.append(wrap);

  wrap.querySelectorAll("[data-report]").forEach(b => b.onclick = ()=>runReport(b.dataset.report));

  // ---- charts ----
  const months = byMonth.map(m=>monthLabel(m.key).replace(" 20","'"));
  charts.push(new Chart(wrap.querySelector("#cMonth"), {
    type:"bar",
    data:{ labels:months, datasets:[
      { label:"Income", data:byMonth.map(m=>m.income), backgroundColor:C.brand, borderRadius:6, maxBarThickness:26 },
      { label:"Expenses", data:byMonth.map(m=>m.expense), backgroundColor:C.brand2, borderRadius:6, maxBarThickness:26 },
    ]},
    options: baseOpts({ legend:true }),
  }));
  charts.push(new Chart(wrap.querySelector("#cShop"), {
    type:"doughnut",
    data:{ labels:byShop.map(s=>s.shop), datasets:[{ data:byShop.map(s=>s.amount), backgroundColor:SHOP_COLORS, borderWidth:2, borderColor:"#fff" }]},
    options: donutOpts(),
  }));
  charts.push(new Chart(wrap.querySelector("#cCat"), {
    type:"doughnut",
    data:{ labels:byCat.map(s=>s.category), datasets:[{ data:byCat.map(s=>s.amount), backgroundColor:SHOP_COLORS, borderWidth:2, borderColor:"#fff" }]},
    options: donutOpts(),
  }));
}

function reportBtn(key, label, ic){
  return `<button class="btn btn-ghost" data-report="${key}" style="justify-content:flex-start">${icon(ic)} ${label} <span class="ms" style="margin-left:auto;color:var(--muted)">download</span></button>`;
}

function baseOpts({ legend=false }={}){
  return {
    responsive:true, maintainAspectRatio:false,
    plugins:{ legend:{ display:legend, position:"bottom", labels:{ usePointStyle:true, boxWidth:8, font:{ family:"Inter", size:12 }, color:C.ink } },
      tooltip:{ callbacks:{ label:(c)=>`${c.dataset.label||c.label}: MVR ${Number(c.parsed.y ?? c.parsed).toLocaleString()}` } } },
    scales:{ x:{ grid:{ display:false }, ticks:{ color:C.muted, font:{ family:"Inter", size:11 } } },
      y:{ grid:{ color:C.line }, ticks:{ color:C.muted, font:{ family:"Inter", size:11 }, callback:v=>v>=1000?(v/1000)+"k":v } } },
  };
}
function donutOpts(){
  return { responsive:true, maintainAspectRatio:false, cutout:"62%",
    plugins:{ legend:{ position:"right", labels:{ usePointStyle:true, boxWidth:8, padding:12, font:{ family:"Inter", size:12 }, color:C.ink } },
      tooltip:{ callbacks:{ label:(c)=>`${c.label}: MVR ${Number(c.parsed).toLocaleString()}` } } } };
}

// ---- reports ----
function runReport(key){
  let headers, rows, name;
  if(key==="summary"){
    const inc=store.totalIncome(), exp=store.totalExpenses();
    headers=["Metric","Value (MVR)"];
    rows=[
      ["Total income", inc.toFixed(2)],["Total expenses", exp.toFixed(2)],["Net profit", (inc-exp).toFixed(2)],
      ["Profit margin %", inc>0?((inc-exp)/inc*100).toFixed(1):"0"],
      ["Brownies produced", store.qtyProduced()],["Brownies sold", store.qtySold()],["Brownies unsold", store.qtyUnsold()],
      ["Avg price/unit", store.qtySold()>0?(inc/store.qtySold()).toFixed(2):"0"],
    ];
    name="profit-loss-summary";
  } else if(key==="month"){
    headers=["Month","Income","Expenses","Profit"];
    rows=store.byMonth().map(m=>[monthLabel(m.key), m.income.toFixed(2), m.expense.toFixed(2), m.profit.toFixed(2)]);
    name="monthly-performance";
  } else if(key==="shop"){
    headers=["Shop","Qty sold","Income (MVR)","# entries"];
    rows=store.incomeByShop().map(s=>[s.shop, s.qty, s.amount.toFixed(2), s.count]);
    name="income-by-shop";
  } else if(key==="product"){
    const map=new Map();
    store.list("incomes").forEach(r=>{ const k=r.product||"—"; const o=map.get(k)||{qty:0,amt:0,n:0};
      o.qty+=(r.quantity-r.remaining); o.amt+=store.incomeAmount(r); o.n++; map.set(k,o); });
    headers=["Product","Qty sold","Income (MVR)","# entries"];
    rows=[...map.entries()].sort((a,b)=>b[1].amt-a[1].amt).map(([k,o])=>[k,o.qty,o.amt.toFixed(2),o.n]);
    name="sales-by-product";
  } else if(key==="category"){
    headers=["Category","Amount (MVR)","# items"];
    rows=store.expensesByCategory().map(c=>[c.category,c.amount.toFixed(2),c.count]);
    name="expenses-by-category";
  } else if(key==="unsold"){
    headers=["Date","Batch","Product","Shop","Placed","Unsold/Expired","Lost value (MVR)"];
    rows=store.list("incomes").filter(r=>r.remaining>0).sort((a,b)=>(b.date||"").localeCompare(a.date||""))
      .map(r=>[r.date,r.batchNo,r.product,store.shopName(r.shopId),r.quantity,r.remaining,(r.remaining*r.rate).toFixed(2)]);
    name="wastage-unsold";
  }
  download(`meltiva-${name}-${todayISO()}.csv`, toCSV(headers, rows));
  toast("Report downloaded","good");
}

export default { title:"Dashboard", sub:"Business performance at a glance", render };
