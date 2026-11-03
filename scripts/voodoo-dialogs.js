/**
 * Axecleft's VooDoo — D35E's roll windows on a phone.
 *
 * D35E asks for roll options (situational bonus, Take 10/20, optional feats, roll mode) in classic Foundry dialogs.
 * On the phone those are opened out of sight: a tap presses the dialog's default button at once; a long-press shows the
 * dialog's own fields as a phone-sized panel, and the button the player picks is pressed in the real dialog. Whatever
 * D35E does with its dialog (and any field a later D35E version adds) keeps working, because the dialog itself does it.
 *
 * Any other window D35E or Foundry opens on the phone (a confirmation, a slot choice) is raised above the VooDoo window
 * and made phone-width.
 */
export class DialogBridge {
  constructor(win) {
    this.win = win;
    this.pending = null;
    const onRender = (app, html) => this.onRender(app, html);
    Hooks.on("renderDialog", onRender);
    Hooks.on("renderApplication", (app, html) => { if (!(app instanceof ((typeof Dialog !== "undefined" ? Dialog : globalThis.Dialog) ?? class {}))) this.raise(this.rootOf(app, html)); });
    Hooks.on("renderApplicationV2", (app) => { if (app.element && !app.element.closest?.("#ax-voodoo")) this.raise(app.element); });
  }

  rootOf(app, html) {
    const el = app?.element?.[0] ?? app?.element ?? html?.[0] ?? html;
    return el?.closest?.(".app, .application") ?? el;
  }
  /** A window the phone should see: above the VooDoo window, the width of the screen. */
  raise(el) {
    if (!el?.style || el.classList.contains("axs-proxied")) return;
    if (el.id === "ax-voodoo" || el.closest?.("#ui-left, #ui-right, #ui-top, #ui-bottom, #ui-middle, #sidebar, #hotbar, #players, #navigation, #controls")) return;
    el.classList.add("axs-raised");
  }

  /**
   * Run a D35E action that may open a roll dialog. mode "quick": its default button is pressed; "options": its fields are
   * shown on the phone first. Returns what the action returns.
   */
  run(mode, action, title = "") {
    clearTimeout(this.timer);
    this.pending = { mode, title };
    this.timer = setTimeout(() => { this.pending = null; }, 8000); // the action opened no dialog
    let out;
    try { out = action(); } catch (err) { this.pending = null; throw err; }
    // Some D35E rolls return before their dialog has finished drawing: keep watching a moment longer
    const mine = this.pending;
    return Promise.resolve(out).finally(() => {
      setTimeout(() => { if (this.pending === mine) { clearTimeout(this.timer); this.pending = null; } }, 1500);
    });
  }

  onRender(app, html) {
    const p = this.pending;
    const root = this.rootOf(app, html);
    if (!p || !root || root.dataset.axsSeen) { this.raise(root); return; }
    root.dataset.axsSeen = "1";
    this.pending = null;
    clearTimeout(this.timer);
    root.classList.add("axs-proxied");
    if (p.mode === "quick") {
      const btn = this.defaultButton(app, root);
      if (btn) setTimeout(() => btn.click(), 0);
      else root.classList.remove("axs-proxied"); // nothing to press: let the player see it
      return;
    }
    this.showOptions(app, root, p.title || root.querySelector(".window-title")?.textContent || "");
  }

  buttons(root) {
    return [...root.querySelectorAll(".dialog-buttons button, footer button[data-action], .form-footer button")].filter((b) => !b.disabled);
  }
  defaultButton(app, root) {
    const key = app?.data?.default;
    return (key && root.querySelector(`.dialog-buttons button[data-button="${key}"]`)) || root.querySelector(".dialog-buttons button.default") || this.buttons(root)[0] || null;
  }

