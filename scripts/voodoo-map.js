/**
 * Axecleft's VooDoo — the Map view (for mobile accounts the GM or the player has turned the map on for).
 *
 * The map is Foundry's own game canvas, shown behind the VooDoo window, so targets and spell areas are Foundry's and
 * D35E's own: D35E reads the targets from game.user.targets, and places spell areas with its own template preview.
 * The phone never touches the canvas directly. A touch layer over it does everything with large buttons and taps:
 *   - drag to move the map, pinch or the + and − buttons to zoom, Centre to find your character;
 *   - tap a token to target it (tap again to untarget); the targets show as chips under the map;
 *   - when a spell asks for its area, the view switches here: tap or drag where it goes, turn it with the arrow
 *     buttons, then Place (or Cancel). These drive D35E's own preview (the moves, clicks, wheel and right-click it
 *     listens for), so the area is placed and its targets found exactly as on a computer.
 * Press and hold a token to play it (and select it); keep holding and drag to move it. Players take only their own
 * tokens and walls block them; the GM takes any token and moves freely, as on a computer. While another view is showing, the map stops drawing to
 * save the battery.
 */

const TAP_MS = 350, TAP_PX = 12, HOLD_MS = 550;

export class MapView {
  constructor(win) {
    this.win = win;
    this.mode = "map";       // what one finger does while placing a spell area: "area" (move it) or "map" (move the map)
    this.placing = null;     // the D35E template preview being placed
    this.pointers = new Map();
    this.eyes = this.win.recall("eyes", "1") === "1"; // see through the picked character's token
    this.pinch = null;
    this.watchPreview();
  }
  get t() { return this.win.t; }
  get H() { return this.win.H; }
  get esc() { return this.win.esc; }
  get ready() { return !!(globalThis.canvas?.ready && canvas.scene); }

  /* ---------- the view ---------- */
  html() {
    const H = this.H;
    return `<div class="axs-map-bar">
        <button type="button" class="axs-icon" data-map="zoom-out" title="${H("Zoom out")}"><i class="fas fa-magnifying-glass-minus"></i></button>
        <button type="button" class="axs-icon" data-map="zoom-in" title="${H("Zoom in")}"><i class="fas fa-magnifying-glass-plus"></i></button>
        <button type="button" class="axs-icon axs-map-eye" data-map="eyes"><i class="fas fa-eye"></i></button>
        <button type="button" class="axs-map-btn" data-map="center"><i class="fas fa-crosshairs"></i> <span>${H("My character")}</span></button>
        <button type="button" class="axs-map-btn" data-map="clear"><i class="fas fa-bullseye"></i> <span>${H("Clear targets")}</span></button>
      </div>
      <div class="axs-map-touch"><div class="axs-map-msg" hidden></div></div>
      <div class="axs-map-foot"></div>`;
  }

  /** The Map view was opened (or closed). */
  shown(on) {
    const app = globalThis.canvas?.app;
    try { if (on) app?.ticker?.start(); else if (!this.placing) app?.ticker?.stop(); } catch (e) { /* no canvas */ }
    this.win.el.classList.toggle("axs-on-map", on);
    document.body.classList.toggle("ax-voodoo-map-shown", on);
    if (on) this.render();
  }

  render() {
    const box = this.win.el.querySelector('.axs-view[data-view="map"]');
    if (!box) return;
    if (!box.dataset.wired) { box.innerHTML = this.html(); this.wire(box); box.dataset.wired = "1"; }
    const msg = box.querySelector(".axs-map-msg");
    msg.hidden = this.ready;
    this.followVision();
    const eye = box.querySelector('[data-map="eyes"]');
    if (eye) { eye.classList.toggle("on", this.eyes); eye.title = this.t(this.eyes ? /*t*/"Seeing as your character (darkvision, low-light vision): tap to stop" : /*t*/"Tap to see as your character (darkvision, low-light vision)"); }
    if (!this.ready) msg.innerHTML = `<i class="fas fa-map"></i><p>${this.H("There's no map to show: the GM hasn't opened a scene, or the map is still loading.")}</p>`;
    this.renderFoot();
  }

