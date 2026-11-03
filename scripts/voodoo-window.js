/**
 * Axecleft's VooDoo — the full-screen window a mobile account opens into.
 *
 * Not a Foundry window: one fixed element over the whole screen (the map is off on mobile accounts), so it fills a phone
 * the same way on every Foundry version. Bottom bar: Character, Chat, Combat. Character has a character switcher and a
 * tab strip that scrolls sideways (swipe the content to move between tabs).
 *
 * Everything a player does goes through D35E's own actions, as clicking the PC sheet does: tap to roll or use (D35E's
 * roll window is pressed for you), long-press for D35E's roll options (see voodoo-dialogs.js). The lists come from
 * D35E's own sheet preparation, so the phone shows what the PC sheet shows.
 */
import { DialogBridge } from "./voodoo-dialogs.js";
import { MapView } from "./voodoo-map.js";
import { startPhoneTour } from "./voodoo-tours.js";

const TABS = [
  ["stats", /*t*/"Stats", "fas fa-chart-simple"], ["saves", /*t*/"Saves", "fas fa-shield-halved"], ["skills", /*t*/"Skills", "fas fa-list-check"],
  ["attacks", /*t*/"Attacks", "fas fa-khanda"], ["spells", /*t*/"Spells", "fas fa-wand-sparkles"], ["inventory", /*t*/"Inventory", "fas fa-sack"],
  ["feats", /*t*/"Feats & Features", "fas fa-star"], ["buffs", /*t*/"Buffs & Conditions", "fas fa-bolt"], ["notes", /*t*/"Notes", "fas fa-feather"],
];
const VIEWS = [["character", /*t*/"Character", "fas fa-user"], ["party", /*t*/"Party", "fas fa-users"], ["chat", /*t*/"Chat", "fas fa-comments"], ["combat", /*t*/"Combat", "fas fa-swords"]];
const MAP_VIEW = ["map", /*t*/"Map", "fas fa-map-location-dot"];
const ABILITIES = [["str", /*t*/"STR"], ["dex", /*t*/"DEX"], ["con", /*t*/"CON"], ["int", /*t*/"INT"], ["wis", /*t*/"WIS"], ["cha", /*t*/"CHA"]];
const SAVES = [["fort", /*t*/"Fortitude"], ["ref", /*t*/"Reflex"], ["will", /*t*/"Will"]];
const FILTERS = [["all", /*t*/"All"], ["rolls", /*t*/"Rolls"], ["damage", /*t*/"Damage/Healing"], ["whispers", /*t*/"Whispers"]];
/** D35E chat cards that are about damage or healing (flags.D35E.template). */
const DAMAGE_TEMPLATES = /damage-description|fastheal|dot-roll/i;
const DAMAGE_TEXT = /\b(damage|healing|heal(?:s|ed)?|dégâts|soins?)\b/i;
const LONG_PRESS = 500; // ms
const CHAT_MAX = 60;
const get = (o, p) => p.split(".").reduce((x, k) => x?.[k], o);
const num = (v) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
const signed = (v) => (num(v) === null ? "—" : `${Number(v) >= 0 ? "+" : ""}${Number(v)}`);
const OWNER = () => CONST.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
const enrich = async (html, rollData) => {
  const TE = foundry.applications?.ux?.TextEditor?.implementation ?? foundry.applications?.ux?.TextEditor ?? (typeof TextEditor !== "undefined" ? TextEditor : globalThis.TextEditor);
  try { return await TE.enrichHTML(String(html ?? ""), { rollData, secrets: true, async: true }); } catch (e) { return String(html ?? ""); }
};
/** Notes as plain text (paragraphs and line breaks kept) and back. */
const htmlToText = (html) => {
  const d = document.createElement("div");
  d.innerHTML = String(html ?? "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n").replace(/<li[^>]*>/gi, "• ");
  return d.textContent.replace(/\n{3,}/g, "\n\n").trim();
};
const RICH = /<(?!\/?(p|br|div|span)\b)[a-z]/i; // formatting beyond plain paragraphs

/** A Hoard Editor chest (not a character). Read from the flags directly: Foundry v14's getFlag throws when that module is off. */
const isHoard = (a) => !!a?.flags?.["axeclefts-hoards"]?.hoard;

export class VooDooWindow {
  constructor({ MOD, t, H, esc, map = false, setMap = null }) {
    Object.assign(this, { MOD, t, H, esc, mapOn: !!map, setMap });
    this.views = this.mapOn ? [...VIEWS, MAP_VIEW] : VIEWS;
    this.view = this.recall("view", "character");
    if (!this.views.some(([k]) => k === this.view)) this.view = "character";
    this.tab = this.recall("tab", "stats");
    this.filter = this.recall("filter", "all");
    this.showAllSkills = this.recall("allSkills", "0") === "1";
    this.wake = null;
    this.offline = false;
    this.unread = 0;
    this.data = null;     // D35E's prepared sheet data for the shown character
    this.dataFor = null;
    this.editingNotes = false;
    // A GM's phone (an Assistant GM mobile account): creatures and NPCs are picked from the combat, the scene or a search
    this.gm = !!game.user?.isGM;
    this.pickUuid = this.gm ? this.recall("pickUuid", "") : "";
  }

