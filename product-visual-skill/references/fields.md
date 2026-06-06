# Field Guide

## Minimal Input

```json
{
  "product_name": "Mini desk vacuum",
  "product_category": "Home appliance / desk cleaning",
  "target_market": "Singapore",
  "platform": "Shopee",
  "source_image": "/path/to/product-photo.png",
  "product_description": "Small rechargeable vacuum for keyboard dust and desk crumbs"
}
```

## Full Input

```json
{
  "product_name": "Mini desk vacuum",
  "product_category": "Home appliance / desk cleaning",
  "target_market": "Singapore",
  "platform": "Shopee",
  "pack_mode": "balanced",
  "one_shot_generation": true,
  "source_image": "/path/to/product-photo.png",
  "product_description": "Small rechargeable vacuum for keyboard dust and desk crumbs",
  "visible_attributes": {
    "color": "white",
    "shape": "compact handheld cylinder",
    "material": "plastic",
    "charging": "USB rechargeable"
  },
  "supplier_specs": {
    "dimensions": "8.5 x 8.5 x 6.5 cm",
    "package_weight": "220 g",
    "charging": "USB rechargeable"
  },
  "included_items": [
    "mini desk vacuum",
    "USB charging cable"
  ],
  "use_cases": [
    "keyboard dust",
    "desk crumbs",
    "study desk cleaning"
  ],
  "selling_points": [
    "compact",
    "easy to store",
    "rechargeable"
  ],
  "brand_tone": "premium, clean, modern",
  "regional_style_override": "",
  "individual_image_size": "1024x1024",
  "contact_sheet_grid": "2x3",
  "local_context": [
    "HDB home office",
    "student desk",
    "compact living"
  ],
  "text_overlay": {
    "enabled": true,
    "max_words": 8,
    "preferred_language": "English"
  },
  "language_mode": "english",
  "image_model_capability": "high_text_fidelity",
  "text_rendering_mode": "hybrid",
  "must_avoid": [
    "brand logos",
    "exaggerated suction claims",
    "medical or safety claims",
    "extra accessories not in package"
  ],
  "model_policy": {
    "allow_model": true,
    "preferred_model_type": "hands_only"
  },
  "output_language": "English"
}
```

## Required Fields

| Field | Meaning | Example |
|---|---|---|
| `product_name` | Product name or short product idea | `Mini desk vacuum` |
| `product_category` | Product category | `Desk cleaning appliance` |
| `target_market` | Market to localize for | `Singapore`, `Philippines` |
| `source_image` or `product_description` | Either a product image or enough text to describe the product | `/tmp/vacuum.png` |

## Recommended Fields

| Field | Meaning |
|---|---|
| `platform` | Target ecommerce platform, usually Shopee |
| `pack_mode` | `fast`, `balanced`, or `premium` image pack |
| `one_shot_generation` | `true` when the user wants generated image output, not only prompts |
| `visible_attributes` | What the model must preserve from the real product |
| `supplier_specs` | Confirmed specs such as dimensions, weight, charging, capacity |
| `included_items` | What buyers will actually receive |
| `use_cases` | Real use scenes for the product |
| `selling_points` | Short benefits to guide the visual angle |
| `brand_tone` | Visual taste, such as premium, cute, minimal, tech, homey |
| `regional_style_override` | Optional user-provided regional visual direction |
| `individual_image_size` | Default `1024x1024`; use `2048x2048` for text-heavy infographics |
| `contact_sheet_grid` | Default by pack mode: `3x1`, `2x3`, or `3x3` |
| `local_context` | Market-specific settings or buyer habits |
| `must_avoid` | Things the image/copy should not claim or show |
| `language_mode` | `english`, `local`, or `bilingual` overlay copy mode |
| `image_model_capability` | `unknown` or `high_text_fidelity`; use high when using GPT Image 2 or similar |
| `text_rendering_mode` | `design_layer`, `direct_image_text`, or `hybrid` |

## Output Fields

```json
{
  "visual_strategy": "Premium compact home-office cleaning product for Shopee Singapore",
  "target_platform": "Shopee",
  "target_market": "Singapore",
  "pack_mode": "balanced",
  "one_shot_generation": true,
  "regional_style": {},
  "size_plan": {},
  "image_pack_plan": [],
  "one_shot_generation_prompt": "",
  "generated_or_planned_images": [],
  "asset_manifest": [],
  "product_description_modules": [],
  "model_requirements": [],
  "localized_copy": {
    "listing_title": "",
    "hero_caption": "",
    "selling_points": [],
    "image_overlay_copy": []
  },
  "localized_text_overlay_plan": {
    "language_mode": "english",
    "render_strategy": "design_layer",
    "text_rendering_mode": "design_layer",
    "image_model_capability": "unknown"
  },
  "overlay_copy_by_image": [],
  "estimated_generation_plan": {
    "image_count": 6,
    "first_render_order": ["cover_main", "premium_hero"],
    "generation_notes": []
  },
  "visual_compliance_notes": [],
  "missing_inputs": [],
  "editable_json": {}
}
```

## Selected Product Input

When this skill is used after SeaLaunch AI's Opportunity Board, prefer this richer input:

```json
{
  "selected_product": {
    "product_name": "Mini desk vacuum",
    "opportunity_status": "Go",
    "target_market": "Singapore",
    "target_platform": "Shopee",
    "positioning": "Compact desk cleaning for HDB home office and study desks",
    "recommended_price": "S$12.90",
    "risk_recommendations": [
      "Avoid exaggerated suction claims",
      "Confirm included accessories before making bundle visuals"
    ]
  },
  "supplier_specs": {},
  "source_product_images": [],
  "pack_mode": "balanced",
  "one_shot_generation": true
}
```
