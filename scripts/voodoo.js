/**
 * Axecleft's VooDoo — your character sheet on your phone (D35E).
 *
 * Mobile accounts: the GM picks existing players and the module creates a linked "Name (Mobile)" account for each.
 * The mobile account always has its main account's ownership of every actor (kept in step by the active GM's client).
 * When a mobile account logs in, the game map is switched off on that phone and the VooDoo window fills the screen.
 * The map option (flags.axeclefts-voodoo.map on the mobile account, set by the GM or the player): the map stays on, behind
 * the window, for a Map view to target tokens and place spell areas (voodoo-map.js).
 *
 * Links (user flags): main user  flags.axeclefts-voodoo.mobile = mobile user id
 *                     mobile user flags.axeclefts-voodoo.main   = main user id
 *
 * API: game.modules.get("axeclefts-voodoo").api = { isMobile, mobileOf, mainOf, createMobile, syncAll, openAccounts, hasMap, setMap, canPick, pickPoint, showView }
 */
import { VooDooWindow } from "./voodoo-window.js";
import { registerTours } from "./voodoo-tours.js";

const MOD = "axeclefts-voodoo";
const A = () => globalThis.AxecleftTools;
const fmt = (s, d) => (d ? String(s).replace(/\{(\w+)\}/g, (m, k) => (d[k] ?? m)) : String(s));
const t = (s, d) => A()?.t?.(s, d) ?? fmt(s, d);
const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const H = (s, d) => esc(t(s, d));
const Dlg = () => A()?.DialogV2 ?? foundry.applications?.api?.DialogV2;
const CANVAS_MARK = `${MOD}.canvasOff`; // this browser had its map switched off by VooDoo
try { const old = "axeclefts-sendings.canvasOff"; if (localStorage.getItem(old) !== null) { localStorage.setItem(CANVAS_MARK, localStorage.getItem(old)); localStorage.removeItem(old); } } catch (e) { /* private mode */ }
const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* private mode */ } } };

A()?.registerLanguageModule?.(MOD); // lang/<code>.json, and the Discord and Patreon buttons in this module's settings

/* -------------------------------------------- */
/*  Links between accounts                      */
/* -------------------------------------------- */

const mainOf = (user) => game.users.get(user?.getFlag?.(MOD, "main") ?? "") ?? null;
const mobileOf = (user) => game.users.get(user?.getFlag?.(MOD, "mobile") ?? "") ?? null;
const isMobile = (user = game.user) => !!user?.getFlag?.(MOD, "main");
/** Does this mobile account have the map (targets and spell areas)? Off unless the GM or the player turns it on. */
const hasMap = (user = game.user) => !!user?.getFlag?.(MOD, "map");
/** Turn the map on or off for a mobile account (the GM for anyone, a player for their own). */
async function setMap(user, on) {
  if (!user || !isMobile(user)) return;
  await user.setFlag(MOD, "map", !!on);
}
/** [main, mobile] for every linked pair whose accounts both still exist. */
const pairs = () => [...game.users].filter((u) => isMobile(u) && mainOf(u)).map((m) => [mainOf(m), m]);
/** Only one client does the GM's bookkeeping: the active GM (Foundry v11+), else any GM. */
const leadGM = () => game.user.isGM && (game.users.activeGM ? game.users.activeGM.isSelf : true);

/* -------------------------------------------- */
/*  Ownership sync                              */
/* -------------------------------------------- */