  renderFoot() {
    const foot = this.win.el.querySelector(".axs-map-foot");
    if (!foot) return;
    const H = this.H, esc = this.esc;
    if (this.placing) {
      const moving = this.mode === "map";
      foot.innerHTML = `<div class="axs-map-hint">${H(moving ? /*t*/"Drag to move the map; switch back to move the area." : /*t*/"Tap or drag on the map to put the spell's area there.")}</div>
        <div class="axs-map-row">
          <button type="button" class="axs-map-btn${this.mode === "area" ? " on" : ""}" data-map="mode-area"><i class="fas fa-bullseye"></i> <span>${H("Move area")}</span></button>
          <button type="button" class="axs-map-btn${this.mode === "map" ? " on" : ""}" data-map="mode-map"><i class="fas fa-hand"></i> <span>${H("Move map")}</span></button>
          <button type="button" class="axs-icon" data-map="turn-left" title="${H("Turn left")}"><i class="fas fa-rotate-left"></i></button>
          <button type="button" class="axs-icon" data-map="turn-right" title="${H("Turn right")}"><i class="fas fa-rotate-right"></i></button>
        </div>
        <div class="axs-pair"><button type="button" data-map="cancel"><i class="fas fa-xmark"></i> ${H("Cancel")}</button><button type="button" class="axs-primary" data-map="place"><i class="fas fa-check"></i> ${H("Place")}</button></div>`;
      return;
    }
    const targets = [...(game.user.targets ?? [])];
    foot.innerHTML = targets.length
      ? `<div class="axs-chips">${targets.map((tk) => `<button type="button" class="axs-chip" data-map="untarget" data-id="${esc(tk.id)}"><img src="${esc(tk.document?.texture?.src ?? "")}" alt=""><span>${esc(tk.name)}</span><i class="fas fa-xmark"></i></button>`).join("")}</div>`
      : this.helpOpen
        ? `<div class="axs-map-hint axs-map-help">${H("Tap a token to target it; tap it again to untarget. Drag to move the map. Press and hold a merchant, a loot pile or another token you may look at to open it.")}${game.user.isGM ? ` ${H("Press and hold a token to play it; keep holding and drag to move it.")}` : ` ${H("Press and hold your token; keep holding and drag to move it.")}`}
            <button type="button" class="axs-icon" data-map="help" title="${H("Close")}"><i class="fas fa-xmark"></i></button></div>`
        : `<div class="axs-map-hint axs-map-help"><span>${H("Tap: target · Hold: open or move")}</span><button type="button" class="axs-icon" data-map="help" title="${H("How the map works")}"><i class="fas fa-circle-question"></i></button></div>`;
  }

