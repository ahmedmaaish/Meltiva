// ── Invoice template + PDF export (matches the Meltiva sample) ───────────────
import { store } from "./store.js";
import { fmtDateShort, fmtDate } from "./utils.js";

const LOGO = `<svg viewBox="0 0 100 108" width="52" height="56" fill="none" stroke="#9b8164" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round">
  <path d="M50 6 L86 26 Q90 28 90 33 L90 71 Q90 76 86 78 L54 96 Q50 98 46 96 L14 78 Q10 76 10 71 L10 33 Q10 28 14 26 Z"/>
  <path d="M30 60 Q30 44 39 44 Q47 44 47 58 Q47 50 53 50 Q59 50 59 60"/>
  <path d="M44.5 56 Q44.5 74 44.5 86 Q44.5 92 49 92 Q53.5 92 53.5 86 L53.5 62"/></svg>`;

const money = n => Number(n||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});

// commission for an invoice given the shop config
export function computeInvoice(inv, shop){
  const items = inv.items || [];
  const subtotal = items.reduce((a,it)=> a + (Number(it.qty)||0)*(Number(it.rate)||0), 0);
  const totalQty = items.reduce((a,it)=> a + (Number(it.qty)||0), 0);
  let commission = 0, commissionLabel = "–";
  const mode = inv.commissionMode || shop?.invoiceCommissionMode || "net";
  if(mode === "deduct" && shop){
    if(shop.commissionType === "percent"){ commission = subtotal * (Number(shop.commissionValue)||0)/100; commissionLabel = "- " + money(commission); }
    else if(shop.commissionType === "perUnit"){ commission = totalQty * (Number(shop.commissionValue)||0); commissionLabel = "- " + money(commission); }
  }
  const total = subtotal - commission;
  return { subtotal, totalQty, commission, commissionLabel, total };
}

function placedRange(inv){
  if(inv.datePlacedFrom && inv.datePlacedTo) return `${fmtDateShort(inv.datePlacedFrom)} – ${fmtDateShort(inv.datePlacedTo)}`;
  return inv.datePlacedText || "—";
}

