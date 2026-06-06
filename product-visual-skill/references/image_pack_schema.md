# Image Pack Schema

Use this structure when generating a full Shopee-ready listing image pack.

## Pack Modes

```json
{
  "fast": ["cover_main", "premium_hero", "feature_infographic"],
  "balanced": [
    "cover_main",
    "premium_hero",
    "localized_lifestyle",
    "in_use_model_or_hand",
    "feature_infographic",
    "specification_size"
  ],
  "premium": [
    "cover_main",
    "premium_hero",
    "localized_lifestyle",
    "in_use_model_or_hand",
    "feature_infographic",
    "specification_size",
    "package_contents",
    "comparison_why_this",
    "variant_or_detail_closeup"
  ]
}
```

## Image Module Object

Each image should return:

```json
{
  "slot": 1,
  "image_type": "cover_main",
  "title": "Clean Shopee cover image",
  "buyer_question_answered": "What exactly am I buying?",
  "goal": "Make the product clear and click-worthy in search results.",
  "layout": "Centered product, full product visible, clean white or solid warm-light background.",
  "aspect_ratio": "1:1",
  "recommended_size": "1024x1024",
  "text_overlay": {
    "enabled": false,
    "copy": [],
    "design_layer_note": "Add text outside image generation only if platform/category allows."
  },
  "model_requirement": {
    "needed": false,
    "type": "none",
    "notes": ""
  },
  "product_truth_constraints": [
    "Preserve exact shape, color, material, proportions, and visible controls.",
    "Do not add accessories, logos, certifications, functions, or sizes not provided."
  ],
  "generation_prompt": "",
  "negative_prompt": "",
  "source_assets_needed": [],
  "compliance_note": "",
  "ready_to_generate": true
}
```

## Full Output Object

```json
{
  "visual_strategy": "",
  "target_platform": "Shopee",
  "target_market": "Singapore",
  "product_category": "",
  "pack_mode": "balanced",
  "regional_style": {
    "target_market": "Singapore",
    "scene_direction": "",
    "lighting": "",
    "buyer_angle": "",
    "text_language": "",
    "props": [],
    "avoid": []
  },
  "size_plan": {
    "individual_image_size": "1024x1024",
    "contact_sheet_grid": "2x3",
    "contact_sheet_output_size": "1024x1536",
    "individual_aspect_ratio": "1:1",
    "contact_sheet_aspect_ratio": "2:3",
    "text_safe_area": "central 80%; keep text 6% away from edges"
  },
  "image_pack_plan": [],
  "one_shot_generation": false,
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
    "primary_language": "English",
    "secondary_language": "",
    "render_strategy": "design_layer",
    "text_rendering_mode": "design_layer",
    "image_model_capability": "unknown",
    "language_reasoning": ""
  },
  "overlay_copy_by_image": [],
  "estimated_generation_plan": {
    "image_count": 6,
    "first_render_order": ["cover_main", "premium_hero"],
    "generation_notes": []
  },
  "visual_compliance_notes": [
    {
      "severity": "low | medium | high",
      "note": ""
    }
  ],
  "missing_inputs": [],
  "editable_json": {}
}
```

## Image Type Purposes

| Image type | Purpose | Typical text |
|---|---|---|
| `cover_main` | Search thumbnail and buyer trust | None |
| `premium_hero` | Perceived value and quality | Optional short caption |
| `localized_lifestyle` | Local context and use case | 3-6 words |
| `in_use_model_or_hand` | Usage, scale, or fit | 2-5 words |
| `feature_infographic` | Main benefits | 2-4 factual callouts |
| `specification_size` | Reduce uncertainty and returns | Dimensions, material, package info |
| `package_contents` | Clarify what buyers receive | "What is included" |
| `comparison_why_this` | Positioning and differentiation | Generic comparison only |
| `variant_or_detail_closeup` | Detail, texture, controls, variants | Short labels |

## Missing Input Rules

Flag missing inputs instead of inventing facts:

- Missing dimensions: generate a placeholder spec module plan but mark `ready_to_generate: false` for exact size labels.
- Missing package contents: do not create bundle or package image.
- Missing source image: create concept prompts only; do not claim exact preservation.
- Missing electrical specs: do not mention power, battery life, voltage, suction, certifications, or runtime.
- Missing material: describe only visible material, such as "white plastic-looking body".

## Overlay Copy Object

```json
{
  "slot": 5,
  "image_type": "feature_infographic",
  "language_mode": "bilingual",
  "render_strategy": "direct_image_text",
  "text_rendering_mode": "direct_image_text",
  "image_model_capability": "high_text_fidelity",
  "copy": [
    {
      "text": "Fast Response",
      "local_text": "Respon Pantas",
      "placement": "top-left callout",
      "priority": 1
    }
  ],
  "image_prompt_instruction": "Render these short labels directly with crisp readable typography, spelled exactly as provided."
}
```
