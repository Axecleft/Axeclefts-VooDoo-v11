# Axecleft's VooDoo — design

*Your character sheet on your phone.* A Foundry VTT module for the D35E system, part of Axecleft's Tool Suite.
Named after the voodoo doll: from the phone in your hand, you move your character in the game world. linking the phone to the table.

- Module id: `axeclefts-voodoo`
- Built first for Foundry v14 (version 1.14.x) in the v14-dev folder; v11 port (1.11.x) later.
- Ships the shared Axecleft's Tools (Tools menu, Patreon and Discord buttons, language files) like the rest of the suite.
- Version 1 is a **viewer that can act**: players use their sheet from the phone; they don't edit it.

---

## 1. Mobile accounts

### Creating them
- Configure Settings → Axecleft's VooDoo has a **Mobile accounts** button (GM only).
- It opens a pop-up listing the existing player accounts. The GM ticks the players who need mobile access, types a password for each, and presses **Create**.
- For each one the module creates a Player account named **"Name (Mobile)"**, linked to the main account.
- Players already linked show as having a mobile account; the pop-up doesn't make a second one.
- The module never reads or stores passwords. Foundry keeps them like any other account's, and the GM can change them later in User Configuration.

### Keeping them in sync
- **Character ownership:** the mobile account always has the same ownership as its main account on every character. The module updates it whenever ownership changes on an actor, or a new actor is created.
- **Assigned character:** copied from the main account when the mobile account is created. After that, the two choose characters separately (the phone switches only itself). Syncing both ways can be added later.

### Removing them
- The GM deletes a mobile account in User Configuration, as for any account.
- The module then clears the link on the main account, so the pop-up offers that player again.
- If a main account is deleted, the GM gets a notice that its mobile account still exists; the module deletes nothing by itself.

### Player list
- Mobile accounts show in the player list with a **phone icon** next to the name.
- A setting (on by default) can **hide mobile accounts** from the player list if it gets crowded.
- Other accounts (for example a battleboard display account) are untouched.

---

## 2. The mobile window

