# Axecleft's VooDoo
Your D35E (D&D 3.5) character sheet on your phone, for Foundry VTT. Named after the voodoo doll: from the phone in your hand, you move your character in the game world.

The GM gives each player a **mobile account**. Logging in with it from a phone's browser opens a full-screen window built for touch: the character sheet, chat and combat, with no map unless you turn the **Map** on for that account (to target tokens and place spell areas by touch). A mobile account always has the same characters as the player's main account.

## Setting up (GM)
1. **Configure Settings → Axecleft's VooDoo → Create mobile accounts** (or the Axecleft's Tools menu → **Mobile accounts**).
2. Tick the players who need mobile access, type a password for each, tick **Map** for those who should have one, and press **Save**. The same pop-up turns the map on or off for existing mobile accounts.
3. Each becomes **"Name (Mobile)"**, linked to the player's account. It gets the same ownership of every character and macro, and keeps it as you change ownership later. It starts on the player's assigned character.
4. The player opens your Foundry address on their phone, picks their mobile account, and logs in.

- Mobile accounts show in the player list with a phone icon. **Hide mobile accounts in the player list** leaves them out.
- To remove one, delete it in **Configure Players**; VooDoo unlinks it from the player.
- **The GM can have one too:** the pop-up lists GM accounts as well. A GM's mobile account is an **Assistant GM**, so it sees every actor but never takes over from the GM's own account while that one is logged in (Foundry picks the logged-in user with the highest role).

## On the phone
- **Tap to roll, press and hold for options.** A tap rolls an ability, save, skill or attack, casts a spell or uses an item straight away. Pressing and holding opens D35E's own roll options (situational bonus, Take 10 / Take 20, Power Attack and other optional feats, roll mode) in a phone-sized panel.
- **The map is off** on a phone logged in with a mobile account (Foundry's own per-browser setting), so it loads fast and saves battery. If the same browser later logs in with a normal account, the map is switched back on.
- **Map (optional, per mobile account):** turned on by the GM in the Mobile accounts pop-up, or by the player with the gear button at the top of the window (the page reloads). The bottom bar gets a **Map** button showing Foundry's own map, made for touch:
  - drag to move the map; pinch, or the + and − buttons, to zoom; **My character** finds your token;
  - **tap a token to target it**, tap again to untarget; your targets show under the map (tap one to drop it), everyone sees them, and D35E's attacks and spells use them;
  - when a spell asks where its area goes, the window switches to the map by itself: tap or drag where it goes, turn it with the arrow buttons (cones, lines), then **Place** or **Cancel**. D35E places it and finds its targets as on a computer;
  - **the eye button:** the map sees as your character (darkvision, low-light vision, its light), as when you select your token on a computer; tap it to see through all your tokens instead (the GM: the whole map);
  - **opening a merchant or loot:** press and hold its token (any token you may look at opens its sheet);
  - **moving:** press and hold your token, keep holding and drag it where it goes; it lands on the grid space under your finger. Players move only their own tokens and walls stop them; the GM moves any token. The map stops drawing while another view is showing, to save the battery.
- **Bottom bar:** Character, Party, Chat, Combat. The Combat button lights up during a combat and pulses on your turn.
- **Character tabs:** Stats, Saves, Skills, Attacks, Spells (with prepared counts and slots left), Inventory (coins, an equip switch, usable items), Feats & Features, Buffs & Conditions (switches) and Notes (plain text; the phone can edit them). Tap a name with an ⓘ to read its description.
- **Party:** D35E's Party HUD on the phone: every character marked **Party Member** (D35E actor settings), whatever your permission on it (your own first), with its portrait (or token image, by D35E's Party HUD setting), an HP bar (numbers on characters you can observe; Dying or Dead below 0), and its active buffs. Tap one of your own to play it; tap another to list its buffs.
- **Chat:** All, Rolls, Damage/Healing and Whispers filters, and a box to send messages and chat commands (`/roll 1d20+5`, `/w GM …`). Your own rolls also show a short result at the top while you're on another tab, and the Chat button counts new messages.
- **Combat:** the initiative order with the current turn marked, **Roll initiative** for your characters that haven't rolled, and **End turn** on your turn.
- **Character:** tap your character's name at the top to switch characters (chat cards then show the new one). The tabs across the top scroll sideways; you can also swipe the page left or right.
- **Menu (☰):** Shops and loot (merchants, loot piles and party storage open to you), Tools (My Traps, Crafting and other one-click buttons a player may use), Sidebar (Journal, Items, Compendiums, Roll Tables) and Hotbar (your macros, page by page; add, remove, or copy your desktop hotbar).
- **The scene** shows under your character's name, with whether your character is on it.
- **Keep the screen on:** the phone button at the top right (beside the ☰ menu), lit while it's on. Browsers only allow it when Foundry is opened over `https://`.
- **Lost connection:** the window shows *Reconnecting…* and reloads once the server answers again, including after the phone was asleep.
- Add the page to the phone's home screen to open it like an app.

