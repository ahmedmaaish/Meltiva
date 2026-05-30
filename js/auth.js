// ── Meltiva auth gate ───────────────────────────────────────────────────────
// Browser-side gate for a single user. (Real auth comes with Firebase later.)
import { CONFIG } from "./config.js";
import { el, icon } from "./utils.js";

const SESSION_KEY = "meltiva_session";

async function sha256(text){
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,"0")).join("");
}

export const auth = {
  isAuthed(){ return sessionStorage.getItem(SESSION_KEY) === "1"; },
  logout(){ sessionStorage.removeItem(SESSION_KEY); location.hash = ""; location.reload(); },

  async check(username, password){
    const hash = await sha256(`${username.trim()}::${password}`);
    return username.trim().toLowerCase() === CONFIG.username.toLowerCase() && hash === CONFIG.passwordHash;
  },

  renderLogin(mount, onSuccess){
    mount.removeAttribute("aria-busy");
    const wrap = el("div.login-wrap");
    wrap.innerHTML = `
      <div class="login-card">
        <svg class="login-logo" viewBox="0 0 100 108" fill="none" stroke="currentColor" stroke-width="4.6"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M50 6 L86 26 Q90 28 90 33 L90 71 Q90 76 86 78 L54 96 Q50 98 46 96 L14 78 Q10 76 10 71 L10 33 Q10 28 14 26 Z"/>
          <path d="M30 60 Q30 44 39 44 Q47 44 47 58 Q47 50 53 50 Q59 50 59 60"/>
          <path d="M44.5 56 Q44.5 74 44.5 86 Q44.5 92 49 92 Q53.5 92 53.5 86 L53.5 62"/>
        </svg>
        <div class="login-word">meltiva</div>
        <div class="login-sub">Business Hub — please sign in</div>
        <form id="loginForm" autocomplete="on">
          <div class="err" id="loginErr">${icon("error")}<span>Incorrect username or password.</span></div>
          <label class="field">Username
            <div class="input-icon">${icon("person")}<input type="text" id="u" autocomplete="username" required></div>
          </label>
          <label class="field">Password
            <div class="input-icon">${icon("lock")}<input type="password" id="p" autocomplete="current-password" required></div>
          </label>
          <button class="btn btn-primary btn-block" type="submit" style="margin-top:6px">${icon("login")} Sign in</button>
        </form>
      </div>`;
    mount.replaceChildren(wrap);

    const form = wrap.querySelector("#loginForm");
    const err = wrap.querySelector("#loginErr");
    form.querySelector("#u").focus();
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = form.querySelector("button");
      btn.disabled = true; err.classList.remove("show");
      const ok = await this.check(form.querySelector("#u").value, form.querySelector("#p").value);
      if(ok){ sessionStorage.setItem(SESSION_KEY, "1"); onSuccess(); }
      else { err.classList.add("show"); btn.disabled = false; form.querySelector("#p").select(); }
    });
  },
};