const INHERIT = () => CONST.DOCUMENT_OWNERSHIP_LEVELS?.INHERIT ?? -1;
/** The ownership changes a document (an actor or a macro) needs so each mobile account matches its main account, or null. */
function ownershipPatch(actor, list = pairs()) {
  const own = actor.ownership ?? {}, patch = {};
  for (const [main, mobile] of list) {
    const want = own[main.id] ?? INHERIT();
    const have = own[mobile.id] ?? INHERIT();
    if (want !== have) patch[mobile.id] = want;
  }
  return Object.keys(patch).length ? patch : null;
}
/** Bring every actor's ownership in step (the lead GM's client). Returns how many actors changed. */
async function syncAll() {
  if (!leadGM()) return 0;
  const list = pairs();
  if (!list.length) return 0;
  const updates = [];
  for (const a of game.actors ?? []) { const p = ownershipPatch(a, list); if (p) updates.push({ _id: a.id, ownership: p }); }
  if (updates.length) await Actor.updateDocuments(updates);
  // Macros too: a player's own macros (an item dragged to the hotbar makes one) are theirs alone, so the phone couldn't run them
  const macros = [];
  for (const m of game.macros ?? []) { const p = ownershipPatch(m, list); if (p) macros.push({ _id: m.id, ownership: p }); }
  if (macros.length) await Macro.updateDocuments(macros);
  return updates.length + macros.length;
}
/** One actor's or macro's ownership in step (the lead GM's client). */
async function syncActor(actor) {
  if (!leadGM() || !actor) return;
  const p = ownershipPatch(actor);
  if (p) await actor.update({ ownership: p });
}

/* -------------------------------------------- */
/*  Creating mobile accounts                    */
/* -------------------------------------------- */

const mobileName = (main) => t("{name} (Mobile)", { name: main.name });
/** Create (or link, if one with that name already exists) the mobile account for a player. */
async function createMobile(main, { password = "" } = {}) {
  if (!game.user.isGM) throw new Error(t("Only the GM can create mobile accounts."));
  if (!main || isMobile(main)) throw new Error(t("{name} can't have a mobile account.", { name: main?.name ?? "?" }));
  const have = mobileOf(main);
  if (have) return have;
  const name = mobileName(main);
  // A GM's phone account is an Assistant GM: it sees and runs every creature, but never takes over as the main GM
  // (Foundry designates the active user with the highest role) while the GM's own account is logged in.
  const role = main.isGM ? CONST.USER_ROLES.ASSISTANT : CONST.USER_ROLES.PLAYER;
  let mobile = game.users.find((u) => u.name === name && !isMobile(u) && u.id !== main.id && (main.isGM || !u.isGM)) ?? null;
  const flags = { [MOD]: { main: main.id } };
  if (mobile) await mobile.update({ flags, ...(main.isGM && mobile.role < role ? { role } : {}), ...(password ? { password } : {}) });
  else {
    const Cls = getDocumentClass("User");
    mobile = await Cls.create({ name, role, password, color: main.color?.css ?? main.color ?? undefined, avatar: main.avatar ?? undefined, flags });
  }
  await main.setFlag(MOD, "mobile", mobile.id);
  if (main.character) await mobile.update({ character: main.character.id ?? main.character });
  await syncAll();
  return mobile;
}

