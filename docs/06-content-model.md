# Content Model (Foundational)

## Entities

- Class
- Character
- Rank
- RankTrial
- RankMutation
- Item
- Card
- Effect
- Enemy
- Encounter

## Item -> Card Relationship

- Items grant one or more cards
- Character deck is derived from equipped items
- Unequip removes granted cards from future draw pools

## Card Definition (MVP)

- id, name, tags
- cost (action/resource)
- target schema
- range and LOS
- effect list (ordered)
- rarity/source item

## Effect Definition (MVP)

- damage/heal
- movement/teleport
- status apply/remove
- tile/zone effects
- draw/discard modifiers


## Rank Model

- **Level**: incremental progression and baseline stat growth
- **Rank**: milestone evolution unlocking significant new capabilities
- **Rank Trial**: objective gate for rank-up eligibility (beyond XP)
- **Rank Mutation**: permanent branch choice taken during rank-up

## Rank-Up Definition (MVP+)

- rank id/name/tier
- unlock requirements (level + trial tags)
- offered mutations (2-3 choices)
- granted passives/cards/traits
- class restrictions (if any)
