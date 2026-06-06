# Product Description Image Modules

Use these modules for Shopee product detail images or a long description visual. These are separate from the 6-9 listing gallery images.

## Recommended Module Sequence

1. `opening_benefit`: one clear buyer problem and product promise.
2. `usage_scenarios`: where and when the product is used.
3. `core_features`: 3-4 factual feature callouts.
4. `specifications`: dimensions, material, color, weight, charging, capacity, or care facts.
5. `package_contents`: what buyers receive.
6. `how_to_use`: 3-5 simple steps when relevant.
7. `care_or_notes`: cleaning, charging, compatibility, safety, or limitations.
8. `faq`: short answers to likely buyer doubts.

## Module Object

```json
{
  "module_type": "core_features",
  "goal": "Explain why the product is useful.",
  "layout": "Product cutout plus 3 icon callouts.",
  "headline": "",
  "body_copy": [],
  "image_direction": "",
  "generation_prompt": "",
  "requires_confirmed_specs": [],
  "compliance_note": ""
}
```

## Copy Rules

- Keep headlines short enough for mobile.
- Use simple English for Shopee Singapore unless the user requests another language.
- Use facts from input. Do not invent runtime, capacity, certification, waterproof level, suction power, compatibility, or warranty.
- If text will be placed on image, prefer adding it later in a design layer instead of relying on image generation to render text accurately.

## Example Modules For Mini Desk Vacuum

| Module | Example headline |
|---|---|
| `opening_benefit` | Clean small desk mess in seconds |
| `usage_scenarios` | For keyboards, study desks, and home office corners |
| `core_features` | Compact, rechargeable, easy to store |
| `specifications` | Confirm dimensions before final artwork |
| `package_contents` | Mini desk vacuum only, unless accessories are confirmed |
| `care_or_notes` | Empty dust bin regularly and keep charging port dry |
