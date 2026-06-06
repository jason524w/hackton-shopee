# Regional Style Presets

Use this file to localize the visual style of the whole image pack by target market.

## Core Rule

Every image pack should feel native to the target market while preserving the same product truth. Localize:

- Scene and home/desk environment
- Lighting and color temperature
- Props and lifestyle context
- Buyer value angle
- Language and text overlay style
- Model/hand representation when used

Do not localize by inventing platform features, fake certifications, local flags everywhere, or stereotypes.

## Singapore

Best for compact, efficient, premium-practical products.

- Scenes: HDB study desk, condo home office, compact apartment, tidy bedroom desk, small kitchen counter.
- Visual tone: clean, modern, bright, organized, space-saving, premium but practical.
- Lighting: bright natural daylight, soft shadows, clean white/warm-neutral backgrounds.
- Props: laptop, notebook, keyboard, minimalist stationery, small shelf, tidy home-office props.
- Buyer angle: space-saving, reliable, clean, efficient, good for small homes.
- Text style: English default; concise, polished, professional.
- Avoid: overly luxurious mansion scenes, clutter, dark cyber styling unless product category requires it.

## Malaysia

Best for gaming, electronics, home lifestyle, value-premium products.

- Scenes: Malaysian apartment/condo bedroom, gaming desk, student desk, family home, practical compact workspace.
- Visual tone: bold but accessible, value-conscious premium, energetic for gaming, warm for home products.
- Lighting: warm indoor light, RGB glow for gaming, daylight home scenes for lifestyle products.
- Props: gaming monitor without copyrighted UI, mouse pad, desk lamp, compact shelves, apartment bedroom setup.
- Buyer angle: performance for price, practical upgrade, compact setup, local gamer/student/home routine.
- Text style: English default for electronics/gaming; Malay or English+Malay for stronger local appeal.
- Avoid: copyrighted game screens, esports team logos, fake local badges, crowded promo-poster style.

## Philippines

Best for everyday upgrades, dorms, family homes, warm lifestyle products.

- Scenes: family home, dorm room, study table, compact apartment, daily routine setting.
- Visual tone: warm, friendly, accessible premium, practical, cheerful.
- Lighting: warm natural light, softer home textures, inviting shadows.
- Props: school supplies, family-home table, small storage items, friendly everyday context.
- Buyer angle: useful daily upgrade, value, easy to use, good for students/family.
- Text style: English default; optional English+Tagalog for friendly lifestyle packs.
- Avoid: overly luxury styling, cold corporate visuals, exaggerated claims.

## Indonesia

Best for value-conscious home, modest fashion, beauty, and electronics.

- Scenes: compact urban home, kost/dorm room, family living space, practical work desk.
- Visual tone: friendly, warm, practical, value-aware.
- Lighting: warm daylight, clean but not overly sterile.
- Props: daily home items, modest desk setup, compact storage.
- Buyer angle: good value, practical daily use, easy maintenance.
- Text style: Indonesian default; English optional for electronics/gaming.
- Avoid: too much English-only copy for mass lifestyle products.

## Thailand

Best for lifestyle, beauty, home, and colorful consumer goods.

- Scenes: condo room, bright bedroom, cafe-like desk setup, tidy home corner.
- Visual tone: polished, bright, friendly, slightly playful for lifestyle categories.
- Lighting: bright soft daylight, clean colorful accents.
- Props: neat lifestyle props, light wood, pastel or modern accents.
- Buyer angle: stylish everyday convenience, compact living, easy use.
- Text style: Thai default for local-first packs; English+Thai for tech/lifestyle.
- Avoid: dense text and dark-heavy palettes unless gaming category requires it.

## Vietnam

Best for compact home, student, beauty, and practical electronics.

- Scenes: compact apartment, student desk, family home, small work corner.
- Visual tone: clean, practical, modern, value-focused.
- Lighting: bright daylight, clean neutral backgrounds.
- Props: laptop, books, compact storage, practical home items.
- Buyer angle: useful, affordable upgrade, efficient daily use.
- Text style: Vietnamese default; English optional for gaming/electronics.
- Avoid: overly ornate or luxury-only positioning.

## Regional Output Object

```json
{
  "regional_style": {
    "target_market": "Malaysia",
    "scene_direction": "Modern Malaysian apartment gaming desk",
    "lighting": "dark desk with red RGB glow",
    "buyer_angle": "performance for compact gaming setups",
    "text_language": "English + Malay",
    "props": ["gaming monitor without copyrighted UI", "mouse pad", "desk lamp"],
    "avoid": ["esports team logos", "copyrighted game screens", "fake local badges"]
  }
}
```