  /* ---------- touch ---------- */
  wire(box) {
    box.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-map]");
      if (b) this.button(b.dataset.map, b.dataset.id);
    });
    const layer = box.querySelector(".axs-map-touch");
    layer.addEventListener("pointerdown", (ev) => {
      layer.setPointerCapture?.(ev.pointerId);
      this.pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY, x0: ev.clientX, y0: ev.clientY, t0: Date.now() });
      if (this.pointers.size === 2) this.pinch = { d: this.spread(), scale: canvas.stage?.scale?.x ?? 1 };
      if (this.placing && this.mode === "area" && this.pointers.size === 1) this.moveArea(ev.clientX, ev.clientY);
      // Press and hold a token to take it; keep holding and drag to move it (players: their own tokens, walls block)
      clearTimeout(this.holdTimer);
      if (!this.placing && this.pointers.size === 1 && this.ready) {
        const id = ev.pointerId;
        this.holdTimer = setTimeout(() => {
          const p = this.pointers.get(id);
          if (!p || this.pointers.size !== 1 || Math.hypot(p.x - p.x0, p.y - p.y0) >= TAP_PX) return;
          this.hold(p.x, p.y);
        }, HOLD_MS);
      }
    });
    layer.addEventListener("pointermove", (ev) => {
      const p = this.pointers.get(ev.pointerId);
      if (!p || !this.ready) return;
      const dx = ev.clientX - p.x, dy = ev.clientY - p.y;
      p.x = ev.clientX; p.y = ev.clientY;
      if (this.dragging && this.pointers.size === 1) return this.dragTo(ev.clientX, ev.clientY);
      if (Math.hypot(ev.clientX - p.x0, ev.clientY - p.y0) >= TAP_PX) clearTimeout(this.holdTimer);
      if (this.pointers.size >= 2 && this.pinch) {
        const d = this.spread();
        if (this.pinch.d > 0) canvas.pan({ scale: this.pinch.scale * (d / this.pinch.d) });
        return;
      }
      if (this.placing && this.mode === "area") return this.moveArea(ev.clientX, ev.clientY);
      const s = canvas.stage.scale.x || 1;
      canvas.pan({ x: canvas.stage.pivot.x - dx / s, y: canvas.stage.pivot.y - dy / s });
    });
    const up = (ev) => {
      clearTimeout(this.holdTimer);
      if (this.dragging) { this.pointers.delete(ev.pointerId); return this.drop(ev.type === "pointercancel" ? null : ev); }
      if (this.held) { this.held = false; this.pointers.delete(ev.pointerId); return; } // a hold that took a token is not a tap
      const p = this.pointers.get(ev.pointerId);
      this.pointers.delete(ev.pointerId);
      if (this.pointers.size < 2) this.pinch = null;
      if (!p || ev.type === "pointercancel") return;
      const tap = Date.now() - p.t0 < TAP_MS && Math.hypot(ev.clientX - p.x0, ev.clientY - p.y0) < TAP_PX;
      if (tap && !this.placing && this.pointers.size === 0) this.tapAt(ev.clientX, ev.clientY);
    };
    layer.addEventListener("pointerup", up);
    layer.addEventListener("pointercancel", up);
    layer.addEventListener("contextmenu", (ev) => ev.preventDefault());
  }
  /* ---------- the GM: take and move tokens ---------- */
  /** Press and hold on a token: it becomes the creature played (and the selected token); then dragging moves it. */
  async hold(clientX, clientY) {
    const tk = this.tokenAt(clientX, clientY);
    if (!tk) return;
    const gm = game.user.isGM;
    const shop = this.win.isShop?.(tk.actor);
    // Someone else's token: hold opens its sheet (a merchant's shop, a loot pile, party storage…) when it's open to you
    if (!gm && !(tk.isOwner ?? tk.document?.isOwner)) {
      if (tk.actor?.testUserPermission?.(game.user, "LIMITED")) { this.held = true; navigator.vibrate?.(30); this.win.openActorSheet(tk.actor); }
      return;
    }
    this.held = true;
    navigator.vibrate?.(30);
    try { tk.control({ releaseOthers: true }); } catch (e) { /* not controllable */ }
    const w = this.worldPoint(clientX, clientY);
    this.dragging = { tk, dx: w.x - tk.document.x, dy: w.y - tk.document.y, moved: false };
    this.ghost(tk, clientX, clientY);
    if (shop) { this.dragging.open = tk.actor; return this.win.toast(this.t("{name}: let go to open it, or drag to move it.", { name: tk.name })); } // a shop or loot: let go opens it
    if (gm) { if (tk.document?.uuid && tk.document.uuid !== this.win.pickUuid) await this.win.chooseUuid(tk.document.uuid); }
    else if (tk.actor && tk.document?.actorLink && tk.actor.id !== this.win.actor?.id && this.win.characters().some((a) => a.id === tk.actor.id)) await this.win.choose(tk.actor.id);
    this.win.toast(this.t("{name}: drag to move it, or let go.", { name: tk.name }));
  }
  /** A see-through copy of the token under the finger while it's dragged. */
  ghost(tk, clientX, clientY) {
    const layer = this.win.el.querySelector(".axs-map-touch");
    if (!layer) return;
    let g = layer.querySelector(".axs-ghost");
    if (!g) { g = document.createElement("img"); g.className = "axs-ghost"; g.alt = ""; layer.append(g); }
    g.src = tk.document?.texture?.src ?? "";
    const s = canvas.stage.scale.x || 1;
    const w = (tk.w ?? (tk.document.width * canvas.grid.size)) * s, h = (tk.h ?? (tk.document.height * canvas.grid.size)) * s;
    const r = layer.getBoundingClientRect(), d = this.dragging;
    g.style.width = `${w}px`; g.style.height = `${h}px`;
    g.style.left = `${clientX - r.left - d.dx * s}px`; g.style.top = `${clientY - r.top - d.dy * s}px`;
    g.hidden = false;
  }
  dragTo(clientX, clientY) {
    const d = this.dragging;
    if (!d) return;
    d.moved = true;
    this.ghost(d.tk, clientX, clientY);
  }
  /** Let go: the token goes to the grid space under the ghost (Foundry animates the move). */
  async drop(ev) {
    const d = this.dragging;
    this.dragging = null;
    this.held = false;
    const g = this.win.el.querySelector(".axs-ghost");
    if (g) g.hidden = true;
    if (d?.open && ev && !d.moved) return this.win.openActorSheet(d.open);
    if (!d || !ev || !d.moved) return;
    const w = this.worldPoint(ev.clientX, ev.clientY);
    let x = w.x - d.dx, y = w.y - d.dy;
    try {
      const M = CONST.GRID_SNAPPING_MODES;
      // Foundry v12+: getSnappedPoint; v11: getSnappedPosition (the top-left of the space)
      const p = typeof canvas.grid.getSnappedPoint === "function" ? canvas.grid.getSnappedPoint({ x, y }, { mode: M?.TOP_LEFT_VERTEX ?? M?.TOP_LEFT_CORNER ?? 16 }) : canvas.grid.getSnappedPosition(x, y, 1);
      x = p.x; y = p.y;
    } catch (e) { const gs = canvas.grid?.size || 100; x = Math.round(x / gs) * gs; y = Math.round(y / gs) * gs; }
    if (x === d.tk.document.x && y === d.tk.document.y) return;
    const gm = game.user.isGM;
    // Players obey walls (and Foundry's own rules: a paused game, impassable terrain); the GM moves freely, as on a computer
    if (!gm && typeof d.tk.checkCollision === "function") {
      const w2 = (d.tk.w ?? d.tk.document.width * canvas.grid.size) / 2, h2 = (d.tk.h ?? d.tk.document.height * canvas.grid.size) / 2;
      let blocked = false;
      try { blocked = !!d.tk.checkCollision({ x: x + w2, y: y + h2 }); } catch (e) { blocked = false; }
      if (blocked) { navigator.vibrate?.([30, 60, 30]); return this.win.toast(this.t("A wall is in the way."), "warn"); }
    }
    await this.win.act(async () => {
      const doc = d.tk.document;
      let ok = true;
      if (typeof doc.move === "function") ok = await doc.move({ x, y }, gm ? { constrainOptions: { ignoreWalls: true, ignoreCost: true } } : {});
      else await doc.update({ x, y });
      if (ok === false) this.win.toast(this.t("{name} couldn't move there (a wall, or the game is paused).", { name: d.tk.name }), "warn");
    });
  }

  spread() { const [a, b] = [...this.pointers.values()]; return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0; }

  /** A screen point as PIXI's global point (what the canvas's own events carry). */
  globalPoint(clientX, clientY) {
    const P = new PIXI.Point();
    const ev = canvas.app.renderer?.events ?? canvas.app.renderer?.plugins?.interaction;
    if (ev?.mapPositionToPoint) ev.mapPositionToPoint(P, clientX, clientY);
    else { const r = canvas.app.view.getBoundingClientRect(); P.set(clientX - r.left, clientY - r.top); }
    return P;
  }
  worldPoint(clientX, clientY) { return canvas.stage.toLocal(this.globalPoint(clientX, clientY)); }
  /** An event shaped like the canvas's own (D35E's preview reads event.data.getLocalPosition). */
  fakeEvent(clientX, clientY, extra = {}) {
    const g = this.globalPoint(clientX, clientY);
    const getLocalPosition = (obj, point = new PIXI.Point()) => obj.toLocal(g, undefined, point);
    return { global: g, clientX, clientY, button: 0, buttons: 1, stopPropagation() {}, preventDefault() {}, getLocalPosition, data: { global: g, getLocalPosition }, ...extra };
  }

  /* ---------- targets ---------- */
  /** The token under a screen point (the top one the player can see). */
  tokenAt(clientX, clientY) {
    const w = this.worldPoint(clientX, clientY);
    const list = (canvas.tokens?.placeables ?? []).filter((tk) => tk.visible && (game.user.isGM || !tk.document?.hidden) && tk.bounds?.contains?.(w.x, w.y));
    return list.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0) || (a.document?.sort ?? 0) - (b.document?.sort ?? 0)).at(-1) ?? null;
  }
  tapAt(clientX, clientY) {
    if (!this.ready) return;
    const tk = this.tokenAt(clientX, clientY);
    if (!tk) return;
    const on = !game.user.targets.has(tk);
    this.setTarget(tk, on);
    navigator.vibrate?.(15);
    this.win.toast(this.t(on ? /*t*/"Targeting {name}" : /*t*/"No longer targeting {name}", { name: tk.name }));
  }
  /** Target or untarget a token for this account (seen by everyone, read by D35E's attacks and spells). */
  setTarget(tk, on) {
    try {
      if (typeof tk.setTarget === "function") tk.setTarget(on, { user: game.user, releaseOthers: false, groupSelection: true });
      else {
        const ids = new Set([...game.user.targets].map((x) => x.id));
        if (on) ids.add(tk.id); else ids.delete(tk.id);
        game.user.updateTokenTargets?.([...ids]);
      }
      game.user.broadcastActivity?.({ targets: [...game.user.targets].map((x) => x.id) });
    } catch (err) { console.error(`${this.win.MOD} | target`, err); this.win.toast(err.message, "error"); }
    this.renderFoot();
  }
  clearTargets() {
    for (const tk of [...(game.user.targets ?? [])]) this.setTarget(tk, false);
    this.renderFoot();
  }

  /* ---------- buttons ---------- */
  button(what, id) {
    if (!this.ready && !["cancel", "help"].includes(what)) return;
    const zoom = (f) => canvas.animatePan({ scale: (canvas.stage.scale.x || 1) * f, duration: 150 });
    switch (what) {
      case "zoom-in": return zoom(1.25);
      case "zoom-out": return zoom(0.8);
      case "center": return this.centerOnMe();
      case "eyes": this.eyes = !this.eyes; this.win.remember("eyes", this.eyes ? "1" : "0"); this.render(); return this.win.toast(this.eyes ? this.t("Seeing as {name}.", { name: this.win.actor?.name ?? "?" }) : this.t(game.user.isGM ? /*t*/"Seeing the whole map." : /*t*/"Seeing through all your tokens."));
      case "clear": return this.clearTargets();
      case "help": this.helpOpen = !this.helpOpen; return this.renderFoot();
      case "untarget": { const tk = canvas.tokens?.get(id); if (tk) this.setTarget(tk, false); return; }
      case "mode-area": this.mode = "area"; return this.renderFoot();
      case "mode-map": this.mode = "map"; return this.renderFoot();
      case "turn-left": return this.turn(-1);
      case "turn-right": return this.turn(1);
      case "place": return this.place();
      case "cancel": return this.cancel();
    }
  }
  /** The picked character's token on this map (an unlinked creature: its own token; else the linked one first). */
  myToken() {
    const a = this.win.actor;
    if (!a || !canvas.tokens) return null;
    if (a.isToken && a.token) return canvas.tokens.get(a.token.id) ?? null;
    const list = canvas.tokens.placeables ?? [];
    return list.find((tk) => tk.actor?.id === a.id && tk.document?.actorLink) ?? list.find((tk) => tk.actor?.id === a.id) ?? null;
  }

  /**
   * Vision: Foundry draws what the controlled token sees (its darkvision, low-light vision, its light) — a GM with no
   * token controlled sees no token's vision at all. So the picked character's token is controlled on the phone (it
   * still can't be moved: the touch layer never passes a drag to the map). "See as" off releases it: a player then sees
   * through all of their tokens, a GM the whole map.
   */
  followVision() {
    if (!this.ready) return;
    try {
      const tk = this.myToken();
      if (this.eyes && tk) { if (!tk.controlled) tk.control({ releaseOthers: true }); }
      else if (!this.eyes) canvas.tokens.releaseAll();
    } catch (err) { console.warn(`${this.win.MOD} | vision`, err); }
  }
  centerOnMe() {
    const tk = this.myToken();
    if (!tk) return this.win.toast(this.t("Your character has no token on this map."), "warn");
    canvas.animatePan({ x: tk.center.x, y: tk.center.y, duration: 250 });
  }

  /* ---------- placing a spell's area (D35E's template preview) ---------- */
  /** Watch the template layer: D35E adds its preview there when a spell asks where its area goes. */
  watchPreview() {
    const attach = () => {
      const pv = canvas?.templates?.preview;
      if (!pv || pv.__axsWatched) return;
      pv.__axsWatched = true;
      pv.on?.("childAdded", (child) => this.startPlacing(child));
      pv.on?.("childRemoved", (child) => { if (child === this.placing) this.stopPlacing(); });
    };
    Hooks.on("canvasReady", attach);
    if (globalThis.canvas?.ready) attach();
  }
  startPlacing(preview) {
    if (!preview?.document) return;
    this.placing = preview;
    this.mode = "area";
    if (this.win.view !== "map") this.win.show("map");
    else this.shown(true);
    // Start it in the middle of the map, or on the caster
    const tk = this.myToken();
    const r = this.win.el.querySelector(".axs-map-touch")?.getBoundingClientRect();
    if (tk) {
      const g = canvas.stage.toGlobal(new PIXI.Point(tk.center.x, tk.center.y));
      const v = canvas.app.view.getBoundingClientRect();
      const inView = r && g.x + v.left >= r.left && g.x + v.left <= r.right && g.y + v.top >= r.top && g.y + v.top <= r.bottom;
      if (!inView) canvas.pan({ x: tk.center.x, y: tk.center.y });
    }
    if (r) setTimeout(() => this.moveArea(r.left + r.width / 2, r.top + r.height / 2), 50);
    this.renderFoot();
    this.win.toast(this.t("Put the spell's area on the map, then press Place."));
  }
  stopPlacing() {
    this.placing = null;
    this.mode = "map";
    this.renderFoot();
  }
  moveArea(clientX, clientY) {
    if (!this.placing) return;
    canvas.stage.emit("mousemove", this.fakeEvent(clientX, clientY));
  }
  /** Turn the area (D35E's preview turns with the mouse wheel; Shift for bigger steps). */
  turn(dir) {
    const fn = canvas.app?.view?.onwheel;
    if (typeof fn !== "function") return;
    fn({ deltaY: dir, ctrlKey: false, shiftKey: true, altKey: false, preventDefault() {}, stopPropagation() {} });
  }
  place() {
    if (!this.placing) return;
    const doc = this.placing.document;
    const g = canvas.stage.toGlobal(new PIXI.Point(doc.x, doc.y));
    const v = canvas.app.view.getBoundingClientRect();
    canvas.stage.emit("mousedown", this.fakeEvent(v.left + g.x, v.top + g.y));
    this.stopPlacing();
  }
  cancel() {
    if (!this.placing) return this.renderFoot();
    const fn = canvas.app?.view?.oncontextmenu;
    if (typeof fn === "function") fn({ preventDefault() {}, stopPropagation() {} });
    else { try { this.placing.destroy?.(); } catch (e) { /* gone */ } }
    this.stopPlacing();
  }
}
