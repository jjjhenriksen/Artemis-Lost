# NPC Override Convention

Use this file when a single NPC's behavior, condition, or revealed information needs to override baseline vault seed data without rewriting a source profile.

## Format

```md
## npc-id
- status: active | resolved
- appliesFromTurn: 3
- summary: Short replacement or additive note
- behavior: How the DM should portray them now
- secretsRevealed: Any secret now considered public or role-visible
```