  /* ---------- little helpers ---------- */
  /** This phone's choices (tab, view, picked creature, map eye…), kept per account: two accounts on one phone don't mix. */
  recall(k, d) { try { return localStorage.getItem(`${this.MOD}.${game.user?.id}.${k}`) ?? d; } catch (e) { return d; } }
  remember(k, v) { try { localStorage.setItem(`${this.MOD}.${game.user?.id}.${k}`, v); } catch (e) { /* private mode */ } }
  /** The characters this account can play: actors it owns (hoards and other loot containers left out). */
  characters() {
    return [...(game.actors ?? [])]
      .filter((a) => a.testUserPermission?.(game.user, OWNER()) && ["character", "npc"].includes(a.type)
        && a.flags?.core?.sheetClass !== "D35E.ActorSheetPFNPCLoot" && !isHoard(a))
      .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "character" ? -1 : 1));
  }
  get actor() {
    if (this.gm) {
      // The creature the GM picked: a token (its own actor, unlinked ones too) or a world actor
      let d = null;
      try { d = this.pickUuid ? fromUuidSync(this.pickUuid) : null; } catch (e) { d = null; }
      const a = d?.documentName === "Token" ? d.actor : d?.documentName === "Actor" ? d : null;
      return a ?? null; // nothing picked yet: the window says how to pick one
    }
    const list = this.characters();
    const mine = game.user.character;
    return (mine && list.find((a) => a.id === mine.id)) ?? list[0] ?? null;
  }
  toast(text, kind = "info") {
    const box = this.el?.querySelector(".axs-toasts");
    if (!box || !text) return;
    const d = document.createElement("div");
    d.className = `axs-toast ${kind}`;
    d.textContent = text;
    box.append(d);
    setTimeout(() => d.remove(), 4000);
  }
  /** A press for D35E: a click-like event with no modifier keys (D35E reads shiftKey and the like). */
  get press() { return new MouseEvent("click", { bubbles: true, cancelable: true }); }
  /** Run an action, showing any error instead of failing silently. */
  async act(fn) { try { return await fn(); } catch (err) { console.error(`${this.MOD} |`, err); this.toast(err?.message ?? String(err), "error"); } }

  /* ---------- building the window ---------- */
  mount() {
    document.body.classList.add("ax-voodoo-on");
    this.viewport();
    const el = document.createElement("div");
    el.id = "ax-voodoo";
    el.innerHTML = `
      <header class="axs-top">
        <button type="button" class="axs-who" data-action="pick"></button>
        <button type="button" class="axs-icon" data-action="menu" title="${this.H("Menu: tools, journal and items, macros")}"><i class="fas fa-bars"></i></button>
        <button type="button" class="axs-icon" data-action="wake" title="${this.H("Keep the screen on")}"><i class="fas fa-mobile-screen"></i></button>
        <button type="button" class="axs-icon" data-action="settings" title="${this.H("Settings")}"><i class="fas fa-gear"></i></button>
      </header>
      <div class="axs-banner" hidden><i class="fas fa-wifi"></i> <span></span></div>
      <main class="axs-main">
        <section class="axs-view" data-view="character">
          <nav class="axs-tabs" role="tablist">${TABS.map(([k, l, i]) => `<button type="button" role="tab" data-tab="${k}"><i class="${i}"></i><span>${this.H(l)}</span></button>`).join("")}</nav>
          <div class="axs-content" data-swipe></div>
        </section>
        <section class="axs-view" data-view="chat">
          <nav class="axs-tabs axs-filters">${FILTERS.map(([k, l]) => `<button type="button" data-filter="${k}"><span>${this.H(l)}</span></button>`).join("")}</nav>
          <div class="axs-content axs-chat-log"></div>
          <form class="axs-send" onsubmit="return false">
            <textarea name="msg" rows="1" enterkeyhint="send" placeholder="${this.H("Message, /roll 1d20, /w GM …")}" autocomplete="off"></textarea>
            <button type="submit" class="axs-icon" title="${this.H("Send")}"><i class="fas fa-paper-plane"></i></button>
          </form>
        </section>
        <section class="axs-view" data-view="party"><div class="axs-content"></div></section>
        <section class="axs-view" data-view="combat"><div class="axs-content"></div></section>
        ${this.mapOn ? '<section class="axs-view axs-map" data-view="map"></section>' : ""}
      </main>
      <nav class="axs-bottom" style="grid-template-columns: repeat(${this.views.length}, 1fr)">${this.views.map(([k, l, i]) => `<button type="button" data-view="${k}"><i class="${i}"></i><span>${this.H(l)}</span><b class="axs-badge" hidden></b></button>`).join("")}</nav>
      <div class="axs-sheet" hidden></div>
      <div class="axs-toasts"></div>`;
    document.body.append(el);
    this.el = el;
    this.bridge = new DialogBridge(this);
    if (this.mapOn) {
      this.map = new MapView(this);
      // The map draws only while the Map view is showing (battery); targets made elsewhere show under it
      Hooks.on("canvasReady", () => { this.map.shown(this.view === "map"); });
      Hooks.on("targetToken", (user) => { if (user?.id === game.user.id && this.view === "map") this.map.renderFoot(); });
      if (globalThis.canvas?.ready) this.map.shown(this.view === "map");
    }
    this.wire();
    this.render();
    this.watchConnection();
    this.watchKeyboard();
    if (this.recall("wake", "0") === "1") this.setWake(true);
    // First time on this phone: where the tour is
    if (this.recall("tourHint", "0") !== "1") { this.remember("tourHint", "1"); setTimeout(() => this.toast(this.t("New here? Settings (the gear, top right) has a tour of this window.")), 1500); }
    // Keep current when the character, its items or the user change
    const again = foundry.utils.debounce(() => { this.data = null; this.render(); }, 200);
    const mine = (doc) => { const a = doc?.documentName === "Actor" ? doc : doc?.parent; return !a || a.id === this.actor?.id; };
    for (const h of ["updateActor", "createItem", "updateItem", "deleteItem", "createActiveEffect", "updateActiveEffect", "deleteActiveEffect"]) Hooks.on(h, (d) => { if (mine(d) && !this.editingNotes) again(); });
    // The Party tab follows every party member's hit points and buffs
    const party = foundry.utils.debounce(() => { if (this.view === "party") this.renderParty(); }, 200);
    for (const h of ["updateActor", "createActor", "deleteActor", "createItem", "updateItem", "deleteItem"]) Hooks.on(h, party);
    Hooks.on("updateUser", (u) => { if (u.id === game.user.id) again(); });
    // The scene line: the scene being viewed, and whether the character is on it
    const sceneAgain = foundry.utils.debounce(() => this.checkScene(), 300);
    for (const h of ["canvasReady", "updateScene", "createToken", "deleteToken", "userConnected"]) Hooks.on(h, sceneAgain);
    this.lastScene = this.viewedScene()?.id ?? null;
    setInterval(() => this.checkScene(), 5000); // a main account's view changes without a hook on this phone
    const combat = foundry.utils.debounce(() => { this.markCombat(); if (this.view === "combat") this.render(); }, 150);
    for (const h of ["createCombat", "updateCombat", "deleteCombat", "createCombatant", "updateCombatant", "deleteCombatant"]) Hooks.on(h, combat);
    Hooks.on("createChatMessage", (m) => this.onMessage(m));
    const chat = foundry.utils.debounce(() => { if (this.view === "chat") this.renderChat(); }, 200);
    for (const h of ["updateChatMessage", "deleteChatMessage"]) Hooks.on(h, chat);
  }

  /** Phone screens: the page fits the screen and shrinks when the on-screen keyboard opens (Chrome on Android). */
  viewport() {
    let m = document.querySelector('meta[name="viewport"]');
    if (!m) { m = document.createElement("meta"); m.name = "viewport"; document.head.append(m); }
    m.content = "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content";
  }

  wire() {
    const el = this.el;
    // A portrait or icon whose file is missing (art on another computer, a deleted world) shows Foundry's silhouette
    el.addEventListener("error", (ev) => {
      const img = ev.target;
      if (img?.tagName !== "IMG" || img.dataset.axsFallback) return;
      img.dataset.axsFallback = "1";
      img.src = "icons/svg/mystery-man.svg";
    }, true);
    // Long-press: options instead of a quick roll (and no browser menu)
    let timer = null, longed = false, startX = 0, startY = 0;
    el.addEventListener("pointerdown", (ev) => {
      const t = ev.target.closest("[data-roll]");
      longed = false;
      if (!t) return;
      startX = ev.clientX; startY = ev.clientY;
      t.classList.add("axs-pressing");
      timer = setTimeout(() => { longed = true; t.classList.remove("axs-pressing"); navigator.vibrate?.(20); this.doRoll(t.dataset, "options"); }, LONG_PRESS);
    });
    const cancel = () => { clearTimeout(timer); el.querySelectorAll(".axs-pressing").forEach((x) => x.classList.remove("axs-pressing")); };
    el.addEventListener("pointerup", cancel);
    el.addEventListener("pointercancel", cancel);
    el.addEventListener("pointermove", (ev) => { if (Math.abs(ev.clientX - startX) > 10 || Math.abs(ev.clientY - startY) > 10) cancel(); });
    el.addEventListener("contextmenu", (ev) => { if (ev.target.closest("[data-roll]")) ev.preventDefault(); });

    el.addEventListener("click", (ev) => {
      const r = ev.target.closest("[data-roll]");
      if (r && el.contains(r)) { if (longed) { longed = false; return; } return this.doRoll(r.dataset, "quick"); }
      const b = ev.target.closest("button, [data-action]");
      if (!b || !el.contains(b) || b.closest(".axs-opts, .axs-opt-btns")) return;
      if (b.dataset.view && b.closest(".axs-bottom")) return this.show(b.dataset.view);
      if (b.dataset.tab) return this.showTab(b.dataset.tab);
      if (b.dataset.filter) { this.filter = b.dataset.filter; this.remember("filter", this.filter); return this.renderChat(); }
      const a = b.dataset.action, id = b.dataset.id;
      const item = id ? this.actor?.items?.get(id) : null;
      switch (a) {
        case "pick": return this.openPicker();
        case "wake": return this.setWake(!this.wake);
        case "choose": return this.choose(id);
        case "choose-uuid": return this.chooseUuid(b.dataset.uuid);
        case "hp": return this.changeHp(b.dataset.dir);
        case "next-turn": return this.act(() => game.combat?.nextTurn());
        case "prev-turn": return this.act(() => game.combat?.previousTurn());
        case "start-combat": return this.act(() => game.combat?.startCombat());
        case "init-npc": return this.act(() => this.bridge.run("quick", () => game.combat?.rollNPC()));
        case "close-sheet": return this.closeSheet();
        case "reload": return window.location.reload();
        case "all-skills": this.showAllSkills = !this.showAllSkills; this.remember("allSkills", this.showAllSkills ? "1" : "0"); return this.render();
        case "info": return this.showInfo(item);
        case "equip": return this.act(() => this.equip(item));
        case "buff": return this.act(() => item.update({ "system.active": !item.system.active }));
        case "condition": return this.act(() => this.actor.update({ [`system.attributes.conditions.${b.dataset.key}`]: !get(this.actor.system, `attributes.conditions.${b.dataset.key}`) }));
        case "notes-edit": this.editingNotes = true; return this.render();
        case "notes-cancel": this.editingNotes = false; return this.render();
        case "notes-save": return this.saveNotes();
        case "init": return this.rollInitiative();
        case "end-turn": return this.act(() => game.combat?.nextTurn());
        case "member": return this.openMember(id);
        case "settings": return this.openSettings();
        case "menu": return this.openMenu();
        case "menu-tool": return this.runTool(b.dataset.key);
        case "open-shop": return this.openActorSheet(this.shopList?.[Number(b.dataset.key)]?.actor);
        case "menu-tab": return this.openSidebarTab(b.dataset.key);
        case "macro": return this.runMacro(b.dataset.id);
        case "hot-page": this.hotPage = Math.min(5, Math.max(1, (this.hotPage ?? 1) + Number(b.dataset.dir))); return this.openMenu("hotbar");
        case "map-toggle": return this.toggleMap();
        case "tour": this.closeSheet(true); return this.act(() => startPhoneTour());
      }
    });
    // Swipe the Character content left or right to move between tabs
    let sx = null, sy = null;
    const content = el.querySelector("[data-swipe]");
    content.addEventListener("touchstart", (ev) => { const p = ev.touches[0]; sx = p.clientX; sy = p.clientY; }, { passive: true });
    content.addEventListener("touchend", (ev) => {
      if (sx === null || this.editingNotes) return;
      const p = ev.changedTouches[0], dx = p.clientX - sx, dy = p.clientY - sy;
      sx = sy = null;
      if (Math.abs(dx) < 70 || Math.abs(dy) > 45) return;
      const i = TABS.findIndex(([k]) => k === this.tab);
      const next = TABS[Math.min(TABS.length - 1, Math.max(0, i + (dx < 0 ? 1 : -1)))][0];
      if (next !== this.tab) this.showTab(next);
    }, { passive: true });
    // Chat: Enter sends (Shift+Enter on a physical keyboard adds a line)
    const send = el.querySelector(".axs-send");
    const box = send.querySelector("textarea");
    send.addEventListener("submit", () => this.sendChat(box));
    box.addEventListener("keydown", (ev) => { if (ev.key === "Enter" && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); this.sendChat(box); } });
    box.addEventListener("input", () => { box.style.height = "auto"; box.style.height = `${Math.min(140, box.scrollHeight)}px`; });
    // Typing in the window never reaches Foundry's keyboard shortcuts; Escape closes the open panel
    for (const type of ["keydown", "keyup", "keypress"]) el.addEventListener(type, (ev) => {
      if (type === "keydown" && ev.key === "Escape" && !el.querySelector(".axs-sheet").hidden) this.closeSheet();
      ev.stopPropagation();
    });
  }

  /* ---------- views and tabs ---------- */
  show(view) {
    if (!this.views.some(([k]) => k === view)) view = "character";
    const was = this.view;
    this.view = view;
    this.remember("view", view);
    if (this.map && (was === "map") !== (view === "map")) this.map.shown(view === "map");
    if (view === "chat") { this.unread = 0; this.badge(); }
    this.render();
  }
  showTab(tab) {
    if (this.editingNotes && tab !== "notes") this.editingNotes = false;
    this.tab = tab;
    this.remember("tab", tab);
    this.render();
    this.el.querySelector(`.axs-view[data-view="character"] .axs-tabs [data-tab="${tab}"]`)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }

  async render() {
    const el = this.el;
    if (!el) return;
    // Only the view shown is visible, whatever happens next
    el.querySelectorAll(".axs-view").forEach((s) => { s.hidden = s.dataset.view !== this.view; });
    let actor = null;
    try { actor = this.actor; } catch (err) { console.error(`${this.MOD} | finding the character`, err); }
    el.querySelector(".axs-who").innerHTML = actor
      ? `<img src="${this.esc(actor.img)}" alt=""><span class="axs-name-box"><span class="axs-name">${this.esc(actor.name)}</span>${this.sceneLine(actor)}</span><i class="fas fa-chevron-down"></i>`
      : `<span class="axs-name-box"><span class="axs-name">${this.H("No character")}</span>${this.sceneLine(null)}</span>`;
    el.querySelectorAll(".axs-bottom [data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === this.view));
    el.querySelectorAll(".axs-view").forEach((s) => { s.hidden = s.dataset.view !== this.view; });
    el.querySelectorAll('.axs-view[data-view="character"] .axs-tabs [data-tab]').forEach((b) => { const on = b.dataset.tab === this.tab; b.classList.toggle("active", on); b.setAttribute("aria-selected", on); });
    this.markCombat();
    if (this.view === "chat") return this.renderChat();
    if (this.view === "combat") return this.renderCombat();
    if (this.view === "party") return this.renderParty();
    if (this.view === "map") return this.map?.render();
    const box = el.querySelector('.axs-view[data-view="character"] .axs-content');
    if (!actor) { box.innerHTML = this.noCharacter(); return; }
    const ticket = (this.ticket = (this.ticket ?? 0) + 1);
    const scroll = this.lastTab === this.tab ? box.scrollTop : 0;
    let html;
    try { html = await this.characterTab(actor); }
    catch (err) { console.error(`${this.MOD} | ${this.tab}`, err); html = `<div class="axs-empty"><i class="fas fa-triangle-exclamation"></i><p>${this.H("This tab couldn't be shown: {error}", { error: err.message })}</p></div>`; }
    if (ticket !== this.ticket) return; // a newer render started
    box.innerHTML = html;
    box.scrollTop = scroll;
    this.lastTab = this.tab;
  }
  noCharacter() {
    if (this.gm) return `<div class="axs-empty"><i class="fas fa-dragon"></i><p>${this.H("Choose a creature: tap the name at the top, or a combatant on the Combat tab.")}</p></div>`;
    return `<div class="axs-empty"><i class="fas fa-user-slash"></i><p>${this.H("This account has no character yet. Ask the GM to give the main account a character; the mobile account gets it automatically.")}</p></div>`;
  }

  /** D35E's own prepared sheet data (skills, attacks, spellbooks, inventory, features, buffs), read without opening the sheet. */
  async sheetData(actor) {
    if (this.data && this.dataFor === actor.id) return this.data;
    let data = null;
    try { data = await actor.sheet?.getData?.(); } catch (err) { console.warn(`${this.MOD} | D35E sheet data`, err); }
    this.data = data ?? {};
    this.dataFor = actor.id;
    return this.data;
  }

  async characterTab(actor) {
    switch (this.tab) {
      case "stats": return this.stats(actor);
      case "saves": return this.saves(actor);
      case "skills": return this.skills(actor, await this.sheetData(actor));
      case "attacks": return this.attacks(actor, await this.sheetData(actor));
      case "spells": return this.spells(actor, await this.sheetData(actor));
      case "inventory": return this.inventory(actor, await this.sheetData(actor));
      case "feats": return this.feats(actor, await this.sheetData(actor));
      case "buffs": return this.buffs(actor, await this.sheetData(actor));
      case "notes": return this.notes(actor);
    }
    return "";
  }

  /* ---------- pieces ---------- */
  box(label, value, sub = "", roll = null) {
    const r = roll ? ` data-roll="${roll.kind}"${roll.key ? ` data-key="${this.esc(roll.key)}"` : ""} role="button" tabindex="0"` : "";
    return `<div class="axs-stat${roll ? " axs-rollable" : ""}"${r}><span class="axs-label">${this.esc(label)}</span><span class="axs-value">${this.esc(value)}</span>${sub ? `<span class="axs-sub">${this.esc(sub)}</span>` : ""}</div>`;
  }
  hint(text) { return `<p class="axs-hint axs-center">${this.esc(text)}</p>`; }
  section(label, body, extra = "") { return body ? `<h3 class="axs-sec">${this.esc(label)}${extra}</h3>${body}` : ""; }
  /** One list row: tap the name to roll or use (data-roll) or read it; a toggle or info button on the right. */
  row({ name, img = null, sub = "", right = "", roll = null, id = null, info = true, dim = false }) {
    const r = roll ? ` data-roll="${roll.kind}" data-key="${this.esc(roll.key ?? "")}" data-id="${this.esc(id ?? "")}" role="button" tabindex="0"` : id ? ` data-action="info" data-id="${this.esc(id)}" role="button" tabindex="0"` : "";
    return `<div class="axs-row${dim ? " dim" : ""}">
      <div class="axs-row-main${roll ? " axs-rollable" : ""}"${r}>${img ? `<img src="${this.esc(img)}" alt="">` : ""}<div class="axs-row-text"><span class="axs-row-name">${this.esc(name)}</span>${sub ? `<span class="axs-row-sub">${this.esc(sub)}</span>` : ""}</div></div>
      ${right}${roll && id && info ? `<button type="button" class="axs-icon axs-small" data-action="info" data-id="${this.esc(id)}" title="${this.H("Details")}"><i class="fas fa-circle-info"></i></button>` : ""}</div>`;
  }
  toggle(on, action, attrs, title) {
    return `<button type="button" class="axs-toggle${on ? " on" : ""}" data-action="${action}" ${attrs} aria-pressed="${on}" title="${this.esc(title)}"><span></span></button>`;
  }

  /* ---------- Stats ---------- */
  stats(actor) {
    const s = actor.system ?? {}, at = s.attributes ?? {};
    const classes = (actor.items ?? []).filter((i) => i.type === "class").map((c) => `${c.name} ${c.system?.levels ?? ""}`.trim()).join(" / ");
    const hp = at.hp ?? {};
    const hpLine = `${num(hp.value) ?? "—"} / ${num(hp.max) ?? "—"}`;
    const extra = [num(hp.temp) ? this.t("temp {n}", { n: hp.temp }) : "", num(hp.nonlethal) ? this.t("nonlethal {n}", { n: hp.nonlethal }) : ""].filter(Boolean).join(" · ");
    const pct = num(hp.max) ? Math.max(0, Math.min(100, Math.round((Number(hp.value) / Number(hp.max)) * 100))) : 0;
    const speed = num(get(at, "speed.land.total")) ?? num(get(at, "speed.land.base"));
    return `<div class="axs-card axs-identity"><div class="axs-line1">${this.esc(classes || actor.name)}</div>
        <div class="axs-hint">${this.esc([s.details?.race ?? "", s.details?.alignment ?? ""].filter((x) => typeof x === "string" && x).join(" · "))}</div></div>
      <div class="axs-card axs-hp"><div class="axs-hp-head"><span class="axs-label">${this.H("Hit points")}</span><span class="axs-value">${this.esc(hpLine)}</span></div>
        <div class="axs-bar"><div style="width:${pct}%"></div></div>${extra ? `<div class="axs-hint">${this.esc(extra)}</div>` : ""}
        ${this.gm ? `<div class="axs-hp-edit"><input type="text" inputmode="numeric" name="hp-amount" placeholder="${this.H("Amount")}" enterkeyhint="done" autocomplete="off">
          <button type="button" data-action="hp" data-dir="damage"><i class="fas fa-heart-crack"></i> ${this.H("Damage")}</button>
          <button type="button" data-action="hp" data-dir="heal"><i class="fas fa-heart"></i> ${this.H("Heal")}</button></div>` : ""}</div>
      <div class="axs-grid">
        ${this.box(this.t("AC"), num(get(at, "ac.normal.total")) ?? "—", this.t("touch {t} · flat {f}", { t: num(get(at, "ac.touch.total")) ?? "—", f: num(get(at, "ac.flatFooted.total")) ?? "—" }))}
        ${this.box(this.t("Initiative"), signed(get(at, "init.total")), "", { kind: "initiative" })}
        ${this.box(this.t("Base attack"), signed(get(at, "bab.total")), "", { kind: "bab" })}
        ${this.box(this.t("Speed"), speed === null ? "—" : this.t("{n} ft.", { n: speed }))}
      </div>
      <div class="axs-grid axs-abilities">${ABILITIES.map(([k, l]) => {
        const a = s.abilities?.[k] ?? {};
        return this.box(this.t(l), num(a.total) ?? num(a.value) ?? "—", signed(a.mod), { kind: "ability", key: k });
      }).join("")}</div>
      ${this.hint(this.t("Tap a box to roll it."))}`;
  }

  /* ---------- Saves ---------- */
  saves(actor) {
    const st = actor.system?.attributes?.savingThrows ?? {};
    return `<div class="axs-grid axs-saves">${SAVES.map(([k, l]) => this.box(this.t(l), signed(st[k]?.total), "", { kind: "save", key: k })).join("")}</div>
      ${this.hint(this.t("Tap to roll; press and hold for D35E's roll options."))}`;
  }

  /* ---------- Skills ---------- */
  skills(actor, data) {
    const sets = data.skillsets ?? {};
    const list = (this.showAllSkills ? sets.all?.skills : sets.known?.skills) ?? actor.system?.skills ?? {};
    const rows = [];
    for (const [id, s] of Object.entries(list)) {
      if (!s) continue;
      const label = s.label ?? s.name ?? id;
      const ranks = num(s.rank) ?? num(s.points) ?? 0;
      const sub = [ranks ? this.t("{n} ranks", { n: ranks }) : "", s.rt && !ranks ? this.t("trained only") : ""].filter(Boolean).join(" · ");
      if (s.subSkills && Object.keys(s.subSkills).length) {
        for (const [sid, ss] of Object.entries(s.subSkills)) {
          if (!ss) continue;
          rows.push(this.row({ name: `${label}: ${ss.name ?? sid}`, sub: num(ss.rank) ? this.t("{n} ranks", { n: ss.rank }) : "", right: `<span class="axs-mod">${signed(ss.mod)}</span>`, roll: { kind: "skill", key: `${id}.subSkills.${sid}` }, info: false }));
        }
        continue;
      }
      rows.push(this.row({ name: label, sub, right: `<span class="axs-mod">${signed(s.mod)}</span>`, roll: { kind: "skill", key: id }, info: false, dim: s.rt && !ranks }));
    }
    return `<div class="axs-list">${rows.join("") || this.hint(this.t("No skills to show."))}</div>
      <button type="button" class="axs-wide" data-action="all-skills">${this.H(this.showAllSkills ? "Show only known skills" : "Show all skills")}</button>
      ${this.hint(this.t("Tap to roll; press and hold for Take 10, Take 20 and other options."))}`;
  }

  /* ---------- Attacks ---------- */
  attacks(actor, data) {
    const secs = data.attacks ?? {};
    const all = secs.all?.items ?? (actor.items ?? []).filter((i) => i.type === "attack");
    const full = secs.full?.items ?? (actor.items ?? []).filter((i) => i.type === "full-attack");
    const atk = (i) => this.row({ name: i.name, img: i.img, id: i.id, sub: [i.attackDescription, i.damageDescription, i.range].filter(Boolean).map((x) => String(x).replace(/<[^>]+>/g, "")).join(" · "), roll: { kind: "item" }, dim: i.disabled });
    return `${this.section(this.t("Full attacks"), full.map(atk).join(""))}
      ${this.section(this.t("Attacks"), all.map(atk).join("") || this.hint(this.t("No attacks.")))}
      ${this.hint(this.t("Tap to attack; press and hold for D35E's attack options (Power Attack, other feats, bonus)."))}`;
  }

  /* ---------- Spells ---------- */
  spells(actor, data) {
    const books = Object.entries(data.spellbookData ?? {});
    if (!books.length) return `<div class="axs-empty"><i class="fas fa-wand-sparkles"></i><p>${this.H("No spellbooks.")}</p></div>`;
    return books.map(([key, b]) => {
      const o = b.orig ?? {};
      const head = [o.class ? CONFIG.D35E?.classNames?.[o.class] ?? o.class : "", num(o.cl?.total) !== null ? this.t("caster level {n}", { n: o.cl.total }) : "", o.usePowerPoints ? this.t("power points {v} / {m}", { v: o.powerPoints ?? 0, m: get(o, "powerPointsTotal") ?? "?" }) : ""].filter(Boolean).join(" · ");
      const levels = (b.data ?? []).filter((l) => l.spells?.length).map((l) => {
        const left = o.spontaneous || l.spontaneous ? this.t("{v} / {m} left", { v: l.uses ?? 0, m: l.slots ?? 0 }) : "";
        const rows = l.spells.map((sp) => {
          const p = sp.system?.preparation ?? {};
          const atWill = p.mode === "atwill";
          const count = atWill ? this.t("at will") : o.spontaneous || o.usePowerPoints ? "" : this.t("{v} / {m} prepared", { v: p.preparedAmount ?? 0, m: p.maxAmount ?? 0 });
          const empty = !atWill && !o.spontaneous && !o.usePowerPoints && !(Number(p.preparedAmount) > 0);
          return this.row({ name: sp.name, img: sp.img, id: sp.id, sub: [sp.system?.school ? CONFIG.D35E?.spellSchools?.[sp.system.school] ?? "" : "", count].filter(Boolean).join(" · "), roll: { kind: "item" }, dim: empty });
        }).join("");
        return this.section(l.label ?? this.t("Level {n}", { n: l.level }), rows, left ? ` <small>${this.esc(left)}</small>` : "");
      }).join("");
      return `<div class="axs-card axs-book"><div class="axs-line1">${this.esc(o.name || key)}</div>${head ? `<div class="axs-hint">${this.esc(head)}</div>` : ""}</div>${levels || this.hint(this.t("No spells in this book."))}`;
    }).join("") + this.hint(this.t("Tap to cast (D35E marks the spell used); press and hold for its options."));
  }

  /* ---------- Inventory ---------- */
  inventory(actor, data) {
    const cur = actor.system?.currency ?? {};
    const coins = ["pp", "gp", "sp", "cp"].map((c) => `<div class="axs-coin"><b>${this.esc(num(cur[c]) ?? 0)}</b><span>${this.esc(CONFIG.D35E?.currencies?.[c] ?? c)}</span></div>`).join("");
    const secs = (data.inventory ?? []).map((sec) => {
      const items = (sec.items ?? []).filter((i) => i && !i._isSlotPlaceholder && i.id);
      const rows = items.map((i) => {
        const doc = actor.items.get(i.id);
        const qty = num(i.system?.quantity);
        const charges = num(i.maxCharges) ? this.t("{v} / {m} charges", { v: i.charges ?? 0, m: i.maxCharges }) : "";
        const sub = [qty !== null && qty !== 1 ? `×${qty}` : "", charges, i._slotProvider ? i._slotProvider : ""].filter(Boolean).join(" · ");
        const canEquip = sec.canEquip && doc && foundry.utils.hasProperty(doc.system, "equipped");
        const right = canEquip ? this.toggle(!!doc.system.equipped, "equip", `data-id="${i.id}"`, this.t("Equipped")) : "";
        const usable = i.hasAction && doc?.type !== "weapon";
        return this.row({ name: i.name, img: i.img, id: i.id, sub, right, roll: usable ? { kind: "item" } : null });
      }).join("");
      return this.section(sec.label ?? "", rows);
    }).join("");
    return `<div class="axs-coins">${coins}</div>${secs || this.hint(this.t("Nothing carried."))}
      ${this.hint(this.t("Tap an item to read it; usable items (potions, wands) are used with a tap. The switch equips or unequips."))}`;
  }

  /* ---------- Feats & Features ---------- */
  feats(actor, data) {
    const secs = (data.features ?? []).map((sec) => {
      const rows = (sec.items ?? []).filter((i) => i?.id).map((i) => {
        const uses = num(i.maxCharges) ? this.t("{v} / {m} uses", { v: i.charges ?? 0, m: i.maxCharges }) : "";
        const lv = i.type === "class" ? this.t("level {n}", { n: i.system?.levels ?? "?" }) : "";
        return this.row({ name: i.name, img: i.img, id: i.id, sub: [lv, uses].filter(Boolean).join(" · "), roll: i.hasAction ? { kind: "item" } : null });
      }).join("");
      return this.section(sec.label ?? "", rows);
    }).join("");
    return secs || `<div class="axs-empty"><i class="fas fa-star"></i><p>${this.H("No feats or features.")}</p></div>`;
  }

  /* ---------- Buffs & Conditions ---------- */
  buffs(actor, data) {
    const secs = Object.values(data.buffs ?? {}).map((sec) => {
      const rows = (sec.items ?? []).filter((i) => i?.id).map((i) => {
        const on = !!i.system?.active;
        const lv = num(i.system?.level) ? this.t("level {n}", { n: i.system.level }) : "";
        return this.row({ name: i.name, img: i.img, id: i.id, sub: [lv, i.timelineLeftText ?? ""].filter(Boolean).join(" · "), right: this.toggle(on, "buff", `data-id="${i.id}"`, this.t("Active")) });
      }).join("");
      return this.section(sec.label ?? "", rows);
    }).join("");
    const conds = actor.system?.attributes?.conditions ?? {};
    const labels = CONFIG.D35E?.conditions ?? {};
    const condRows = Object.keys(labels).filter((k) => k in conds).map((k) => `<div class="axs-row"><div class="axs-row-main"><div class="axs-row-text"><span class="axs-row-name">${this.esc(game.i18n?.localize?.(labels[k]) ?? labels[k])}</span></div></div>${this.toggle(!!conds[k], "condition", `data-key="${this.esc(k)}"`, this.t("Active"))}</div>`).join("");
    return `${secs || this.hint(this.t("No buffs."))}${this.section(this.t("Conditions"), condRows)}`;
  }

  /* ---------- Notes (plain text) ---------- */
  async notes(actor) {
    const html = actor.system?.details?.notes?.value ?? "";
    if (this.editingNotes) {
      return `<form class="axs-notes" onsubmit="return false">
          <textarea name="notes" rows="12" enterkeyhint="enter" autocapitalize="sentences" spellcheck="true">${this.esc(htmlToText(html))}</textarea>
          ${RICH.test(html) ? `<p class="axs-hint">${this.H("These notes have formatting (bold, lists, links). Saving from the phone keeps the text and drops the formatting.")}</p>` : ""}
          <div class="axs-pair"><button type="button" data-action="notes-cancel">${this.H("Cancel")}</button><button type="button" class="axs-primary" data-action="notes-save">${this.H("Save")}</button></div>
        </form>`;
    }
    const shown = html ? await enrich(html, actor.getRollData?.()) : "";
    return `<div class="axs-card axs-notes-view">${shown || `<p class="axs-hint">${this.H("No notes yet.")}</p>`}</div>
      <button type="button" class="axs-wide" data-action="notes-edit"><i class="fas fa-pen"></i> ${this.H("Edit notes")}</button>`;
  }
  async saveNotes() {
    const ta = this.el.querySelector(".axs-notes textarea");
    const text = String(ta?.value ?? "");
    const html = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${this.esc(p).replace(/\n/g, "<br>")}</p>`).join("");
    await this.act(async () => { await this.actor.update({ "system.details.notes.value": html }); this.toast(this.t("Notes saved.")); });
    this.editingNotes = false;
    this.render();
  }

  /* ---------- rolling and using ---------- */
  /** A tap ("quick") or a long-press ("options") on something rollable. */
  doRoll(ds, mode) {
    const actor = this.actor;
    if (!actor) return;
    const quick = mode === "quick";
    const ev = this.press;
    const B = this.bridge;
    switch (ds.roll) {
      case "ability": return this.act(() => (actor.rollAbility ?? actor.rollAbilityTest).call(actor, ds.key, { event: ev }));
      case "save": return this.act(() => B.run(mode, () => actor.rollSavingThrow(ds.key, null, null, { event: ev })));
      case "skill": return this.act(() => B.run(mode, () => actor.rollSkill(ds.key, { event: ev, skipDialog: quick })));
      case "bab": return this.act(() => actor.rollBAB({ event: ev }));
      case "initiative": return this.rollInitiative(mode);
      case "item": {
        const item = actor.items.get(ds.id);
        if (!item) return;
        // D35E takes the targets from its attack window (a hidden field), so with targets the window always opens;
        // on a tap VooDoo presses its Roll button, so it's still one tap
        const targets = game.user?.targets?.size ?? 0;
        return this.act(() => B.run(mode, () => item.use({ ev, skipDialog: quick && !targets })));
      }
    }
  }

  /** Equip or unequip, through D35E's slot handling when the sheet has it. */
  async equip(item) {
    if (!item) return;
    if (item.system.equipped) return item.update({ "system.equipped": false });
    const sheet = this.actor?.sheet;
    const slot = item.type !== "equipment" ? null : item.system?.equipmentType === "armor" ? "armor" : item.system?.equipmentType === "shield" ? "shield" : (item.system?.slot && item.system.slot !== "slotless" ? item.system.slot : null);
    if (slot && typeof sheet?._equipItemInSlot === "function") return sheet._equipItemInSlot(item, slot);
    return item.update({ "system.equipped": true });
  }

  /** An item's description in a panel, with its Use button when it has one. */
  async showInfo(item) {
    if (!item) return;
    const desc = await enrich(item.system?.description?.value ?? "", item.getRollData?.());
    const can = item.hasAction || item.isCharged || item.type === "spell";
    const sheet = this.openSheet(`<div class="axs-sheet-head"><span>${this.esc(item.name)}</span><button type="button" class="axs-icon" data-action="close-sheet" title="${this.H("Close")}"><i class="fas fa-xmark"></i></button></div>
      <div class="axs-desc">${desc || `<p class="axs-hint">${this.H("No description.")}</p>`}</div>
      ${can ? `<div class="axs-opt-btns"><button type="button" class="axs-opt-btn default" data-use="quick">${this.H(item.type === "spell" ? "Cast" : "Use")}</button><button type="button" class="axs-opt-btn" data-use="options">${this.H("Options…")}</button></div>` : ""}`);
    sheet.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-use]");
      if (!b) return;
      this.closeSheet();
      this.doRoll({ roll: "item", id: item.id }, b.dataset.use);
    });
  }

  /* ---------- panels sliding up from the bottom ---------- */
  openSheet(inner, { onClose = null } = {}) {
    const sheet = this.el.querySelector(".axs-sheet");
    this.closeSheet(true);
    sheet.innerHTML = `<div class="axs-sheet-box" role="dialog">${inner}</div>`;
    sheet.hidden = false;
    this.sheetClose = onClose;
    sheet.onclick = (ev) => { if (ev.target === sheet) this.closeSheet(); };
    return sheet.querySelector(".axs-sheet-box");
  }
  closeSheet(quiet = false) {
    const s = this.el.querySelector(".axs-sheet");
    const fn = this.sheetClose;
    this.sheetClose = null;
    s.hidden = true;
    s.innerHTML = "";
    if (!quiet) fn?.();
  }

  /* ---------- the scene ---------- */
  /**
   * The scene this phone is on. With the map: the one it views. Without the map Foundry views no scene on the phone, so
   * the scene the player's main account is viewing (where the GM pulled them), else the scene the GM has activated.
   */
  viewedScene() {
    if (globalThis.canvas?.scene) return canvas.scene;
    const mainId = game.user?.flags?.[this.MOD]?.main;
    const main = mainId ? game.users?.get(mainId) : null;
    const id = main?.active ? main.viewedScene : null;
    return (id && game.scenes?.get(id)) || game.scenes?.viewed || game.scenes?.active || null;
  }
  /** The character's tokens: on a scene, or anywhere (a GM's picked token is that token). */
  tokenOn(actor, scene) {
    if (!actor || !scene) return false;
    if (actor.isToken) return actor.token?.parent?.id === scene.id;
    return [...(scene.tokens ?? [])].some((tk) => tk.actorId === actor.id);
  }
  sceneLine(actor) {
    const sc = this.viewedScene();
    if (!sc) return `<span class="axs-scene"><i class="fas fa-map"></i> ${this.H("No scene")}</span>`;
    const name = sc.navName || sc.name;
    if (!actor) return `<span class="axs-scene"><i class="fas fa-map"></i> ${this.esc(name)}</span>`;
    if (this.tokenOn(actor, sc)) return `<span class="axs-scene"><i class="fas fa-map-pin"></i> ${this.esc(name)}</span>`;
    const elsewhere = actor.isToken ? actor.token?.parent : [...(game.scenes ?? [])].find((x) => this.tokenOn(actor, x) && (x.testUserPermission?.(game.user, "LIMITED") ?? true));
    return `<span class="axs-scene away"><i class="fas fa-map"></i> ${this.esc(name)} · ${elsewhere ? this.H("{name} is on {scene}", { name: actor.name, scene: elsewhere.navName || elsewhere.name }) : this.H("{name} isn't here", { name: actor.name })}</span>`;
  }
  /** Redraw the scene line; a change of scene is announced. */
  checkScene() {
    const sc = this.viewedScene();
    const id = sc?.id ?? null;
    if (id !== this.lastScene) {
      this.lastScene = id;
      if (sc) this.toast(this.t("Now on: {scene}", { scene: sc.navName || sc.name }));
    }
    const box = this.el?.querySelector(".axs-who .axs-scene");
    if (box) box.outerHTML = this.sceneLine(this.actor);
  }

  /* ---------- the menu: tools, sidebar, hotbar ---------- */
  /**
   * One-click buttons from the scene controls (Foundry's left-hand buttons) a player may use: Axecleft's Tools (from its
   * own list, which already knows what each user may use) and other modules' buttons. Buttons that work on the map
   * (select, measure…) are left out.
   */
  collectTools() {
    const out = [], loc = (s) => { try { return game.i18n.localize(String(s ?? "")); } catch (e) { return String(s ?? ""); } };
    const ax = globalThis.AxecleftTools;
    try {
      for (const tl of ax?.available?.() ?? []) out.push({ key: `ax:${tl.module}.${tl.name}`, title: ax.t?.(tl.title) ?? tl.title, hint: tl.hint ? ax.t?.(tl.hint) ?? tl.hint : "", icon: tl.icon, group: ax.t?.("Axecleft's Tools") ?? "Axecleft's Tools", run: () => tl.onClick() });
    } catch (err) { console.warn(`${this.MOD} | Axecleft's Tools`, err); }
    // Other modules add their buttons in getSceneControlButtons: ask them, on a blank set of groups
    const modern = (game.release?.generation ?? 11) >= 13;
    const names = modern ? ["tokens", "templates", "tiles", "drawings", "walls", "lighting", "sounds", "regions", "notes"] : ["token", "measure", "tiles", "drawings", "walls", "lighting", "sounds", "notes"];
    const controls = modern ? Object.fromEntries(names.map((n) => [n, { name: n, title: n, tools: {} }])) : names.map((n) => ({ name: n, title: n, tools: [] }));
    try { Hooks.callAll("getSceneControlButtons", controls); } catch (err) { console.warn(`${this.MOD} | scene controls`, err); }
    const groups = Array.isArray(controls) ? controls : Object.values(controls);
    for (const g of groups) {
      if (!g || g.name === "axecleft" || g.visible === false) continue;
      const tools = Array.isArray(g.tools) ? g.tools : Object.values(g.tools ?? {});
      for (const tl of tools) {
        const fn = tl?.onChange ?? tl?.onClick;
        if (!tl?.button || tl.visible === false || typeof fn !== "function") continue;
        const title = loc(tl.title ?? tl.name);
        const group = names.includes(g.name) ? "" : loc(g.title ?? g.name);
        out.push({ key: `sc:${g.name}.${tl.name}`, title, hint: "", icon: tl.icon ?? "fas fa-circle", group, run: () => fn.call(tl, new MouseEvent("click"), true) });
      }
    }
    this.tools = new Map(out.map((x) => [x.key, x]));
    return out;
  }
  /** A merchant, loot pile or party storage on Axecleft's Shop sheet (Armory, Curios, Gemstones). */
  isShop(actor) { return !!actor && (actor.flags?.core?.sheetClass === "axecleft.AxecleftShopSheet" || !!actor.flags?.world?.axecleftShop); }
  /** Open an actor's sheet over the window (raised to the phone's width like every other window). */
  openActorSheet(actor) {
    if (!actor) return;
    this.closeSheet();
    return this.act(async () => {
      if (!actor.testUserPermission?.(game.user, "LIMITED")) throw new Error(this.t("{name} isn't open to you.", { name: actor.name }));
      const sh = actor.sheet;
      if (!sh) throw new Error(this.t("{name} has no sheet to open.", { name: actor.name }));
      return sh.render?.({ force: true }) ?? sh.render(true);
    });
  }
  /** Merchants, loot and party storage the player can open: on the scene being viewed, and party storage anywhere. */
  shopsHere() {
    const seen = new Set(), out = [];
    const add = (a, where = "") => {
      if (!a || !this.isShop(a) || !a.testUserPermission?.(game.user, "LIMITED")) return;
      const key = a.uuid; if (seen.has(key)) return; seen.add(key);
      const mode = a.flags?.world?.axecleftShop?.mode ?? "merchant";
      out.push({ actor: a, key, mode, where });
    };
    const sc = this.viewedScene();
    for (const tk of sc?.tokens ?? []) if (!tk.hidden || game.user.isGM) add(tk.actor);
    for (const a of game.actors ?? []) if (a.flags?.world?.axecleftShop?.mode === "storage") add(a);
    const order = { merchant: 0, loot: 1, storage: 2 };
    return out.sort((x, y) => (order[x.mode] ?? 9) - (order[y.mode] ?? 9) || x.actor.name.localeCompare(y.actor.name));
  }
  /** The sidebar tabs a player uses on a phone (more can be added later). */
  sidebarTabs() {
    return [["journal", /*t*/"Journal", "fas fa-book-open"], ["items", /*t*/"Items", "fas fa-suitcase"], ["compendium", /*t*/"Compendiums", "fas fa-atlas"], ["tables", /*t*/"Roll Tables", "fas fa-th-list"]]
      .filter(([k]) => ui?.[k]);
  }
  openMenu(focus = "") {
    const tools = this.collectTools();
    const page = (this.hotPage ??= 1);
    let slots = [];
    try { slots = game.user.getHotbarMacros(page); } catch (e) { slots = []; }
    const head = (label, sub = "") => `<h3 class="axs-sec">${this.esc(label)}${sub ? ` <small>${this.esc(sub)}</small>` : ""}</h3>`;
    const btn = (action, key, icon, title, sub = "") => `<button type="button" class="axs-pick axs-menu-item" data-action="${action}" data-key="${this.esc(key)}"><i class="${this.esc(icon)} axs-menu-icon"></i><span>${this.esc(title)}${sub ? `<small class="axs-hint">${this.esc(sub)}</small>` : ""}</span></button>`;
    const toolsHtml = tools.length ? tools.map((x) => btn("menu-tool", x.key, x.icon, x.title, x.hint || (x.group && x.group !== this.t("Axecleft's Tools") ? x.group : ""))).join("") : `<p class="axs-hint">${this.H("No tools for players here.")}</p>`;
    const tabs = this.sidebarTabs().map(([k, l, i]) => btn("menu-tab", k, i, this.t(l))).join("");
    const MODES = { merchant: [/*t*/"Merchant", "fas fa-store"], loot: [/*t*/"Loot", "fas fa-sack-dollar"], storage: [/*t*/"Party storage", "fas fa-box-archive"] };
    this.shopList = this.shopsHere();
    const shops = this.shopList.map((x, i) => `<button type="button" class="axs-pick axs-menu-item" data-action="open-shop" data-key="${i}"><img src="${this.esc(x.actor.img)}" alt=""><span>${this.esc(x.actor.name)}<small class="axs-hint">${this.H(MODES[x.mode]?.[0] ?? "Merchant")}</small></span></button>`).join("");
    const macros = slots.filter((x) => x.macro).map((x) => `<button type="button" class="axs-pick axs-menu-item" data-action="macro" data-id="${x.macro.id}"><img src="${this.esc(x.macro.img)}" alt=""><span>${this.esc(x.macro.name)} <small class="axs-hint">${x.slot % 10 || 10}</small></span></button>`).join("");
    const box = this.openSheet(`<div class="axs-sheet-head"><span>${this.H("Menu")}</span><button type="button" class="axs-icon" data-action="close-sheet" title="${this.H("Close")}"><i class="fas fa-xmark"></i></button></div>
      ${shops ? `<div data-menu="shops">${head(this.t("Shops and loot"), this.viewedScene()?.name ?? "")}${shops}</div>` : ""}
      <div data-menu="tools">${head(this.t("Tools"))}${toolsHtml}</div>
      <div data-menu="sidebar">${head(this.t("Sidebar"))}${tabs}</div>
      <div data-menu="hotbar">${head(this.t("Hotbar"), this.t("page {n}", { n: page }))}
        <div class="axs-row axs-hot-pages"><button type="button" class="axs-icon" data-action="hot-page" data-dir="-1"${page <= 1 ? " disabled" : ""} title="${this.H("Previous page")}"><i class="fas fa-caret-left"></i></button><span class="axs-row-name" style="flex:1;text-align:center">${this.H("Page {n} of 5", { n: page })}</span><button type="button" class="axs-icon" data-action="hot-page" data-dir="1"${page >= 5 ? " disabled" : ""} title="${this.H("Next page")}"><i class="fas fa-caret-right"></i></button></div>
        ${macros || `<p class="axs-hint">${this.H("No macros on this page of your hotbar.")}</p>`}</div>`);
    if (focus) box.querySelector(`[data-menu="${focus}"]`)?.scrollIntoView({ block: "start" });
  }
  async runTool(key) {
    const tl = this.tools?.get(key);
    this.closeSheet();
    if (!tl) return;
    await this.act(() => tl.run());
  }
  async openSidebarTab(key) {
    this.closeSheet();
    const tab = ui?.[key];
    if (!tab) return;
    await this.act(async () => {
      if (typeof tab.renderPopout === "function") return tab.renderPopout();
      if (typeof tab.createPopout === "function") return tab.createPopout().render(true);
      return tab.render?.(true);
    });
  }
  async runMacro(id) {
    const m = game.macros?.get(id);
    this.closeSheet();
    if (!m) return;
    await this.act(async () => { if (m.canExecute === false) throw new Error(this.t("You can't run {name}.", { name: m.name })); return m.execute(); });
  }

  /* ---------- settings ---------- */
  /** This account's own settings: the map (targets and spell areas). */
  openSettings() {
    const on = this.mapOn;
    this.openSheet(`<div class="axs-sheet-head"><span>${this.H("Settings")}</span><button type="button" class="axs-icon" data-action="close-sheet" title="${this.H("Close")}"><i class="fas fa-xmark"></i></button></div>
      <div class="axs-row"><div class="axs-row-main"><div class="axs-row-text"><span class="axs-row-name">${this.H("Map")}</span><span class="axs-row-sub">${this.H("A Map view to target tokens and place spell areas. It uses more battery and memory; the page reloads to switch it.")}</span></div></div>${this.toggle(on, "map-toggle", "", this.t("Map"))}</div>
      ${this.rollModeRow()}
      ${game.tours?.get?.(`${this.MOD}.phone`) ? `<button type="button" class="axs-wide" data-action="tour"><i class="fas fa-person-hiking"></i> ${this.H("Take a tour of this window")}</button>` : ""}`);
    this.el.querySelector('.axs-sheet select[name="roll-mode"]')?.addEventListener("change", (ev) => this.act(async () => { await game.settings.set("core", "rollMode", ev.currentTarget.value); this.toast(this.t("Roll mode changed.")); }));
  }
  /** Who sees this phone's rolls (Foundry's own roll mode, for this device). */
  rollModeRow() {
    let cur = "publicroll";
    try { cur = game.settings.get("core", "rollMode"); } catch (e) { /* default */ }
    const modes = Object.entries(CONFIG.Dice?.rollModes ?? {}).map(([k, v]) => [k, game.i18n?.localize?.(typeof v === "string" ? v : v?.label ?? k) ?? k]);
    if (!modes.length) return "";
    return `<label class="axs-opt"><span>${this.H("Roll mode")}</span><select name="roll-mode">${modes.map(([k, l]) => `<option value="${this.esc(k)}"${k === cur ? " selected" : ""}>${this.esc(l)}</option>`).join("")}</select></label>`;
  }
  async toggleMap() {
    this.closeSheet();
    if (typeof this.setMap !== "function") return;
    await this.act(() => this.setMap(!this.mapOn)); // the account's flag; the page reloads with or without the map
  }

  /* ---------- choosing a character ---------- */
  openPicker() {
    if (this.gm) return this.openGmPicker();
    const list = this.characters();
    const cur = this.actor?.id;
    this.openSheet(`<div class="axs-sheet-head"><span>${this.H("Choose a character")}</span><button type="button" class="axs-icon" data-action="close-sheet" title="${this.H("Close")}"><i class="fas fa-xmark"></i></button></div>
      ${list.length ? list.map((a) => `<button type="button" class="axs-pick${a.id === cur ? " active" : ""}" data-action="choose" data-id="${a.id}"><img src="${this.esc(a.img)}" alt=""><span>${this.esc(a.name)}</span>${a.id === cur ? '<i class="fas fa-check"></i>' : ""}</button>`).join("")
        : `<p class="axs-hint">${this.H("No characters yet.")}</p>`}`);
  }
  /**
   * The GM's picker: the combat's combatants, the scene's tokens, the player characters, and a search of every actor.
   * Tokens are picked as tokens, so an unlinked creature is that token's own creature.
   */
  openGmPicker() {
    const esc = this.esc, seen = new Set();
    const item = (uuid, name, img, sub = "") => {
      if (!uuid || seen.has(uuid)) return "";
      seen.add(uuid);
      return `<button type="button" class="axs-pick${uuid === this.pickUuid ? " active" : ""}" data-action="choose-uuid" data-uuid="${esc(uuid)}" data-name="${esc(String(name).toLowerCase())}"><img src="${esc(img)}" alt=""><span>${esc(name)}${sub ? ` <small class="axs-hint">${esc(sub)}</small>` : ""}</span>${uuid === this.pickUuid ? '<i class="fas fa-check"></i>' : ""}</button>`;
    };
    const combat = (game.combat?.turns ?? []).map((c) => item(c.token?.uuid ?? c.actor?.uuid, c.name, c.img ?? c.token?.texture?.src ?? c.actor?.img ?? "", c.hidden ? this.t("hidden") : "")).join("");
    const scene = game.scenes?.viewed ?? game.scenes?.active ?? null;
    const tokens = [...(scene?.tokens ?? [])].filter((tk) => tk.actor && !isHoard(tk.actor))
      .sort((a, b) => a.name.localeCompare(b.name)).map((tk) => item(tk.uuid, tk.name, tk.texture?.src ?? tk.actor?.img ?? "", tk.hidden ? this.t("hidden") : "")).join("");
    const pcs = [...(game.actors ?? [])].filter((a) => a.type === "character").sort((a, b) => a.name.localeCompare(b.name)).map((a) => item(a.uuid, a.name, a.img)).join("");
    const sec = (label, body) => (body ? `<h3 class="axs-sec">${esc(label)}</h3>${body}` : "");
    const sheet = this.openSheet(`<div class="axs-sheet-head"><span>${this.H("Choose a creature")}</span><button type="button" class="axs-icon" data-action="close-sheet" title="${this.H("Close")}"><i class="fas fa-xmark"></i></button></div>
      <input type="text" class="axs-search" name="pick-search" placeholder="${this.H("Search every actor…")}" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search">
      <div class="axs-pick-found"></div>
      <div class="axs-pick-lists">${sec(this.t("Combat"), combat)}${sec(scene ? this.t("On {scene}", { scene: scene.name }) : this.t("Scene"), tokens)}${sec(this.t("Player characters"), pcs)}</div>`);
    const box = sheet.querySelector(".axs-search"), found = sheet.querySelector(".axs-pick-found"), lists = sheet.querySelector(".axs-pick-lists");
    box.addEventListener("input", () => {
      const q = box.value.trim().toLowerCase();
      lists.hidden = !!q;
      if (!q) { found.innerHTML = ""; return; }
      seen.clear();
      const hits = [...(game.actors ?? [])].filter((a) => a.name.toLowerCase().includes(q) && ["character", "npc"].includes(a.type)).slice(0, 40);
      found.innerHTML = hits.map((a) => item(a.uuid, a.name, a.img, a.type === "npc" ? "" : this.t("character"))).join("") || `<p class="axs-hint">${this.H("No actor by that name.")}</p>`;
    });
  }
  async chooseUuid(uuid) {
    this.closeSheet();
    if (!uuid) return;
    this.pickUuid = uuid;
    this.remember("pickUuid", uuid);
    this.data = null;
    this.editingNotes = false;
    if (this.view !== "character" && this.view !== "map") { this.view = "character"; this.remember("view", "character"); }
    this.render();
  }

  /** The GM's hit point change: damage takes temporary hit points first; healing stops at the maximum. */
  async changeHp(dir) {
    const actor = this.actor, box = this.el.querySelector('input[name="hp-amount"]');
    const n = Math.abs(Math.round(Number(String(box?.value ?? "").replace(",", ".")) || 0));
    if (!actor || !n) return this.toast(this.t("Type an amount first."), "warn");
    const hp = actor.system?.attributes?.hp ?? {};
    const update = {};
    if (dir !== "heal") {
      const temp = Number(hp.temp) || 0, fromTemp = Math.min(temp, n);
      if (fromTemp) update["system.attributes.hp.temp"] = temp - fromTemp;
      update["system.attributes.hp.value"] = (Number(hp.value) || 0) - (n - fromTemp);
    } else update["system.attributes.hp.value"] = Math.min(Number(hp.max) || Infinity, (Number(hp.value) || 0) + n);
    await this.act(() => actor.update(update));
    const hurt = dir !== "heal";
    this.toast(this.t(hurt ? /*t*/"{name} takes {n} damage." : /*t*/"{name} heals {n}.", { name: actor.name, n }));
  }

  /** The chosen character becomes this account's character, so chat cards show it as the speaker. */
  async choose(id) {
    this.closeSheet();
    if (!id) return;
    if (id === game.user.character?.id) return this.render();
    try { await game.user.update({ character: id }); }
    catch (err) { console.error(`${this.MOD} | choose character`, err); this.toast(this.t("Couldn't switch character: {error}", { error: err.message }), "error"); }
    this.data = null;
    this.editingNotes = false;
    this.render();
  }

  /* ---------- Chat ---------- */
  /**
   * What a message is, from D35E's own markers first: the card template it used (flags.D35E.template), its attacks'
   * damage, then the card's classes and words as a fallback (other systems' or modules' cards).
   */
  kindOf(m, node = null) {
    const src = m._source ?? {};
    const whisper = ((m.whisper ?? src.whisper) ?? []).length > 0;
    const d35e = foundry.utils.getProperty(m, "flags.D35E") ?? foundry.utils.getProperty(src, "flags.D35E") ?? {};
    const tpl = String(d35e.template ?? "");
    const attacks = d35e.chatTemplateData?.attacks ?? [];
    const content = String(m.content ?? src.content ?? "");
    // Foundry's own rolls, and D35E's roll cards (attacks, skills, saves…), which draw their dice in the card instead
    const rolls = (m.rolls ?? src.rolls ?? []).length > 0 || !!m.isRoll || /roll|skill|saving-throw|grapple|turn-undead|resistance|defenses/i.test(tpl)
      || /class="[^"]*\bdice-(roll|total|result)\b/i.test(content);
    const text = node?.textContent ?? "";
    const damage = DAMAGE_TEMPLATES.test(tpl)
      || (/attack-roll/i.test(tpl) && attacks.some((a) => a?.hasDamage || a?.hasAltDamage || Number(a?.damage?.total)))
      || /damage-roll|damage-divider|rolled-fortify-value|fastheal|data-action="applyDamage"/i.test(content)
      || DAMAGE_TEXT.test(String(m.flavor ?? src.flavor ?? ""))
      || (!!node && !!node.querySelector?.(".damage-roll, .damage-divider, [data-action='applyDamage']"))
      || (!!node && /attack-roll/i.test(tpl) && DAMAGE_TEXT.test(text));
    return { whisper, rolls, damage };
  }
  matches(m, node = null) {
    if (m.visible === false) return false;
    const k = this.kindOf(m, node);
    switch (this.filter) {
      case "rolls": return k.rolls;
      case "damage": return k.damage;
      case "whispers": return k.whisper;
      default: return true;
    }
  }
  async messageHTML(m) {
    try {
      if (typeof m.renderHTML === "function") return await m.renderHTML();
      const h = await m.getHTML();
      return h?.[0] ?? h;
    } catch (err) { const d = document.createElement("div"); d.className = "axs-msg-fallback"; d.innerHTML = m.content ?? ""; return d; }
  }
  async renderChat() {
    const log = this.el.querySelector(".axs-chat-log");
    this.el.querySelectorAll(".axs-filters [data-filter]").forEach((b) => b.classList.toggle("active", b.dataset.filter === this.filter));
    const ticket = (this.chatTicket = (this.chatTicket ?? 0) + 1);
    if (!FILTERS.some(([k]) => k === this.filter)) this.filter = "all";
    // Newest first until the list is full; each card is classified with its rendered HTML as well as its data
    const all = [...(game.messages ?? [])].filter((m) => m.visible !== false);
    const nodes = [];
    for (let i = all.length - 1; i >= 0 && nodes.length < CHAT_MAX && all.length - i <= CHAT_MAX * 6; i--) {
      const m = all[i];
      if (this.filter !== "all" && this.filter !== "damage" && !this.matches(m)) continue;
      const n = await this.messageHTML(m);
      if (n && this.matches(m, n)) nodes.unshift(n);
    }
    if (ticket !== this.chatTicket) return;
    log.replaceChildren(...nodes);
    if (!nodes.length) log.innerHTML = this.hint(this.t("No messages here yet."));
    log.scrollTop = log.scrollHeight;
  }
  async onMessage(m) {
    if (!m.visible) return;
    // My own rolls: a short result toast, wherever the player is
    const author = m.author ?? m.user;
    if (author?.id === game.user.id && (m.rolls ?? []).length && this.view !== "chat") {
      const flavor = String(m.flavor ?? "").replace(/<[^>]+>/g, "").trim();
      this.toast(`${flavor || this.t("Roll")}: ${m.rolls.map((r) => r.total).join(", ")}`);
    }
    if (this.view === "chat") {
      const log = this.el.querySelector(".axs-chat-log");
      const atEnd = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
      const n = await this.messageHTML(m);
      if (!n || !this.matches(m, n)) return;
      log.querySelector(".axs-hint")?.remove();
      log.append(n);
      while (log.children.length > CHAT_MAX) log.firstElementChild.remove();
      if (atEnd || author?.id === game.user.id) log.scrollTop = log.scrollHeight;
    } else { this.unread++; this.badge(); }
  }
  badge() {
    const b = this.el.querySelector('.axs-bottom [data-view="chat"] .axs-badge');
    if (!b) return;
    b.hidden = !this.unread;
    b.textContent = this.unread > 99 ? "99+" : String(this.unread);
  }
  async sendChat(box) {
    const text = String(box.value ?? "").trim();
    if (!text) return;
    box.value = "";
    box.style.height = "auto";
    await this.act(async () => {
      if (typeof ui.chat?.processMessage === "function") return ui.chat.processMessage(text);
      const speaker = ChatMessage.getSpeaker({ actor: this.actor });
      return ChatMessage.create({ content: this.esc(text), speaker });
    });
  }

  /* ---------- Party (D35E's Party HUD on the phone) ---------- */
  /**
   * The party: every actor marked Party Member (D35E actor settings). Marking it is the GM saying the party sees it, so
   * it's listed whatever this account's permission on it (D35E's own HUD needs Limited); hit point numbers still need
   * Observer, as in D35E's HUD.
   */
  partyMembers() {
    return [...(game.actors ?? [])].filter((a) => a.system?.isPartyMember)
      .sort((a, b) => (this.mine({ actor: a }) === this.mine({ actor: b }) ? a.name.localeCompare(b.name) : this.mine({ actor: a }) ? -1 : 1));
  }
  renderParty() {
    const box = this.el.querySelector('.axs-view[data-view="party"] .axs-content');
    const list = this.partyMembers();
    if (!list.length) { box.innerHTML = `<div class="axs-empty"><i class="fas fa-users"></i><p>${this.H("No party members. The GM marks characters as Party Member in their D35E actor settings.")}</p></div>`; return; }
    let tokenImg = false;
    try { tokenImg = !!game.settings.get("D35E", "showPartyHudTokenImage"); } catch (e) { /* older D35E */ }
    const OBSERVER = CONST.DOCUMENT_OWNERSHIP_LEVELS?.OBSERVER ?? 2;
    const cur = this.actor?.id;
    box.innerHTML = `<div class="axs-party">${list.map((a) => {
      const hp = a.system?.attributes?.hp ?? {};
      const v = Number(hp.value) || 0, max = Number(hp.max) || 0;
      const see = a.testUserPermission(game.user, OBSERVER);
      const dead = v <= -10, dying = !dead && v < 0;
      const pct = dead || dying || !max ? 0 : Math.max(0, Math.min(100, Math.round((v / max) * 100)));
      const life = dead ? this.t("Dead") : dying ? this.t("Dying") : see ? `${v} / ${max}${Number(hp.temp) ? ` (+${hp.temp})` : ""}` : "";
      const tone = dead || dying ? "down" : pct <= 25 ? "low" : pct <= 50 ? "mid" : "";
      const buffs = (a.items ?? []).filter((i) => i.type === "buff" && i.system?.active).sort((x, y) => (x.sort ?? 0) - (y.sort ?? 0));
      const img = tokenImg ? (a.prototypeToken?.texture?.src || a.img) : a.img;
      return `<button type="button" class="axs-member${a.id === cur ? " current" : ""}${dead || dying ? " down" : ""}" data-action="member" data-id="${a.id}">
          <img class="axs-member-img" src="${this.esc(img)}" alt="">
          <span class="axs-member-body">
            <span class="axs-member-name">${this.esc(a.name)}</span>
            <span class="axs-hpbar ${tone}"><span style="width:${pct}%"></span><b>${this.esc(life)}</b></span>
            ${buffs.length ? `<span class="axs-buffs">${buffs.map((b) => `<img src="${this.esc(b.img)}" alt="${this.esc(b.name)}" title="${this.esc(b.name)}">`).join("")}</span>` : ""}
          </span></button>`;
    }).join("")}</div>${this.hint(this.t("Tap a party member: your own characters open on the Character tab; others show their active buffs."))}`;
  }
  /** Tap a party member: play them if this account owns them, else list what's on them. */
  openMember(id) {
    const a = game.actors?.get(id);
    if (!a) return;
    if (a.testUserPermission(game.user, OWNER())) { this.view = "character"; this.remember("view", "character"); return this.choose(id); }
    const buffs = (a.items ?? []).filter((i) => i.type === "buff" && i.system?.active);
    this.openSheet(`<div class="axs-sheet-head"><span>${this.esc(a.name)}</span><button type="button" class="axs-icon" data-action="close-sheet" title="${this.H("Close")}"><i class="fas fa-xmark"></i></button></div>
      ${buffs.length ? buffs.map((b) => `<div class="axs-row"><div class="axs-row-main"><img src="${this.esc(b.img)}" alt=""><div class="axs-row-text"><span class="axs-row-name">${this.esc(b.name)}</span></div></div></div>`).join("") : `<p class="axs-hint">${this.H("No active buffs.")}</p>`}`);
  }

  /* ---------- Combat ---------- */
  mine(c) { return !!(c?.actor?.testUserPermission?.(game.user, OWNER()) || c?.isOwner); }
  renderCombat() {
    const box = this.el.querySelector('.axs-view[data-view="combat"] .axs-content');
    const c = game.combat;
    if (!c) { box.innerHTML = `<div class="axs-empty"><i class="fas fa-swords"></i><p>${this.H("No combat right now.")}</p></div>`; return; }
    const turns = (c.turns ?? []).filter((x) => !x.hidden || this.mine(x));
    const cur = c.combatant;
    const rows = turns.map((x) => `<div class="axs-row axs-combatant${x.id === cur?.id ? " current" : ""}${this.mine(x) ? " mine" : ""}${x.isDefeated ? " dim" : ""}">
        <div class="axs-row-main"${this.gm ? ` data-action="choose-uuid" data-uuid="${this.esc(x.token?.uuid ?? x.actor?.uuid ?? "")}" role="button" tabindex="0"` : ""}><img src="${this.esc(x.img ?? x.token?.texture?.src ?? x.actor?.img ?? "")}" alt=""><div class="axs-row-text"><span class="axs-row-name">${this.esc(x.name)}</span>${x.id === cur?.id ? `<span class="axs-row-sub">${this.H("Current turn")}</span>` : ""}</div></div>
        <span class="axs-init">${x.initiative === null || x.initiative === undefined ? "—" : this.esc(x.initiative)}</span></div>`).join("");
    if (this.gm) {
      const npcs = (c.combatants ?? []).filter((x) => !x.hasPlayerOwner && (x.initiative === null || x.initiative === undefined));
      box.innerHTML = `<div class="axs-card axs-round"><span>${c.started ? this.H("Round {n}", { n: c.round }) : this.H("Combat hasn't started yet.")}</span></div>
        <div class="axs-list">${rows || this.hint(this.t("No combatants yet."))}</div>
        <div class="axs-pair">
          <button type="button" class="${npcs.length ? "axs-primary" : ""}" data-action="init-npc" ${npcs.length ? "" : "disabled"}><i class="fas fa-dice-d20"></i> ${this.H("Roll NPCs")}</button>
          ${c.started ? `<button type="button" class="axs-primary" data-action="next-turn"><i class="fas fa-forward"></i> ${this.H("Next turn")}</button>` : `<button type="button" class="axs-primary" data-action="start-combat"><i class="fas fa-play"></i> ${this.H("Begin combat")}</button>`}
        </div>
        ${c.started ? `<div class="axs-pair"><button type="button" data-action="prev-turn"><i class="fas fa-backward"></i> ${this.H("Previous turn")}</button><span></span></div>` : ""}
        ${this.hint(this.t("Tap a combatant to play it."))}`;
      return;
    }
    const needInit = (c.combatants ?? []).filter((x) => this.mine(x) && (x.initiative === null || x.initiative === undefined));
    const myTurn = c.started && this.mine(cur);
    box.innerHTML = `<div class="axs-card axs-round"><span>${c.started ? this.H("Round {n}", { n: c.round }) : this.H("Combat hasn't started yet.")}</span>${myTurn ? `<b class="axs-yourturn">${this.H("Your turn!")}</b>` : ""}</div>
      <div class="axs-list">${rows || this.hint(this.t("No combatants yet."))}</div>
      <div class="axs-pair">
        <button type="button" class="${needInit.length ? "axs-primary" : ""}" data-action="init" ${needInit.length ? "" : "disabled"}><i class="fas fa-dice-d20"></i> ${this.H("Roll initiative")}</button>
        <button type="button" class="${myTurn ? "axs-primary" : ""}" data-action="end-turn" ${myTurn ? "" : "disabled"}><i class="fas fa-forward"></i> ${this.H("End turn")}</button>
      </div>`;
  }
  /** Roll initiative for my combatants that haven't rolled (D35E's initiative window pressed for me). */
  async rollInitiative(mode = "quick") {
    const c = game.combat;
    if (!c) return this.toast(this.t("No combat right now."), "warn");
    const ids = (c.combatants ?? []).filter((x) => this.mine(x) && (x.initiative === null || x.initiative === undefined)).map((x) => x.id);
    if (!ids.length) return this.toast(this.t("Your characters have rolled initiative already, or aren't in this combat."), "warn");
    return this.act(() => this.bridge.run(mode, () => c.rollInitiative(ids)));
  }

  /* ---------- combat marker on the bottom bar ---------- */
  markCombat() {
    const b = this.el?.querySelector('.axs-bottom [data-view="combat"]');
    if (!b) return;
    const c = game.combat;
    const running = !!(c?.started);
    b.classList.toggle("lit", running);
    b.classList.toggle("myturn", running && this.mine(c.combatant));
  }

  /* ---------- keeping the screen on (the player's choice) ---------- */
  async setWake(on) {
    const btn = this.el.querySelector('[data-action="wake"]');
    if (on) {
      if (!("wakeLock" in navigator) || !window.isSecureContext) {
        this.toast(this.t("This browser can only keep the screen on when Foundry is opened over https://."), "warn");
        this.remember("wake", "0");
        return;
      }
      try {
        this.wake = await navigator.wakeLock.request("screen");
        this.wake.addEventListener?.("release", () => { this.wake = null; btn?.classList.remove("active"); });
        btn?.classList.add("active");
        this.remember("wake", "1");
      } catch (err) { this.wake = null; this.toast(this.t("The screen can't be kept on: {error}", { error: err.message }), "warn"); }
    } else {
      this.remember("wake", "0");
      try { await this.wake?.release(); } catch (e) { /* already released */ }
      this.wake = null;
      btn?.classList.remove("active");
    }
  }

  /* ---------- reconnecting ---------- */
  banner(text) {
    const b = this.el.querySelector(".axs-banner");
    b.hidden = !text;
    if (text) b.querySelector("span").innerHTML = `${this.esc(text)} <button type="button" data-action="reload">${this.H("Reload")}</button>`;
  }
  /**
   * The server can't reach a phone that has dropped off, so the phone does it: while the window is open it watches the
   * connection, shows Reconnecting…, and reloads once the server answers again. A phone that slept in the background is
   * checked as soon as the player comes back to it.
   */
  watchConnection() {
    const s = game.socket;
    const lost = () => { if (this.offline) return; this.offline = true; this.banner(this.t("Connection lost. Reconnecting…")); this.retry(); };
    const back = () => { if (!this.offline) return; this.banner(this.t("Connected again. Reloading…")); setTimeout(() => window.location.reload(), 600); };
    s?.on?.("disconnect", lost);
    s?.on?.("connect", back);
    s?.io?.on?.("reconnect", back);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      if (s && s.connected === false) lost();
      if (this.recall("wake", "0") === "1" && !this.wake) this.setWake(true); // the browser lets go of the screen lock while hidden
    });
    window.addEventListener("online", () => { if (this.offline) this.retry(); });
  }
  retry() {
    clearTimeout(this.retryTimer);
    const s = game.socket;
    if (!this.offline) return;
    if (s?.connected) { this.banner(this.t("Connected again. Reloading…")); setTimeout(() => window.location.reload(), 600); return; }
    try { s?.connect?.(); } catch (e) { /* socket.io keeps trying by itself */ }
    // When the page itself still answers, the server is back even if the old connection doesn't recover: reload
    fetch(window.location.href, { method: "HEAD", cache: "no-store" }).then((r) => { if (r.ok && !s?.connected) { this.banner(this.t("Connected again. Reloading…")); setTimeout(() => window.location.reload(), 600); } }).catch(() => {});
    this.retryTimer = setTimeout(() => this.retry(), 5000);
  }

  /* ---------- the on-screen keyboard ---------- */
  /** While typing, the bottom bar steps aside and the box being typed in stays in view. */
  watchKeyboard() {
    const vv = window.visualViewport;
    const fit = () => {
      const h = vv ? vv.height : window.innerHeight;
      this.el.style.setProperty("--axs-h", `${Math.round(h)}px`);
      const typing = vv ? window.innerHeight - vv.height > 120 || (document.activeElement?.matches?.("#ax-voodoo input[type=text], #ax-voodoo textarea") && window.screen?.height - vv.height > 200) : false;
      this.el.classList.toggle("axs-typing", !!typing);
      if (typing) document.activeElement?.scrollIntoView?.({ block: "center", behavior: "smooth" });
    };
    vv?.addEventListener("resize", fit);
    window.addEventListener("resize", fit);
    this.el.addEventListener("focusin", (ev) => { if (ev.target.matches("input, textarea")) setTimeout(fit, 300); });
    this.el.addEventListener("focusout", () => setTimeout(fit, 300));
    fit();
  }
}