/** The GM's pop-up: tick players, type a password for each, Create. */
async function openAccounts() {
  if (!game.user.isGM) return ui.notifications.warn(t("Only the GM can create mobile accounts."));
  const players = [...game.users].filter((u) => !isMobile(u)).sort((a, b) => (a.isGM === b.isGM ? a.name.localeCompare(b.name) : a.isGM ? -1 : 1));
  if (!players.length) return ui.notifications.info(t("There are no player accounts yet. Create your players' accounts first (Configure Players)."));
  const rows = players.map((u) => {
    const m = mobileOf(u);
    if (m) return `<tr><td></td><td>${esc(u.name)}${u.isGM ? ` <small class="hint">(${H("GM")})</small>` : ""}</td><td><i class="fas fa-mobile-screen-button"></i> ${esc(m.name)}</td><td><label><input type="checkbox" name="map-${m.id}"${hasMap(m) ? " checked" : ""}> ${H("Map")}</label></td></tr>`;
    return `<tr><td><input type="checkbox" name="pick-${u.id}"></td><td>${esc(u.name)}${u.isGM ? ` <small class="hint">(${H("GM")})</small>` : ""}</td><td><input type="text" name="pw-${u.id}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${H("Password")}"></td><td><label><input type="checkbox" name="newmap-${u.id}"> ${H("Map")}</label></td></tr>`;
  }).join("");
  const content = `<p class="hint">${H("Tick the players who need mobile access and give each mobile account a password. Each one becomes \"Name (Mobile)\": it always has the same characters as the player's main account, and opens the VooDoo window when it logs in. Delete a mobile account in Configure Players.")}</p>
    <p class="hint">${H("A GM's mobile account is an Assistant GM: on the phone it picks any creature or NPC (from the combat, the scene or a search), changes hit points and runs the combat. It never takes over from the GM's own account while that one is logged in.")}</p>
    <p class="hint">${H("Map: the account gets a Map view to target tokens, move its own tokens and place spell areas by touch. Off, the phone has no map: lighter and faster. Players can also switch it in the VooDoo window's settings.")}</p>
    <table class="ax-voodoo-accounts"><thead><tr><th></th><th>${H("Player")}</th><th>${H("Mobile password")}</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
  let picked = null, maps = [];
  const res = await Dlg().wait({
    window: { title: t("Mobile accounts"), icon: "fas fa-mobile-screen-button" }, classes: ["ax-voodoo-accounts-dlg"], position: { width: 560 }, content,
    buttons: [
      { action: "create", label: t("Save"), icon: "fas fa-floppy-disk", default: true, callback: (ev, btn) => {
        const f = btn.form?.elements ?? {};
        picked = players.filter((u) => f[`pick-${u.id}`]?.checked).map((u) => ({ user: u, password: String(f[`pw-${u.id}`]?.value ?? ""), map: !!f[`newmap-${u.id}`]?.checked }));
        maps = players.map((u) => mobileOf(u)).filter(Boolean).map((m) => ({ mobile: m, map: !!f[`map-${m.id}`]?.checked })).filter((x) => x.map !== hasMap(x.mobile));
        return "create";
      } },
      { action: "cancel", label: t("Cancel"), icon: "fas fa-times" },
    ],
  });
  if (res !== "create") return;
  for (const { mobile, map } of maps) {
    try { await setMap(mobile, map); ui.notifications.info(t(map ? /*t*/"Map on for {name}." : /*t*/"Map off for {name}.", { name: mobile.name })); }
    catch (err) { console.error(`${MOD} | map for ${mobile.name}`, err); }
  }
  if (!picked?.length) return;
  const made = [];
  for (const { user, password, map } of picked) {
    try { const m = await createMobile(user, { password }); if (map) await setMap(m, true); made.push(m.name); }
    catch (err) { console.error(`${MOD} | mobile account for ${user.name}`, err); ui.notifications.error(t("Couldn't create {name}'s mobile account: {error}", { name: user.name, error: err.message })); }
  }
  if (made.length) ui.notifications.info(t("Mobile accounts ready: {names}. Log in with them from a phone's browser.", { names: made.join(", ") }));
}

/* -------------------------------------------- */
/*  Player list: phone icons                    */
/* -------------------------------------------- */

function markPlayers(app, html) {
  const root = html?.[0] ?? html ?? app?.element;
  if (!root?.querySelectorAll) return;
  const hide = setting("hideMobile") === true;
  for (const li of root.querySelectorAll("[data-user-id]")) {
    const u = game.users.get(li.dataset.userId);
    if (!isMobile(u)) continue;
    if (hide) { li.style.display = "none"; continue; }
    if (li.querySelector(".ax-voodoo-phone")) continue;
    const icon = document.createElement("i");
    icon.className = "fas fa-mobile-screen-button ax-voodoo-phone";
    icon.title = t("Mobile account (Axecleft's VooDoo)");
    const name = li.querySelector(".player-name") ?? li;
    name.append(" ", icon);
  }
}

/* -------------------------------------------- */
/*  Settings                                    */
/* -------------------------------------------- */

function setting(key) { try { return game.settings.get(MOD, key); } catch (e) { return undefined; } }
const rerenderPlayers = () => { try { ui.players?.render(); } catch (e) { /* not yet */ } };

Hooks.once("init", () => {
  const Base = foundry.applications?.api?.ApplicationV2 ?? (typeof FormApplication !== "undefined" ? FormApplication : null);
  // A settings menu opens a window; this one opens the accounts pop-up instead.
  class VooDooAccountsMenu extends Base { render() { openAccounts(); return this; } }
  game.settings.registerMenu(MOD, "accounts", {
    name: /*t*/"Mobile accounts", label: /*t*/"Create mobile accounts", icon: "fas fa-mobile-screen-button", restricted: true, type: VooDooAccountsMenu,
    hint: /*t*/"Pick players and create a linked mobile account for each. A mobile account always has the same characters as the player's main account and opens the VooDoo window (the character sheet on a phone) when it logs in.",
  });
  game.settings.register(MOD, "hideMobile", {
    name: /*t*/"Hide mobile accounts in the player list", scope: "world", config: true, type: Boolean, default: false,
    hint: /*t*/"Off: mobile accounts show in the player list with a phone icon. On: they're left out of it.",
    onChange: rerenderPlayers,
  });
});

// Tours: the GM's Mobile accounts pop-up (the user is known at setup); the phone window's tour is registered when a
// mobile account opens the window
Hooks.once("setup", () => { try { if (!isMobile(game.user)) registerTours({ openAccounts, mobile: false, win: () => null }); } catch (err) { console.warn(`${MOD} | tours`, err); } });

A()?.register?.({ module: MOD, name: "accounts", title: /*t*/"Mobile accounts", hint: /*t*/"Create mobile accounts for your players (Axecleft's VooDoo)", icon: "fas fa-mobile-screen-button", onClick: () => openAccounts() });

/* -------------------------------------------- */
/*  Mobile accounts: no map, the VooDoo window */
/* -------------------------------------------- */

/**
 * Foundry's small-screen warning ("requires a usable window dimensions of 1024px by 768px…") is for the full Foundry
 * screen. A mobile account never shows it, so it isn't shown there; every other account still gets it.
 */
const LOW_RES = /LowResolution|1024\s*px|768\s*px/i;
const lowRes = (message) => LOW_RES.test(String(message ?? ""));
const mobileNow = () => { try { return isMobile(game.user); } catch (e) { return false; } };
/** Wrap a notifications object's methods so the warning never starts on a mobile account. */
function quiet(target) {
  if (!target || target.__axsQuiet) return;
  for (const name of ["notify", "error", "warn", "info"]) {
    const fn = target[name];
    if (typeof fn !== "function") continue;
    target[name] = function (message, ...rest) { if (mobileNow() && lowRes(message)) return null; return fn.call(this, message, ...rest); };
  }
  target.__axsQuiet = true;
}
// As early as possible (Foundry v11 can warn before "init" has finished on a slow phone), again at init, and on the
// live notifications object once it exists (a module may have put its own methods on it)
const notesClass = () => CONFIG.ui?.notifications ?? (typeof Notifications !== "undefined" ? Notifications : globalThis.Notifications);
try { quiet(notesClass()?.prototype); } catch (e) { /* CONFIG not ready yet */ }
Hooks.once("init", () => quiet(notesClass()?.prototype));
Hooks.once("ready", () => { if (mobileNow()) quiet(globalThis.ui?.notifications); });
Hooks.once("setup", () => quiet(globalThis.ui?.notifications));
/**
 * Whatever path Foundry takes to show it, the warning is taken out of the page the moment it's added: a mutation
 * observer runs before the browser paints, so it never flashes on screen.
 */
function clearLowRes(root = document) {
  for (const el of root.querySelectorAll?.("#notifications li, #notifications .notification, li.notification, .notification") ?? []) if (lowRes(el.textContent)) el.remove();
  const n = globalThis.ui?.notifications;
  for (const list of [n?.queue, n?.active]) {
    if (!Array.isArray(list)) continue;
    for (let i = list.length - 1; i >= 0; i--) { const x = list[i]; if (lowRes(x?.message ?? x?.textContent ?? x?.element?.textContent ?? x?.[0]?.textContent)) { try { x.element?.remove?.(); x?.[0]?.remove?.(); } catch (e) { /* gone */ } list.splice(i, 1); } }
  }
}
function watchLowRes() {
  if (globalThis.__axsLowResObserver) return;
  const obs = new MutationObserver((records) => {
    if (!mobileNow()) return;
    for (const r of records) for (const node of r.addedNodes) {
      if (node.nodeType !== 1) continue;
      if (lowRes(node.textContent) && node.matches?.("li, .notification, [class*=notification]")) node.remove();
      else if (node.querySelector) clearLowRes(node);
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });
  globalThis.__axsLowResObserver = obs;
}
// Watch from the start for a mobile account (the user is known at setup), before Foundry's first check
Hooks.once("setup", () => { if (mobileNow()) watchLowRes(); });

/** Is Foundry's per-browser "disable game canvas" option there to use? */
const hasNoCanvas = () => { try { return game.settings.settings.has("core.noCanvas"); } catch (e) { return false; } };

/**
 * Desktop HUDs that sit over the VooDoo window and do nothing there (Token Action HUD's bar): kept off for mobile
 * accounts. Their own settings are left as they are (they are per browser, and the same browser may log in as a
 * normal account): VooDoo only answers "off" for this session.
 */
const DESKTOP_HUDS = [["token-action-hud-core", "enable"]];
Hooks.once("setup", () => {
  if (!isMobile(game.user)) return;
  const off = new Set(DESKTOP_HUDS.map(([m, k]) => `${m}.${k}`));
  const settings = game.settings;
  const get = settings.get;
  settings.get = function (namespace, key, ...rest) {
    if (off.has(`${namespace}.${key}`)) return false;
    return get.call(this, namespace, key, ...rest);
  };
  document.body.classList.add("ax-voodoo-mobile");
});

Hooks.once("setup", () => {
  if (!hasNoCanvas()) return;
  const off = !!game.settings.get("core", "noCanvas");
  if (isMobile(game.user)) {
    if (hasMap(game.user)) {
      // A mobile account with the map: the map on (if VooDoo had switched it off), behind the VooDoo window
      if (off) { store.set(CANVAS_MARK, null); game.settings.set("core", "noCanvas", false).then(() => window.location.reload()); }
      return;
    }
    // A mobile account: switch the map off on this browser (once), then start again without it
    if (!off) {
      store.set(CANVAS_MARK, "1");
      game.settings.set("core", "noCanvas", true).then(() => window.location.reload());
    }
  } else if (off && store.get(CANVAS_MARK) === "1") {
    // A normal account on a browser VooDoo switched the map off on: switch it back on
    store.set(CANVAS_MARK, null);
    game.settings.set("core", "noCanvas", false).then(() => window.location.reload());
  }
});

Hooks.once("ready", async () => {
  const mod = game.modules.get(MOD);
  if (mod) mod.api = API;
  if (isMobile(game.user)) {
    const map = hasMap(game.user);
    if (hasNoCanvas() && !map && !game.settings.get("core", "noCanvas")) return; // reloading without the map
    if (hasNoCanvas() && map && game.settings.get("core", "noCanvas")) return; // reloading with the map
    if (map) document.body.classList.add("ax-voodoo-map");
    const win = new VooDooWindow({ MOD, t, H, esc, map, setMap: (on) => setMap(game.user, on) });
    win.mount();
    theWindow = win;
    try { registerTours({ openAccounts, mobile: true, win: () => win }); } catch (err) { console.warn(`${MOD} | tours`, err); }
    watchLowRes();
    clearLowRes();
    return;
  }
  // Mobile accounts linked while this module was called Sendings (flags.axeclefts-sendings): keep their links
  if (leadGM()) {
    const OLD = "axeclefts-sendings";
    const moved = [...game.users].filter((u) => u.flags?.[OLD] && !u.flags?.[MOD]).map((u) => ({ _id: u.id, [`flags.${MOD}`]: { ...u.flags[OLD] } }));
    if (moved.length) { try { await User.updateDocuments(moved); console.log(`${MOD} | kept ${moved.length} account link(s) from Sendings`); } catch (err) { console.error(`${MOD} | moving Sendings links`, err); } }
  }
  if (leadGM()) { try { const n = await syncAll(); if (n) console.log(`${MOD} | mobile accounts: ownership brought in step on ${n} actor(s) and macro(s)`); } catch (err) { console.error(`${MOD} | sync`, err); } }
});

/* -------------------------------------------- */
/*  Keeping links and ownership in step         */
/* -------------------------------------------- */

Hooks.on("createMacro", (macro) => { syncActor(macro).catch((e) => console.error(`${MOD} | sync`, e)); });
Hooks.on("updateMacro", (macro, changes) => { if (changes?.ownership) syncActor(macro).catch((e) => console.error(`${MOD} | sync`, e)); });
Hooks.on("createActor", (actor) => { syncActor(actor).catch((e) => console.error(`${MOD} | sync`, e)); });
Hooks.on("updateActor", (actor, changes) => { if (changes?.ownership) syncActor(actor).catch((e) => console.error(`${MOD} | sync`, e)); });
Hooks.on("updateUser", (user, changes) => {
  // This phone's map was switched (by the player or the GM): start again with or without it
  if (user.id === game.user?.id && isMobile(user) && foundry.utils.hasProperty(changes ?? {}, `flags.${MOD}.map`)) {
    ui.notifications?.info?.(t(hasMap(user) ? /*t*/"Map on: reloading…" : /*t*/"Map off: reloading…"));
    setTimeout(() => window.location.reload(), 800);
  }
  if (changes?.flags?.[MOD] && leadGM()) syncAll().catch((e) => console.error(`${MOD} | sync`, e));
  if (changes?.flags?.[MOD] || changes?.name) rerenderPlayers();
});
Hooks.on("deleteUser", async (user) => {
  if (!leadGM()) return;
  const main = game.users.get(user.getFlag?.(MOD, "main") ?? "");
  if (main && main.getFlag(MOD, "mobile") === user.id) await main.unsetFlag(MOD, "mobile"); // a mobile account was deleted: free its player
  const mobile = game.users.get(user.getFlag?.(MOD, "mobile") ?? "");
  if (mobile) {
    // Left linked to the deleted id: it still opens the VooDoo window, with the characters it already has
    ui.notifications.warn(t("{main} was deleted; its mobile account {mobile} still exists. Delete it in Configure Players if it's no longer needed.", { main: user.name, mobile: mobile.name }), { permanent: true });
  }
});
// Player list (Foundry v13+: Players; v11/v12: PlayerList)
Hooks.on("renderPlayers", markPlayers);
Hooks.on("renderPlayerList", markPlayers);

let theWindow = null;
/** For other modules: can this browser pick a spot on VooDoo's map, and ask for one ({ prompt } → { x, y } or null). */
const canPick = () => !!(theWindow?.map && globalThis.canvas?.ready && canvas.scene);
const pickPoint = (opts) => (canPick() ? theWindow.map.pickPoint(opts) : Promise.resolve(null));
/** For other modules: switch the phone to one of its views ("character", "party", "chat", "combat", "map"). False when not on a VooDoo phone. */
const showView = (view) => { if (!theWindow?.views?.some?.(([v]) => v === view)) return false; theWindow.show(view); return true; };
const API = { isMobile, mobileOf, mainOf, createMobile, syncAll, openAccounts, hasMap, setMap, canPick, pickPoint, showView };