### Loading
- A mobile account logs in as usual, then loads straight into a **full-screen VooDoo window**. There's no choice to make and no Foundry screen behind it.
- The **game map is switched off** on that phone (Foundry's per-browser "disable canvas" option), set automatically the first time a mobile account logs in. The phone loads faster and uses less battery and memory.
- The window can be added to the phone's home screen to open full screen with its own icon.

### Layout
- **Bottom bar** (always visible, large buttons with icon and label): **Character**, **Chat**, **Combat**.
  - The Combat button lights up while a combat is running and pulses on the player's turn.
- **Top of Character:** character switcher (portrait and name; tap to choose another owned character).
- **Character tab strip** across the top, scrolling sideways with a finger (swiping the content also moves between tabs):
  **Stats** (abilities, HP, AC, speed, BAB, grapple) · **Saves** · **Skills** · **Attacks** · **Spells** · **Inventory** · **Feats & Features** · **Buffs & Conditions** · **Notes**
- **Chat** filter tabs across the top: **All** · **Rolls** · **Damage/Healing** · **Whispers** · **GM**, and a send box at the bottom.
  - Whispers and GM messages are sorted from Foundry's own message data (author, whisper targets).
  - Damage/Healing depends on how D35E marks its cards; to be checked against D35E's chat data before it's promised for every card.
- **Combat:** one view, no tabs. Initiative order, the current turn highlighted, the player's own characters marked; large **Roll initiative** and **End turn** buttons.

### Choosing a character
- Choosing a character on the phone sets it as the mobile account's character in Foundry.
- With no map on the phone, Foundry uses the account's character as the **chat speaker**, so cards show the chosen character.
- Rolls from the phone run on the chosen character directly.

---

## 3. What players can do

| Allowed from the phone | Not allowed (PC or GM only) |
|---|---|
| Roll abilities, saves, skills and attacks | Change ability scores, skill ranks, feats, classes, levels |
| Cast spells (D35E marks the slot or use spent) | Add or delete items or spells |
| Use consumables and charged items (D35E takes the charge or quantity) | Type in values or quantities by hand |
| Equip / unequip items | Change HP (**GM only**) |
| Turn buffs and conditions on and off | |
| Read and write **notes** (plain text) | |
| Roll initiative and **end their own turn** | |

Every action goes through D35E's own actions, exactly as clicking the PC sheet does.

### Rolling
- **Tap** a skill, save, ability or attack to roll straight away.
- **Long-press** to open D35E's roll options (situational bonus, take 10/20…) in a phone-sized window.

---

## 4. Touch and keyboard

### Touch
- Every button and tab is at least finger-sized (about 48 pixels, Android's own guideline).
- Taps instead of hovers: anything that's a hover tooltip on the PC becomes a tap or long-press.
- Key buttons have a label, not just an icon.
- Text is readable without zooming.

### On-screen keyboard
- When the keyboard opens, the window shrinks to the space left, the bottom bar hides while typing, and the box being typed in scrolls into view.
- Text boxes are sized so the phone doesn't zoom in when one is tapped.
- The right keyboard for each box:
  - **Numbers** open the number pad. Where a negative is possible, large **−** and **+** buttons save typing the sign (Android's number pad often has no minus key).
  - **Chat:** Enter shows **Send** and sends; `/roll 1d20+5`, `/w GM` and other chat commands work as in Foundry.
  - **Notes:** normal text with capitals and spell check; Enter adds a line.
  - **Search** (spells, inventory): Enter shows **Search**; auto-correct off so spell names aren't "corrected".
- Typing in the window never triggers Foundry's keyboard shortcuts.

### Physical keyboards
- Tablets with a Bluetooth keyboard and Chromebooks: Tab moves between fields, Enter confirms, Escape closes pop-ups.

---

## 5. Connection and screen

- **Keep screen awake:** a button in the window, the player's choice (uses the browser's screen wake lock).
- **Lost connection:** the Foundry server can't reach a phone that has dropped off, so reconnecting is done from the phone's side. While the window is open, the module watches the connection, shows **"Reconnecting…"**, retries, and reloads once the server answers. If Android has suspended the browser in the background, the check runs as soon as the player switches back to it.

---

## 6. The map (1.14.1)

An option per mobile account, off by default: **flags.axeclefts-voodoo.map**. The GM ticks it in the Mobile accounts pop-up; the player can switch it with the gear button at the top of the window. Either way the phone reloads.

- With the map, VooDoo leaves Foundry's map on for that phone (without, it switches it off as before). Foundry's own panels stay hidden; the VooDoo window covers the map except on the **Map** view, where it is see-through between its top and bottom bars.
- A touch layer covers the map: the phone never touches the canvas directly. **Moving tokens (1.14.3):** press and hold a token, keep holding and drag (a see-through copy follows the finger); on letting go it moves to the snapped grid space through Foundry's own movement (TokenDocument#move). Players take only tokens they own; their move is checked against walls first (Token#checkCollision) and Foundry's movement rules apply (walls, a paused game). The GM takes any token and moves it ignoring walls, as on a computer.
  - One finger drags the map; two fingers pinch to zoom; + and − buttons zoom; **My character** pans to the character's token.
  - **Tap a token to target it** (Foundry's own targets: everyone sees them, D35E reads game.user.targets for attacks and spells). The targets show as chips under the map; tap one to drop it; **Clear targets**.
- **Spell areas:** D35E's own template preview (pixi/ability-template.js) is driven by touch. VooDoo watches the template layer's preview; when D35E adds one, the window switches to the Map view and:
  - tap or drag puts the area there (D35E's own mouse-move handler, given the touch position);
  - the arrow buttons turn it (D35E's mouse-wheel handler, Shift steps);
  - **Place** is D35E's left click, **Cancel** its right click. D35E creates the template and finds the tokens in it, as on a computer.
  - Move area / Move map switch what one finger does while placing.
- Vision: Foundry draws what the controlled token sees, and a GM with no token controlled sees no token's vision. The picked character's token is controlled on the phone (the touch layer still never moves it); the eye button releases it.
- Battery: the map stops drawing (the canvas ticker) while another view is showing.

## 7. The GM's phone (1.14.2)

- The Mobile accounts pop-up lists GM accounts too. A GM's mobile account is created with the **Assistant GM** role: it sees and runs every actor, and Foundry's designated GM (the logged-in user with the highest role) stays the GM's own account while it is logged in, so the phone never does the world's GM bookkeeping then.
- The window knows it's a GM phone (game.user.isGM):
  - **Choose a creature** replaces the character list: the combat's combatants, the viewed scene's tokens, the player characters, and a search of every actor. A token is picked by its uuid, so an unlinked creature is that token's own actor. The pick is kept on the device.
  - The Combat tab: tap a combatant to play it; **Roll NPCs** (Foundry's rollNPC), **Begin combat**, **Next turn**, **Previous turn**.
  - Map: press and hold a token (550 ms) to play it and select it; keep holding and drag to move it (a see-through copy follows the finger; on letting go the token is moved to the grid space under it, snapped to the grid). Hidden tokens can be taken too.
  - Stats: **Damage** / **Heal** with an amount (temporary hit points first; healing up to the maximum).
- The settings panel (gear button) has **Roll mode** for every phone: Foundry's own per-device roll mode.

## 8. Menu and scene (1.14.4)

- **Menu** (☰ at the top): three sections in a panel from the bottom.
  - **Tools:** the scene controls' one-click buttons (button: true) a player may use. Axecleft's Tools come from its own list (AxecleftTools.available(), which knows what each user may use); other modules' buttons from Foundry's getSceneControlButtons hook, called on a blank set of groups (the phone has no scene controls drawn). Map-clicking tools (select, measure…) are left out.
  - **Sidebar:** Journal, Items, Compendiums, Roll Tables (Foundry's sidebar tabs as pop-outs, raised to the phone's width like every other window). Cards, Playlists and Settings can be added if needed.
  - **Hotbar:** game.user.getHotbarMacros(page), pages 1–5; tap runs the macro.
- **Shops and loot** (1.14.4.1): actors on Axecleft's Shop sheet (flags.world.axecleftShop or the sheet class) with tokens on the viewed scene, and every party storage, that the user has Limited on; tap opens the actor's sheet (raised like any window). On the Map, holding a token the player doesn't own opens its sheet when they have Limited; the GM's hold on a shop token opens it on release (dragging still moves it).
- **Scene line** under the character's name: canvas.scene when the map is on; with no map Foundry views no scene on the phone, so the main account's viewed scene (when it's logged in), else the active scene. It says whether the character has a token there, or which scene it's on. A change of scene is announced ("Now on: …"); checked on scene and token hooks and every 5 seconds (another user's view changes without a hook here).

## 9. Later (not in version 1)

- Editing the sheet (scores, skills, feats, items).
- Syncing the active character between the main and mobile accounts.
- Formatted notes.
- v11 port.