// Build the A4 invoice DOM node (inline-styled so it renders identically off-screen)
export function buildInvoiceNode(inv){
  const shop = store.shop(inv.shopId);
  const st = store.settings();
  const calc = computeInvoice(inv, shop);
  const C = { ink:"#5b4636", body:"#8a7257", muted:"#a9967e", bar:"#d8c6ad", line:"#c9b69c", paper:"#efe9df" };

  const node = document.createElement("div");
  Object.assign(node.style, {
    width:"794px", minHeight:"1123px", boxSizing:"border-box", padding:"62px 60px 54px",
    background:`linear-gradient(135deg,#f3eee5 0%, #ece4d6 100%)`, color:C.body,
    fontFamily:"'Cormorant Garamond', Georgia, serif", fontSize:"17px", position:"relative", lineHeight:"1.5",
  });

  const addr = (shop?.address||"").split("\n").map(l=>`<div>${l}</div>`).join("");
  const rows = (inv.items||[]).map(it=>`
    <tr>
      <td style="padding:14px 4px;vertical-align:top">${it.description||""}</td>
      <td style="padding:14px 4px;text-align:left">${Number(it.qty)||0}</td>
      <td style="padding:14px 4px;text-align:left">${money(it.rate)}</td>
      <td style="padding:14px 4px;text-align:left">${money((Number(it.qty)||0)*(Number(it.rate)||0))}</td>
    </tr>`).join("");

  node.innerHTML = `
    <div style="margin-bottom:38px">
      <div style="color:#9b8164">${LOGO}</div>
      <div style="font-family:'Quicksand',sans-serif;font-weight:600;font-size:26px;color:#9b8164;letter-spacing:1px;margin-top:4px">meltiva</div>
    </div>

    <div style="display:flex;justify-content:space-between;gap:30px;margin-bottom:46px">
      <div style="max-width:48%">
        <div style="color:${C.muted};margin-bottom:6px">Bill to:</div>
        <div style="color:${C.ink};font-weight:700;font-size:20px;margin-bottom:3px">${shop?.name||inv.shopName||""}</div>
        <div style="color:${C.body}">${addr}</div>
      </div>
      <div style="text-align:right;min-width:300px">
        ${[["Payment Method:", st.bank?.paymentMethod||"Transfer"],
           ["Bank Name:", st.bank?.bankName||""],
           ["Account Number:", st.bank?.accountNumber||""],
           ["Account Name:", st.bank?.accountName||""]]
          .map(([k,v])=>`<div style="margin-bottom:7px"><span style="color:${C.muted}">${k}</span>&nbsp;&nbsp;<span style="color:${C.ink}">${v}</span></div>`).join("")}
      </div>
    </div>

    <div style="display:flex;gap:40px;margin-bottom:34px">
      ${[["Date placed", placedRange(inv)],
         ["Date Issued", fmtDate(inv.dateIssued)],
         ["Invoice No.", inv.number]]
        .map(([k,v])=>`<div><div style="color:${C.ink};font-weight:700;margin-bottom:8px;font-size:16px">${k}</div><div style="color:${C.ink};font-weight:700;font-size:18px">${v}</div></div>`).join("")}
    </div>

    <table style="width:100%;border-collapse:collapse;color:${C.body}">
      <thead>
        <tr style="background:${C.bar};color:${C.ink}">
          <th style="text-align:left;padding:11px 10px;font-weight:700;width:46%">Description</th>
          <th style="text-align:left;padding:11px 10px;font-weight:700">QTY</th>
          <th style="text-align:left;padding:11px 10px;font-weight:700">Rate (MVR)</th>
          <th style="text-align:left;padding:11px 10px;font-weight:700">Total (MVR)</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div style="display:flex;justify-content:flex-end;margin-top:90px">
      <div style="width:46%">
        <div style="display:flex;justify-content:space-between;padding:10px 4px;color:${C.body}"><span>Subtotal</span><span>${money(calc.subtotal)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:10px 4px;color:${C.body}"><span>Commission</span><span>${calc.commissionLabel}</span></div>
        <div style="border-top:1.5px solid ${C.line};margin:6px 0"></div>
        <div style="display:flex;justify-content:space-between;padding:8px 4px;color:${C.ink};font-weight:700;font-size:19px"><span>TOTAL</span><span>MVR ${money(calc.total)}</span></div>
      </div>
    </div>

    <div style="position:absolute;left:60px;right:60px;bottom:46px;text-align:right;color:${C.muted}">${st.invoiceTerms||""}</div>
  `;
  return node;
}

function loadScript(src){
  return new Promise((res,rej)=>{
    if([...document.scripts].some(s=>s.src===src)) return res();
    const s=document.createElement("script"); s.src=src; s.onload=()=>res(); s.onerror=()=>rej(new Error("load "+src)); document.head.append(s);
  });
}
let libsP = null;
function loadPdfLibs(){
  if(!libsP) libsP = (async()=>{
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  })();
  return libsP;
}

export function invoiceFilename(number){ return String(number||"invoice").replace(/[\/\\:*?"<>|]+/g,"-") + ".pdf"; }

// Render node -> PDF and download
export async function exportInvoicePDF(inv){
  await loadPdfLibs();
  if(document.fonts && document.fonts.ready) { try{ await document.fonts.ready; }catch(e){} }
  const node = buildInvoiceNode(inv);
  Object.assign(node.style, { position:"fixed", left:"-10000px", top:"0", zIndex:"-1" });
  document.body.append(node);
  try{
    const canvas = await window.html2canvas(node, { scale:2, backgroundColor:"#efe9df", useCORS:true, logging:false });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit:"pt", format:"a4" });
    const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
    pdf.addImage(canvas.toDataURL("image/jpeg",0.95), "JPEG", 0, 0, pw, ph, undefined, "FAST");
    pdf.save(invoiceFilename(inv.number));
  } finally {
    node.remove();
  }
}