## Status
Development version (steps 1 and 2 of DESIGN.md): mobile accounts and sync, and the phone window with every Character tab, Chat and Combat.

## GM phone
On a GM's mobile account the window runs creatures and NPCs:
- **Choose a creature** (tap the name at the top): the combat's combatants, the tokens on the scene (unlinked creatures are their own token's creature), the player characters, and a search of every actor. On the Combat tab, tapping a combatant plays it.
- Everything a player can do from the phone works for the creature picked: rolls, attacks, spells, items, buffs, the Map's targets and spell areas.
- **Hit points:** type an amount under the hit point bar and press **Damage** (temporary hit points go first) or **Heal** (up to the maximum).
- **Map:** press and hold a token to play it; keep holding and drag to move it (it lands on the grid space under your finger). A tap still targets.
- **Combat:** **Roll NPCs** (initiative for the creatures no player owns), **Begin combat**, **Next turn** and **Previous turn**.
- **Roll mode** (the gear button, any phone): who sees the phone's rolls, Foundry's own roll mode for that device.

## Changelog
### 1.11.4.7
- **One link installs the whole suite.** Every Axecleft module now recommends all the others (Gemstones, Armory, Curios, Traps, Adventurers and Minions, Hoard Editor, Printable Sheets, VooDoo and the Tools Suite manager), so installing any one of them offers to install the rest.
- Ships Axecleft's Tools 9.74: **Help on hover**. In a window that has a tour, turn on **Help on hover** in its title bar's **Help** button and rest the mouse on a part of the window to see that part's tour text.
- **Picking a spot on the map for other modules.** Setting a trap from a kit on the phone did nothing: the trap asked for a click on the map, and VooDoo's touch layer covers the map. Now the view switches to the Map and asks you to tap the spot (drag still moves the map; Cancel gives up), then goes back to where you were. Axecleft's Traps, Poisons, and Diseases uses it; other modules can too (API: `canPick()`, `pickPoint({ prompt })`).
- **Back to the Chat after a crafting request.** Sending a crafting request to the GM left the crafting window over the Chat, where the checks are rolled. The window now closes and the phone shows its Chat (Axecleft's Crafting 1.98; API for other modules: `showView(view)`).
- The phone's **Tools** menu no longer lists a tool twice when its module has a button both in Axecleft's Tools and in the scene controls (the Performance Monitor, Adventurers and Minions).
### 1.11.4.6
- **Hotbar on the phone.** The menu's Hotbar can now be filled from the phone: **Add a macro** (the macros on your desktop account's hotbar first, then every macro you can run, with a search) puts it in the first empty slot of the page shown, **×** takes one off, and **Copy my desktop hotbar** puts your desktop account's macros in the same slots. Mobile accounts now get the same ownership of macros as their player (a macro made by dragging an item to the hotbar belongs to that player alone), so the phone can run them.
- **Token Action HUD** no longer shows its bar over the VooDoo window on a mobile account (it did nothing there). VooDoo keeps it off for mobile accounts only; the same browser logged in as a normal account still has it, and Token Action HUD's own settings are left as they are.
### 1.11.4.5
- Foundry v11: item descriptions and notes show their links and rolls (they showed the raw text), and a token dragged on the map lands on its space on any grid. With the Map on, Foundry's sidebar, scene list and player list stay hidden behind the window (they showed over the map, and the sidebar's collapse button couldn't be reached), and the low resolution warning is stopped earlier. The tours and the Mobile accounts pop-up no longer say the phone can't move tokens (a held and dragged token moves). One code for both versions: Axecleft's VooDoo for Foundry v11 is made from it.
### 1.11.4.4
- **Tours.** **VooDoo: Mobile accounts** (GM, in Configure Settings → Tour Management) walks through creating the players' mobile accounts. **VooDoo: The phone window** walks a player (or the GM's phone) through the window: the character and menu at the top, the character's tabs, tap to roll and hold for options, Party, Chat, Combat and Map. Start it from the phone's **Settings → Take a tour of this window**; the first time a phone opens the window, a note says where it is.
- Map: the help under the map is one line (**Tap: target · Hold: open or move**); the **?** beside it shows the full instructions, and × folds them again.
- The **keep the screen on** button is a phone icon (the sun looked too much like the settings gear).
- Ships Axecleft's Tools 9.72: searchable lists can have headings that divide them.
### 1.11.4.3
- Map: **My character** and **Clear targets** fit their buttons on a phone (the words wrap onto two lines; on phone-size screens the icons give way to the words).
### 1.11.4.2
- Fixed: a journal opened on the phone was wider than the screen and its close button was off the right edge (Foundry gives journals a minimum size of 680 × 680). Every window opened on the phone now keeps to the screen's width and height, its title shortens instead of pushing the buttons out, and a journal's page list starts folded (tap its button to open it).
### 1.11.4.1
- **Opening a merchant, a loot pile or party storage from the phone:**
  - **Menu → Shops and loot:** the merchants and loot piles on the scene being viewed, and party storage, that are open to you; tap one to open its sheet (no map needed).
  - **Map:** press and hold a token you don't own to open its sheet when it's open to you (a merchant's shop, a loot pile, another character you may look at). Your own tokens still move as before. The GM's phone: holding a merchant or loot token and letting go opens it; dragging still moves it.
### 1.11.4.0
- **Menu** (the ☰ button at the top): what the left- and right-hand menus and the hotbar give a player on a computer.
  - **Tools:** the one-click buttons of the scene controls a player may use: Axecleft's Tools (My Traps, Crafting and the rest, as in the toolbox menu) and other modules' buttons. Buttons that work by clicking on the map are left out.
  - **Sidebar:** Journal, Items, Compendiums and Roll Tables, opened at the phone's width (more can be added later).
  - **Hotbar:** the account's macros, page by page (1 to 5); tap one to run it, **×** to take it off. **Add a macro** fills the first empty slot on the page (your desktop hotbar's macros are listed first); **Copy my desktop hotbar** copies your desktop account's macros into the same slots.