  /** The label a dialog shows for a field. */
  labelFor(el, root) {
    if (el.id) { const l = root.querySelector(`label[for="${CSS.escape(el.id)}"]`); if (l) return l.textContent; }
    const wrap = el.closest("label");
    if (wrap) return wrap.textContent;
    const group = el.closest(".form-group, .flexrow, tr, li");
    const l = group?.querySelector("label, .label, th, strong");
    if (l && !l.contains(el)) return l.textContent;
    return el.name ?? el.dataset?.featOptional ?? "";
  }

  /** The dialog's fields and buttons on a phone-sized panel; the chosen button is pressed in the real dialog. */
  showOptions(app, root, title) {
    const w = this.win, esc = w.esc;
    const fields = [...root.querySelectorAll("input, select, textarea")].filter((el) => el.type !== "hidden" && el.type !== "submit" && el.type !== "button" && !el.disabled);
    const rows = fields.map((el, i) => {
      const label = esc(this.labelFor(el, root).replace(/\s+/g, " ").trim());
      if (el.type === "checkbox") return `<label class="axs-opt axs-opt-check"><input type="checkbox" data-idx="${i}"${el.checked ? " checked" : ""}><span>${label}</span></label>`;
      if (el.type === "radio") return `<label class="axs-opt axs-opt-check"><input type="radio" name="axs-r-${esc(el.name)}" data-idx="${i}"${el.checked ? " checked" : ""}><span>${label}</span></label>`;
      if (el.tagName === "SELECT") return `<label class="axs-opt"><span>${label}</span><select data-idx="${i}">${[...el.options].map((o) => `<option value="${esc(o.value)}"${o.selected ? " selected" : ""}>${esc(o.textContent)}</option>`).join("")}</select></label>`;
      const numeric = el.type === "number" || /bonus|mod|range|level|amount|count/i.test(el.name ?? "");
      return `<label class="axs-opt"><span>${label}</span><input type="text" data-idx="${i}" value="${esc(el.value)}" ${numeric ? 'inputmode="decimal" enterkeyhint="done"' : 'enterkeyhint="done"'} autocomplete="off" autocapitalize="off" spellcheck="false">${numeric ? `<span class="axs-steps"><button type="button" data-step="-1" data-for="${i}">−</button><button type="button" data-step="1" data-for="${i}">+</button></span>` : ""}</label>`;
    }).join("");
    const btns = this.buttons(root).map((b, i) => `<button type="button" class="axs-opt-btn${b.classList.contains("default") ? " default" : ""}" data-btn="${i}">${esc(b.textContent.trim() || w.t("Roll"))}</button>`).join("");
    const sheet = w.openSheet(`<div class="axs-sheet-head"><span>${esc(title)}</span><button type="button" class="axs-icon" data-action="close-sheet" title="${w.H("Close")}"><i class="fas fa-xmark"></i></button></div>
      <form class="axs-opts" onsubmit="return false">${rows || `<p class="axs-hint">${w.H("No options for this roll.")}</p>`}</form>
      <div class="axs-opt-btns">${btns}</div>`, { onClose: () => { if (!done) { try { app.close(); } catch (e) { /* gone */ } } } });
    let done = false;
    sheet.addEventListener("click", (ev) => {
      const step = ev.target.closest("[data-step]");
      if (step) {
        const inp = sheet.querySelector(`input[data-idx="${step.dataset.for}"]`);
        const n = (Number(String(inp.value).replace(",", ".")) || 0) + Number(step.dataset.step);
        inp.value = String(n);
        return;
      }
      const b = ev.target.closest("[data-btn]");
      if (!b) return;
      // Copy the phone's values into the real dialog, then press its button
      for (const inp of sheet.querySelectorAll("[data-idx]")) {
        const el = fields[Number(inp.dataset.idx)];
        if (!el) continue;
        if (el.type === "checkbox" || el.type === "radio") el.checked = inp.checked;
        else el.value = inp.value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const real = this.buttons(root)[Number(b.dataset.btn)];
      done = true;
      w.closeSheet();
      real?.click();
    });
  }
}
