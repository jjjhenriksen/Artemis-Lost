# Project Journal

This file is a readable export of the repository history as of 2026-04-03.

It is intended to be easier to hand to a teammate, judge, or language model than a raw `git log` dump.

## High-Level Timeline

### Foundation

The repository started with several initial bootstrap commits, then quickly moved into team-planning and documentation setup.

Key themes:
- initial repo scaffolding
- team-responsibility documents
- first-pass project documentation

### UI Refactor And Structure

The next wave split the interface into focused components and pulled shared logic out of a single large UI file.

Key themes:
- component extraction
- state/filter module extraction
- styling refactor
- deduplication of turn-handling logic

### Session And Menu Systems

The project then grew from a single-screen prototype into a full application flow with saves and front-door navigation.

Key themes:
- session persistence
- vault-backed prompts
- main menu
- character creation
- multi-slot save system
- continue/load/delete flows

### Model Integration

The DM backend was switched from Anthropic to OpenAI, and the prompt/session path was hardened around that integration.

Key themes:
- OpenAI migration
- prompt and server updates
- runtime stability improvements

### Themes And Visual Identity

The UI then gained a full theming layer, renamed themes, and ambient visual polish.

Key themes:
- theme registry and picker
- stronger contrast and unified styling
- atmospheric background treatment

### Instrumentation And Systems Depth

The project shifted from “narrative UI” toward “instrumented mission simulator.”

Key themes:
- typed event log
- mission elapsed time handling
- character banks
- crew dynamics
- mission seeds
- seed templating
- autonomous crew-role support

## Feature Milestones

### Planning And Docs

- team responsibilities added
- teammate prompt files created
- docs folder introduced
- README expanded

### Core Refactor

- UI split into smaller components
- world-state helpers extracted
- shared CSS consolidated

### Persistence

- vault-backed session persistence added
- menu and character creation introduced
- multi-slot save/load/delete support added

### Runtime And Prompting

- Anthropic replaced with OpenAI
- narrower vault-context selection added
- event-log typing and prompt expectations strengthened

### Character And Scenario Systems

- bank-driven character generation added
- crew dynamics inferred from generated and authored profiles
- mission seeds introduced
- seeded text resolved against actual launched crew names
- scenario metadata expanded with tone, decision pressure, and suggested opening

### Flexible Participation

- each crew role can be human- or autonomously controlled
- autonomous roles auto-play through the same DM pipeline
- underfilled games are now supported without changing the turn model

## Contributor Snapshot

Commit counts by author:

- Jacqueline Henriksen: 29 commits
- DerekVov: 4 commits
- ShieldWo1f: 4 commits
- halbyor: 2 commits

This is only commit count, not a complete measure of effort, but it gives a quick top-line view of who touched the repository most often.

## Complete Commit History

Chronological list, oldest to newest, with author and change footprint:

```text
2026-04-03  5157ecc  Jacqueline Henriksen  Initial commit  (+1 / -0)
2026-04-03  4151ed7  Jacqueline Henriksen  Initial commit 2: electric boogaloo  (+3 / -1)
2026-04-03  8334246  Jacqueline Henriksen  Initial commit  (+533 / -0)
2026-04-03  ae9e3fc  Jacqueline Henriksen  Add team responsibilities for each hackathon  (+158 / -0)
2026-04-03  1ff9713  Jacqueline Henriksen  Adds specific teammate responsibilities  (+369 / -0)
2026-04-03  e169940  Jacqueline Henriksen  Add documentation and expand README  (+271 / -1)
2026-04-03  4745afb  DerekVov  Add Folder  (+286 / -65)
2026-04-03  94c5d77  Jacqueline Henriksen  Split UI into components and extract state/filters  (+638 / -276)
2026-04-03  4a94ac7  ShieldWo1f  Codex does some stuff  (+1138 / -0)
2026-04-03  55b1fad  Jacqueline Henriksen  Add README run instructions and update Vite config  (+3276 / -0)
2026-04-03  242f938  halbyor  codex Changed the UI  (+263 / -89)
2026-04-03  467a504  DerekVov  Teamate_1.md  (+70 / -21)
2026-04-03  bc9b52c  Jacqueline Henriksen  Refactor UI styling and deduplicate turn handling  (+641 / -417)
2026-04-03  8f09606  ShieldWo1f  Completed Part 2  (+615 / -142)
2026-04-03  ce6998b  Jacqueline Henriksen  Add session persistence and vault-backed prompts  (+637 / -250)
2026-04-03  52910c2  Jacqueline Henriksen  Add session persistence and vault-backed prompts  (+6 / -4)
2026-04-03  6528232  Jacqueline Henriksen  Add character creation, menu, and session saves  (+859 / -195)
2026-04-03  d5b4c38  halbyor  added coments  (+245 / -45)
2026-04-03  de465c4  Jacqueline Henriksen  Add multi-slot save system and UI  (+626 / -122)
2026-04-03  39ddecb  Jacqueline Henriksen  Merge branch 'main' of https://github.com/jjjhenriksen/DungeonMAIster  (+0 / -0)
2026-04-03  4d9233d  DerekVov  added comments  (+13 / -0)
2026-04-03  dbe30c0  ShieldWo1f  UI Aspect ratio fix?!?!?!?!??!?! Hopefully  (+40 / -26)
2026-04-03  6b1b13e  ShieldWo1f  Less lag?  (+297 / -19)
2026-04-03  0a4c77d  Jacqueline Henriksen  Switch DM integration from Anthropic to OpenAI  (+355 / -313)
2026-04-03  db6fae3  Jacqueline Henriksen  Merge branch 'main' of https://github.com/jjjhenriksen/DungeonMAIster  (+0 / -0)
2026-04-03  0f0d02b  Jacqueline Henriksen  Add continue slot UI and vault context refactor  (+180 / -48)
2026-04-03  22367bc  Jacqueline Henriksen  Update .gitignore  (+6 / -0)
2026-04-03  ab78354  Jacqueline Henriksen  Remove vault/dynamic session artifacts  (+0 / -653)
2026-04-03  8a70e96  Jacqueline Henriksen  Remove Shroud Reef vault content  (+0 / -334)
2026-04-03  c743e89  DerekVov  fixing errors teamate_1.md  (+17 / -4)
2026-04-03  f332423  Jacqueline Henriksen  Add theming support and ThemePicker  (+678 / -110)
2026-04-03  75dc807  Jacqueline Henriksen  Add ambient UI visuals and rename themes  (+120 / -9)
2026-04-03  b716c1f  Jacqueline Henriksen  Add ambient shell overlays and sweep animation  (+55 / -6)
2026-04-03  d081a58  Jacqueline Henriksen  Add event type enums, tags, and MET handling  (+260 / -10)
2026-04-03  dde32d6  Jacqueline Henriksen  Add character banks and Reroll Crew feature  (+169 / -11)
2026-04-03  c877619  Jacqueline Henriksen  Add crew dynamics and tag-based character selection  (+372 / -35)
2026-04-03  e5c9b45  Jacqueline Henriksen  Add mission seeds, reroll locks, and UI tweaks  (+491 / -80)
2026-04-03  03fc013  Jacqueline Henriksen  Resolve mission seed templates and display details  (+157 / -14)
2026-04-03  1ee16f6  Jacqueline Henriksen  Add autonomous bot turns and controller support  (+664 / -276)
```

## Regenerating This File

If you want to regenerate the raw chronological commit list later, run:

```bash
git log --date=short --reverse --pretty=format:'%ad  %h  %s'
```

If you want a raw full-history export with diffs:

```bash
git log -p --date=iso > commit-history-with-diffs.txt
```