- **The scene** under the character's name: the scene being viewed (with no map, the one the player's main account is on, else the active scene) and whether the character is there (red: "isn't here", or the scene it's on). A change of scene shows "Now on: …".
### 1.11.3.2
- Fixed: with Axecleft's Hoard Editor switched off, the phone window found no character and showed every view at once (Foundry v14 throws when a module that's off is asked for its flag). The window now reads that mark safely, and a failure finding the character no longer breaks the whole window.
### 1.11.3.1
- Each account keeps its own phone choices (last tab and view, picked creature, map eye), so several mobile accounts can share one phone without mixing them up.
### 1.11.3.0
- **Moving tokens from the phone, for everyone:** on the Map, press and hold a token, keep holding and drag it to where it goes. Players move only their own tokens, and walls stop them (as Foundry's own movement rules do, a paused game too); the GM moves any token freely. Holding your own token also makes it the character you play.
### 1.11.2.2
- **GM phone, Map:** press and hold a token to play it (it becomes the creature picked and the selected token); keep holding and drag to move it. It lands on the grid space under your finger. Players still can't move tokens.
### 1.11.2.1
- **Map vision:** the Map sees as the picked character: its token is controlled on the phone, so Foundry draws its darkvision, low-light vision and light, as on a computer when you select your token (a GM's phone saw no token's vision at all). The eye button on the Map turns it off (a player then sees through all their tokens, the GM the whole map). The token still can't be moved from the phone.
### 1.11.2.0
- **GM phone:** the GM can have a mobile account too (an Assistant GM). On the phone it picks any creature or NPC from the combat, the scene or a search, changes hit points (Damage / Heal), rolls NPC initiative and runs the turns. Tap a combatant on the Combat tab to play it.
- **Roll mode** in the phone's settings (the gear button), for players and the GM.
### 1.11.1.1
- Targets from the Map now reach attacks and spells cast with a tap. D35E reads the targets from its attack window, which a tap used to skip; with targets the window opens and VooDoo presses its Roll button, so it's still one tap.
### 1.11.1.0
- **Map** for mobile accounts that want it (off by default; the GM ticks it in the Mobile accounts pop-up, or the player turns it on with the new gear button): a Map view on the bottom bar to target tokens by tapping them and to place spell areas by touch (tap or drag, turn, Place). It uses Foundry's own map and D35E's own targeting and area placement. Tokens can't be moved from the phone.
### 1.11.0.9
- Renamed **Axecleft's VooDoo** (was Axecleft's Sendings): like a voodoo doll, the phone moves the character in the game world. Mobile accounts linked under the old name keep their links.
### 1.11.0.8
- A portrait or icon whose image file is missing shows Foundry's silhouette instead of an empty box.
### 1.11.0.7
- The Party tab lists every Party Member, not only characters the player has permission on (D35E's own HUD needs Limited). Hit point numbers still show only on characters the player can observe; the others show the bar.
### 1.11.0.6
- New **Party** tab on the bottom bar: D35E's Party HUD at phone size (portraits, HP bars, Dying/Dead, active buffs), kept up to date as hit points and buffs change.
### 1.11.0.5
- Chat filters: **Damage/Healing** finds D35E's attack, damage and healing cards by the card D35E made (its template and its attacks' damage), so it no longer misses them. **Rolls** also includes D35E's attack, skill and save cards. The GM tab is gone (GM whispers are under Whispers).
### 1.11.0.4
- The small-screen warning no longer flashes on mobile accounts at login or while typing: it's taken out of the page before the screen is drawn.
### 1.11.0.3
- Foundry's small-screen warning ("requires … 1024px by 768px") no longer shows on mobile accounts; other accounts still get it.
### 1.11.0.2
- Step 2: every Character tab (Saves, Skills, Attacks, Spells, Inventory, Feats & Features, Buffs & Conditions, Notes), Chat with filters and a send box, and Combat with Roll initiative and End turn. Tap to roll or use; press and hold for D35E's roll options on a phone-sized panel.
### 1.11.0.1
- First development version (step 1).
