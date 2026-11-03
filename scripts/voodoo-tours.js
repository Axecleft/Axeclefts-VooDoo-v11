/**
 * Axecleft's VooDoo — tours (Axecleft's Tools 9.7).
 *
 * "Mobile accounts" (the GM): the pop-up that creates the players' mobile accounts. In Configure Settings → Tour Management.
 * "The phone window" (mobile accounts, players and the GM's phone): the VooDoo window, started from the window's Settings
 * (a phone can't reach Tour Management). It is registered only on mobile accounts, where the window exists.
 */
const MOD = "axeclefts-voodoo";
const DLG = "ax-voodoo-accounts-dlg";
const wait = async (test, ms = 2000) => { for (let i = 0; i < ms / 50 && !test(); i++) await new Promise((r) => setTimeout(r, 50)); };

/** win(): the phone window (VooDooWindow) on a mobile account, else null. */
export function registerTours({ openAccounts, mobile, win }) {
  const R = globalThis.AxecleftTools?.registerTour;
  if (!R) return;

  if (!mobile) {
    R({ module: MOD, id: "accounts", cls: DLG,
      title: /*t*/"VooDoo: Mobile accounts", description: /*t*/"Create a mobile account for each player, so they can play from a phone.",
      open: async () => { if (!document.querySelector(`.${DLG}`)) { openAccounts(); await wait(() => document.querySelector(`.${DLG}`)); } },
      steps: [
        { id: "intro", sel: "p.hint:nth-of-type(1)", title: /*t*/"Mobile accounts",
          content: /*t*/"Each player who wants to play from a phone gets a second account, \"Name (Mobile)\". It always has the same characters as the player's own account, and when it logs in the phone shows the VooDoo window: the character sheet, chat and combat, made for touch.\nOpen this window from Configure Settings → Axecleft's VooDoo → Create mobile accounts, or the Axecleft's Tools menu." },
        { id: "gm", sel: "p.hint:nth-of-type(2)", title: /*t*/"Your own phone",
          content: /*t*/"You can have one too. A GM's mobile account is an Assistant GM: on the phone it picks any creature or NPC, changes hit points and runs the combat, and it never takes over from your own account." },
        { id: "pick", sel: "td:has(input[name^='pick-'])", title: /*t*/"Pick the players",
          content: /*t*/"Tick each player who needs a mobile account. Players who already have one show it instead of a box." },
        { id: "password", sel: "input[name^='pw-']", title: /*t*/"Mobile password",
          content: /*t*/"The password the mobile account logs in with. Players type it on their phone, so keep it simple." },
        { id: "map", sel: "label:has(input[name^='newmap-']), label:has(input[name^='map-'])", title: /*t*/"Map",
          content: /*t*/"Ticked, the phone gets a Map view to target tokens, move its own tokens and place spell areas by touch. Unticked, the phone has no map: lighter and faster. Players can switch it themselves in the phone's Settings." },
        { id: "existing", sel: "td:has(.fa-mobile-screen-button)", title: /*t*/"Accounts already made",
          content: /*t*/"A player who already has a mobile account shows it here; only its Map box can be changed. To delete one, use Configure Players." },
        { id: "save", sel: "button[data-action='create']", title: /*t*/"Save", direction: "UP",
          content: /*t*/"Creates the ticked accounts and saves the Map boxes." },
        { id: "login", title: /*t*/"On the phone",
          content: /*t*/"The player opens your game's address in the phone's browser and logs in as \"Name (Mobile)\" with that password. The phone's map is switched off for them (unless Map is ticked) and the VooDoo window fills the screen; its Settings has a tour of the window.\nMobile accounts show in the player list with a phone icon; the setting Hide mobile accounts in the player list leaves them out." },
      ] });
    return;
  }

  // The phone window: open on a view before a step (the window stays open the whole time)
  const view = (v) => async () => { const w = win(); if (w && w.view !== v) { w.closeSheet?.(true); w.show(v); await wait(() => !w.el?.querySelector(`.axs-view[data-view="${v}"]`)?.hidden); } };
  const map = !!win()?.mapOn;
  R({ module: MOD, id: "phone", app: "ax-voodoo", gm: false,
    title: /*t*/"VooDoo: The phone window", description: /*t*/"Your character sheet, chat and combat on the phone.",
    open: async () => { win()?.closeSheet?.(true); },
    steps: [
      { id: "who", sel: ".axs-who", title: /*t*/"Your character", direction: "DOWN", before: view("character"),
        content: /*t*/"The character shown, and the scene it is on. Tap to switch characters if you have more than one. On a GM's phone, tap to choose any creature or NPC." },
      { id: "menu", sel: "[data-action='menu']", title: /*t*/"Menu", direction: "DOWN",
        content: /*t*/"Axecleft's tools, the journal and items, the shops on this scene, and the macros on your hotbar." },
      { id: "wake", sel: "[data-action='wake']", title: /*t*/"Keep the screen on", direction: "DOWN",
        content: /*t*/"Stops the phone going to sleep while you play." },
      { id: "settings", sel: "[data-action='settings']", title: /*t*/"Settings", direction: "DOWN",
        content: /*t*/"The Map view on or off, who sees your rolls (roll mode), and this tour." },
      { id: "tabs", sel: ".axs-view[data-view='character'] .axs-tabs", title: /*t*/"The character's tabs", direction: "DOWN", before: view("character"),
        content: /*t*/"Stats, saves, skills, attacks, spells, inventory, feats, buffs and notes. The strip scrolls sideways, and you can swipe the page left or right to move between tabs." },
      { id: "roll", sel: ".axs-view[data-view='character'] .axs-content", title: /*t*/"Tap to roll", direction: "UP",
        content: /*t*/"Tap an ability, save, skill, attack or spell to roll or use it at once. Press and hold for D35E's roll options first (a bonus, Take 10, optional feats). The ⓘ button shows an item's details." },
      { id: "party", sel: ".axs-view[data-view='party'] .axs-content", title: /*t*/"Party", direction: "UP", before: view("party"),
        content: /*t*/"Everyone in the party with their hit points and buffs. Tap one to see more." },
      { id: "chat", sel: ".axs-view[data-view='chat'] .axs-filters", title: /*t*/"Chat", direction: "DOWN", before: view("chat"),
        content: /*t*/"The game's chat. Show all of it, or only rolls, damage and healing, or whispers." },
      { id: "send", sel: ".axs-send", title: /*t*/"Send a message", direction: "UP",
        content: /*t*/"Type a message and send it. Chat commands work too: /roll 1d20, /w GM …" },
      { id: "combat", sel: ".axs-view[data-view='combat'] .axs-content", title: /*t*/"Combat", direction: "UP", before: view("combat"),
        content: /*t*/"The turn order. Roll initiative, and end your turn when it is yours. On a GM's phone: start the combat, roll for NPCs and move the turns." },
      ...(map ? [{ id: "map", sel: ".axs-view[data-view='map']", title: /*t*/"Map", direction: "UP", before: view("map"),
        content: /*t*/"The scene: tap a token to target it and place spell areas. Press and hold a token to open it; keep holding and drag your own token to move it." }] : []),
      { id: "bottom", sel: ".axs-bottom", title: /*t*/"Views", direction: "UP", before: view("character"),
        content: map ? /*t*/"Switch between Character, Party, Chat, Combat and Map here. A number on Chat counts the messages you haven't seen." : /*t*/"Switch between Character, Party, Chat and Combat here. A number on Chat counts the messages you haven't seen." },
    ] });
}

/** Start the phone window's tour from the beginning. */
export async function startPhoneTour() {
  const tour = game.tours?.get?.(`${MOD}.phone`);
  if (!tour) return false;
  try { await tour.reset(); } catch (e) { /* never started */ }
  await tour.start();
  return true;
}
