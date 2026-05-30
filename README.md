# Meltiva · Business Hub

A private, branded web app to run the Meltiva baking business — expenses, income,
performance dashboard, invoice generation (PDF), batch tracking, and a secure recipe vault.

Built as a **no-build static site** (plain HTML/CSS/ES modules) so it runs free on GitHub Pages.
Charts via Chart.js; invoice PDFs via html2canvas + jsPDF (loaded from CDN on demand).

## Features
- **Login** — username + password gate (`meltiva` / hashed; the password is never stored in source).
- **Dashboard** — KPIs (income, expenses, net profit, units sold, margin) + charts + 6 exportable CSV reports.
- **Expenses** — add/edit/delete, supplier & category management, filters, CSV export.
- **Income** — `(quantity − remaining) × rate` logic, per-shop billing basis & commission config, statuses.
- **Invoices** — replicates the Meltiva invoice, auto-numbers per shop (WG/009, UB/022 …),
  per-shop commission display (net “—” or deducted), downloads as PDF named after the invoice number.
- **Batch Log** — batches placed / expired per shop, expiry rate, for any shop.
- **Recipes** — private vault with per-tray ingredient quantities.
- **Settings** — bank/invoice details, shops & commissions, suppliers, categories, backup/restore/reset.

## Data
- For now data is saved in your **browser** (localStorage). Use **Settings → Download backup** often.
- `meltiva-backup.json` holds your real imported data (from the Excel sheet). It is **git-ignored** —
  keep it private. After deploying, sign in and use **Settings → Restore backup** to load it on your device.
- Cloud sync (Firebase) is the planned next step so data follows you across devices, kept private behind auth.

## Run locally
```
python -m http.server 5577 --directory .
# open http://127.0.0.1:5577
```

## Deploy (GitHub Pages)
1. Push this folder to `github.com/ahmedmaaish/Meltiva`.
2. Repo **Settings → Pages → Build and deployment → Deploy from a branch → `main` / root**.
3. Site goes live at `https://ahmedmaaish.github.io/Meltiva/`.

> Free GitHub Pages serves from a **public** repo. Do **not** commit `meltiva-backup.json` or the Excel file —
> they contain your financial data. The committed `seed-data.js` should be the config-only version for a public site.
