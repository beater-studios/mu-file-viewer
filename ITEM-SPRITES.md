# MU Online Item Sprite Mapping

This document explains how item sprite filenames map to in-game items in the `muonlinejs` project.

## Filename Pattern

```
item_{group}_{index}_{level}[_e|_a].png
```

| Part | Description | Values |
|------|-------------|--------|
| `group` | Item category | 0–15 |
| `index` | Item ID within group | 0–n |
| `level` | Visual level tier | 0, 3, 5, 7, 9, 11, 13, 15 |
| `_e` | Excellent variant | Optional |
| `_a` | Ancient variant | Optional |

### Example

`item_0_5_7_e.png` → Group 0, Index 5, Level 7, Excellent

Looking up Group 0 / Index 5 in `items.json` → **Blade** (Excellent, Level 7–8 appearance)

## Item Groups

| Group | Category | Examples |
|-------|----------|----------|
| 0 | Swords | Kris, Short Sword, Rapier |
| 1 | Axes | Small Axe, Hand Axe, Double Axe |
| 2 | Maces | Mace, Morning Star, Flail |
| 3 | Spears | Light Spear, Spear, Dragon Lance |
| 4 | Bows | Short Bow, Bow, Elven Bow |
| 5 | Staves | Skull Staff, Angelic Staff, Serpent Staff |
| 6 | Shields | Small Shield, Horn Shield, Kite Shield |
| 7 | Helms | Bronze Helm, Dragon Helm, Pad Helm |
| 8 | Armor | Bronze Armor, Dragon Armor, Pad Armor |
| 9 | Pants | Bronze Pants, Dragon Pants, Pad Pants |
| 10 | Gloves | Bronze Gloves, Dragon Gloves, Pad Gloves |
| 11 | Boots | Bronze Boots, Dragon Boots, Pad Boots |
| 12 | Wings | Wings of Fairy, Wings of Angel, Wings of Satan |
| 13 | Pets | Guardian Angel, Satan, Horn of Unicorn |
| 14 | Consumables | Apple, Small Healing Potion, Healing Potion |
| 15 | Scrolls / Other | Scroll of Poison, Scroll of Meteorite, Scroll of Lighting |

## Level Tiers

Item levels 0–15 are normalized into 8 visual tiers. Each tier has its own sprite with progressively brighter/enhanced appearance:

| Tier | Item Levels | Visual |
|------|-------------|--------|
| `_0` | 0–2 | Base appearance |
| `_3` | 3–4 | Slightly enhanced |
| `_5` | 5–6 | Enhanced |
| `_7` | 7–8 | Bright |
| `_9` | 9–10 | Brighter |
| `_11` | 11–12 | Very bright |
| `_13` | 13–14 | Near max |
| `_15` | 15 | Maximum glow |

## Quality Variants

Each item can have up to 3 sprite variants:

- **No suffix** — Normal item
- **`_e` (Excellent)** — Has bonus attributes (life steal, mana recovery, extra damage, etc.)
- **`_a` (Ancient)** — Belongs to a set with set bonuses when wearing multiple pieces

Not all items have all variants. Ancient variants exist only for certain groups (mainly equipment that can be part of a set).

## Database File

The complete item-to-name mapping is in:

```
muonlinejs/src/common/items.json
```

Each entry contains:

```json
{
  "Group": 0,
  "Index": 5,
  "ItemName": "Blade",
  "X": 1,
  "Y": 3,
  "DmgMin": 21,
  "DmgMax": 27,
  "Durability": 30,
  "RequiredLvl": 36,
  "szModelName": "sword06.glb"
}
```

To find a specific item's sprite: look up its `Group` and `Index` in `items.json`, then construct the filename as `item_{Group}_{Index}_{level}[_e|_a].png`.

## Stats

- Total sprite files: **8,144**
- Base sprites: 3,839
- Excellent variants (`_e`): 3,461
- Ancient variants (`_a`): 844
