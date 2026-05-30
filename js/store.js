// ── Meltiva data store ──────────────────────────────────────────────────────
// Abstraction over storage. Today: localStorage. Later: Firebase (drop-in).
import { SEED } from "./data/seed-data.js";
import { uid, sum, groupBy, monthKey } from "./utils.js";

const KEY = "meltiva_db_v1";
const COLLECTIONS = ["shops","suppliers","categories","products","expenses","incomes","invoices","batches","recipes"];

let db = null;
const listeners = new Set();

function load(){
  try{
    const raw = localStorage.getItem(KEY);
    if(raw){ db = JSON.parse(raw); }
  }catch(e){ console.warn("Failed to read store, reseeding", e); }
  if(!db || !db.version){
    db = structuredClone(SEED);
    persist();
  }
  // ensure all collections exist (forward-compat)
  COLLECTIONS.forEach(c => { if(!Array.isArray(db[c])) db[c] = []; });
  if(!db.settings) db.settings = structuredClone(SEED.settings);
}
function persist(){
  localStorage.setItem(KEY, JSON.stringify(db));
}
function emit(){ persist(); listeners.forEach(fn => { try{ fn(); }catch(e){ console.error(e); } }); }

export const store = {
  init(){ if(!db) load(); return db; },
  onChange(fn){ listeners.add(fn); return ()=>listeners.delete(fn); },
  raw(){ return db; },

  // ---------- generic CRUD ----------
  list(coll){ return db[coll] || []; },
  get(coll, id){ return (db[coll]||[]).find(x => x.id === id) || null; },
  add(coll, obj){
    const item = { id: obj.id || uid(coll[0]), ...obj };
    db[coll].unshift(item); emit(); return item;
  },
  update(coll, id, patch){
    const i = db[coll].findIndex(x => x.id === id);
    if(i >= 0){ db[coll][i] = { ...db[coll][i], ...patch }; emit(); return db[coll][i]; }
    return null;
  },
  remove(coll, id){ db[coll] = db[coll].filter(x => x.id !== id); emit(); },

  // ---------- settings ----------
  settings(){ return db.settings; },
  saveSettings(patch){ db.settings = { ...db.settings, ...patch }; emit(); },

  // ---------- simple lists (suppliers / categories / products) ----------
  addToList(coll, value){
    value = String(value).trim(); if(!value) return;
    if(!db[coll].some(v => v.toLowerCase() === value.toLowerCase())){ db[coll].push(value); db[coll].sort((a,b)=>a.localeCompare(b)); emit(); }
  },
  removeFromList(coll, value){ db[coll] = db[coll].filter(v => v !== value); emit(); },

  // ---------- shops (customers) ----------
  shops(activeOnly=false){ return db.shops.filter(s => !activeOnly || s.active !== false); },
  shop(id){ return db.shops.find(s => s.id === id) || null; },
  shopName(id){ const s = this.shop(id); return s ? s.name : (id || "—"); },
  addShop(data){
    const id = data.id || (data.name||"shop").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
    const shop = {
      id, name:data.name, basis:data.basis||"cash",
      commissionType:data.commissionType||"none", commissionValue:Number(data.commissionValue)||0,
      invoicePrefix:data.invoicePrefix||id.slice(0,3).toUpperCase(), invoiceNext:Number(data.invoiceNext)||1,
      invoiceCommissionMode:data.invoiceCommissionMode||"net", // net | deduct
      address:data.address||"", defaultRate:Number(data.defaultRate)||0, isChannel:!!data.isChannel, active:true,
    };
    if(db.shops.some(s=>s.id===id)){ this.update("shops", id, shop); return shop; }
    db.shops.push(shop); emit(); return shop;
  },

  // ---------- income maths ----------
  incomeAmount(row){ return (Number(row.quantity||0) - Number(row.remaining||0)) * Number(row.rate||0); },

  // ---------- aggregates ----------
  totalIncome(rows){ return sum(rows || db.incomes, r => this.incomeAmount(r)); },
  totalExpenses(rows){ return sum(rows || db.expenses, r => r.amount); },
  netProfit(){ return this.totalIncome() - this.totalExpenses(); },
  qtyProduced(rows){ return sum(rows || db.incomes, r => r.quantity); },
  qtyUnsold(rows){ return sum(rows || db.incomes, r => r.remaining); },
  qtySold(rows){ return this.qtyProduced(rows) - this.qtyUnsold(rows); },

  incomeByShop(rows){
    const g = groupBy(rows || db.incomes, r => r.shopId || r.shop);
    return [...g.entries()].map(([id, items]) => ({
      shopId:id, shop:this.shopName(id), amount:this.totalIncome(items),
      qty:this.qtySold(items), count:items.length,
    })).sort((a,b)=>b.amount-a.amount);
  },
  expensesByCategory(rows){
    const g = groupBy(rows || db.expenses, r => r.category || "Other");
    return [...g.entries()].map(([cat, items]) => ({ category:cat, amount:sum(items, x=>x.amount), count:items.length }))
      .sort((a,b)=>b.amount-a.amount);
  },
  byMonth(){
    const inc = groupBy(db.incomes, r => monthKey(r.date));
    const exp = groupBy(db.expenses, r => monthKey(r.date));
    const keys = [...new Set([...inc.keys(), ...exp.keys()])].filter(k=>k!=="unknown").sort();
    return keys.map(k => {
      const income = this.totalIncome(inc.get(k)||[]);
      const expense = sum(exp.get(k)||[], x=>x.amount);
      return { key:k, income, expense, profit:income-expense };
    });
  },

  // ---------- invoices ----------
  nextInvoiceNumber(shop){
    const n = Number(shop.invoiceNext)||1;
    return `${shop.invoicePrefix}/${String(n).padStart(3,"0")}`;
  },
  bumpInvoiceCounter(shopId){
    const s = this.shop(shopId); if(s){ s.invoiceNext = (Number(s.invoiceNext)||1) + 1; emit(); }
  },

  // ---------- danger ----------
  resetToSeed(){ db = structuredClone(SEED); emit(); },
  exportAll(){ return JSON.stringify(db, null, 2); },
  importAll(json){ db = JSON.parse(json); COLLECTIONS.forEach(c=>{ if(!Array.isArray(db[c])) db[c]=[]; }); emit(); },
};
