---
name: product-visual-skill
description: Use when turning imported product fields, selected product opportunities, rough product photos, or supplier images into a Shopee-ready ecommerce image pack. Best for generating 6-9 listing images, cover images, lifestyle/model/in-use images, feature infographics, specification images, package-content visuals, product description modules, image-generation prompts, and lightweight visual compliance notes for Shopee or SEA markets.
---

# Product Visual Skill

## Goal

Turn a simple product input or selected SeaLaunch product opportunity into a marketplace-ready ecommerce image pack:

- A compliant Shopee cover image direction
- 6-9 gallery image modules for listing upload
- Regional visual style presets for different SEA markets
- Defined image size, contact-sheet, export, and text safe-area specs
- Product description image modules for the product detail area
- Localized text overlay plans for market-specific labels, captions, and infographic copy
- Model / hand / in-use requirements when useful for the category
- GPT image-generation or image-editing prompts for every image
- One-shot generated image-pack output when image generation/editing is available and requested
- Listing copy snippets that match the images
- A light review note for realism, claim risk, and missing product facts

This skill is the visual packaging layer of SeaLaunch AI. Do not run a full market, sourcing, margin, or commerce decision workflow unless the user asks. Assume the product has already been selected or is being prepared for visual launch.

When the user says "generate", "生成", "one shot", "直接出图", or asks for final listing images, do not stop at prompts. Produce the complete image pack in one generation pass first, then return the asset summary and editable prompts.

## Default Workflow

1. Read the imported product fields.
2. Identify the product's real visible attributes, specifications, included items, and claim limits.
3. Pick a regional style preset for the target market.
4. Build a size plan for individual images, contact sheet, and text-safe areas.
5. Choose one pack mode:
   - `fast`: 3 images, fastest demo path.
   - `balanced`: 6 images, recommended default.
   - `premium`: 9 images plus product description modules.
6. Build an image pack plan using the module library.
7. Build a localized text overlay plan:
   - Decide market language mode: English, local language, or bilingual.
   - Keep cover image text-free.
   - Prefer design-layer text for labels, specs, and infographic copy.
   - Leave clean visual space for overlay text inside generated images.
8. Generate one prompt per image with layout, regional style, size specs, text placement, model requirements, and negative constraints.
9. If image generation/editing is available and requested, generate the full pack first:
   - Default one-shot output: one cohesive 2x3 or 3x3 contact-sheet preview for review.
   - If the image tool supports separate outputs, also generate individual gallery images.
   - If separate outputs are not available, clearly mark the contact sheet as preview and provide per-image prompts for later splitting/regeneration.
10. Otherwise return copy-ready prompts and explain what will be generated once an image tool is used.
11. Assemble listing copy, regional style summary, size plan, localized overlay copy, product description modules, compliance notes, asset manifest, and editable JSON.

Default to `balanced` for Shopee listings. Use `fast` when the user worries about generation time.

## Mini Agents

Use these as internal roles, not separate heavyweight systems:

- `Product Interpreter`: extracts product type, visible traits, use cases, limitations.
- `Market Stylist`: adapts scene, tone, background, and text angle to the target market.
- `Visual Prompt Composer`: writes high-end image-generation/editing prompts.
- `Model & Scene Director`: defines model, hand, body, setting, pose, wardrobe, and demographic requirements when useful.
- `Image Pack Assembler`: returns the gallery sequence, description modules, copy, and output JSON.
- `Visual Compliance Reviewer`: checks cover-image constraints, unsupported claims, missing specs, extra accessories, IP/logo risk, and misleading visuals.

## Inputs

Load the field guide when the user asks for schema details: `references/fields.md`.
Load image-pack structure when producing a full listing pack: `references/image_pack_schema.md`.
Load Shopee rules when the output is for Shopee: `references/shopee_image_rules.md`.
Load model guidance when creating lifestyle, in-use, wearable, hand-held, or model images: `references/model_requirements.md`.
Load product description modules when the user wants detail-page images: `references/description_modules.md`.
Load category playbooks when choosing image order by category: `references/category_playbooks.md`.
Load one-shot rules when the user wants direct generation: `references/one_shot_generation.md`.
Load localized overlay rules when images need words, labels, captions, local language, or bilingual copy: `references/localized_text_overlays.md`.
Load regional style presets for market-specific visual direction: `references/regional_style_presets.md`.
Load image size rules for dimensions, contact sheets, and text safe areas: `references/image_size_specs.md`.

Required:

- `product_name`
- `product_category`
- `target_market`
- `source_image` or `product_description`

Recommended:

- `visible_attributes`
- `supplier_specs`
- `included_items`
- `materials`
- `colors`
- `dimensions`
- `package_weight`
- `package_dimensions`
- `use_cases`
- `selling_points`
- `platform`
- `pack_mode`
- `brand_tone`

Optional:

- `selected_product`
- `recommended_price`
- `risk_recommendations`
- `competitor_style_notes`
- `competitor_examples`
- `local_context`
- `must_avoid`
- `text_overlay`
- `language_mode`
- `image_model_capability`
- `text_rendering_mode`
- `model_policy`
- `one_shot_generation`
- `output_language`

## Market Style Presets

Singapore:

- Scene: HDB, condo, compact apartment, home office, study desk, humid city living.
- Tone: clean, modern, efficient, space-saving, premium but practical.
- Visual: bright natural light, tidy interior, minimalist props, polished ecommerce composition.

Philippines:

- Scene: family home, dorm room, study table, small apartment, daily home routine.
- Tone: warm, value-conscious, practical, friendly, everyday upgrade.
- Visual: inviting light, warmer home textures, clear product focus, accessible premium feel.

Generic premium:

- Scene: studio tabletop, editorial product lighting, soft shadows, refined background.
- Tone: elegant, high-end, minimal, aspirational.
- Visual: product-first, sharp detail, cinematic lighting, no clutter.

## Visual Blocks

Use `references/visual_blocks.md` for block types and prompt templates.
Use `references/image_pack_schema.md` for the full image pack output structure.

Recommended balanced Shopee gallery:

1. `cover_main`: clean compliant cover image.
2. `premium_hero`: polished product-first visual.
3. `localized_lifestyle`: market-specific use scene.
4. `in_use_model_or_hand`: model, hand, or action image when useful.
5. `feature_infographic`: 2-4 factual benefits.
6. `specification_size`: size, material, weight, package details.

Premium gallery may add:

7. `package_contents`: what buyers receive.
8. `comparison_why_this`: non-brand comparison or use-case contrast.
9. `variant_or_detail_closeup`: colors, angles, texture, controls, ports, materials.

If the user wants speed, generate `cover_main`, `premium_hero`, and `feature_infographic` first.

## Image Generation Rules

Use `references/one_shot_generation.md` when generating the final image pack directly.
Use `references/localized_text_overlays.md` when adding market-localized words or label plans.

For product photo upgrading:

- Preserve product shape, color, material, and visible design.
- Upgrade lighting, composition, background, and perceived quality.
- Do not add logos, brand names, certifications, functions, accessories, or capacity claims unless present in the input.
- Prefer short overlay text generated outside the image tool when text clarity matters.

For high-end style:

- Use premium studio lighting, crisp product detail, realistic shadows, refined props, clean background.
- Make the product look commercially shot, not fantasy-rendered.
- Keep the product recognizable from the source image.

For listing image packs:

- Generate a cohesive set, not unrelated one-off images.
- Cover images should be clean and minimally styled; secondary images can use text overlays, callouts, scenes, and models.
- Text inside generated images may be unreliable. Prefer short overlay text and note when text should be added in a design layer after generation.
- For localized text, return the exact copy as structured overlay data even if the generated image itself is text-free.
- If `image_model_capability` is `high_text_fidelity` and the user uses gpt-image-1 or similar, allow short confirmed captions and labels to be rendered directly into the image.
- Use `text_rendering_mode: hybrid` by default for high text-fidelity models: direct-render stable hero, lifestyle, and feature labels, but keep exact prices, dimensions, package contents, and legal claims editable.
- Use `text_rendering_mode: direct_image_text` only when the user explicitly wants the generated images to contain the text.
- Never show accessories, bundles, colors, sizes, or certifications unless present in the input or clearly marked as a proposed bundle requiring seller confirmation.
- For comparisons, compare use cases or generic alternatives, not named competitors.
- For models, describe the model as a generic commercial model. Do not request real people, celebrities, influencers, or identifiable private people.

## Output

Return:

- `visual_strategy`
- `regional_style`
- `size_plan`
- `image_pack_plan`
- `one_shot_generation_prompt`
- `generated_or_planned_images`
- `asset_manifest`
- `localized_text_overlay_plan`
- `overlay_copy_by_image`
- `product_description_modules`
- `model_requirements`
- `localized_copy`
- `estimated_generation_plan`
- `visual_compliance_notes`
- `missing_inputs`
- `editable_json`

Keep the response practical and copy-ready.

## Time Strategy

When generation time matters:

- First generate only `cover_main` and `premium_hero`.
- Use 1 image candidate instead of multiple variants.
- Avoid generating text-heavy images.
- Reuse the same base image for edits if the user asks for market variants.
- Generate Singapore and Philippines as prompt variants first; render only the chosen one.

## Default Shopee Pack Summary

For Shopee Singapore small home / gadget products, default to:

1. Cover image: product on white or clean solid background, no text.
2. Premium hero: high-end studio or minimal home-office surface.
3. Lifestyle: Singapore HDB / condo / compact desk scene.
4. In-use: hand-held or action demonstration if it clarifies scale or usage.
5. Feature infographic: 3 factual benefits.
6. Specification image: dimensions, material, power/charging, package contents.
7. Package contents: only included items.
8. Comparison: generic "ordinary desk mess vs compact cleaning kit" style, no named competitor.

Add product description modules when the user asks for detail page assets or a full launch pack.

## Localized Text Defaults

For Shopee Malaysia gaming/electronics products:

- Default language mode: English.
- Optional local mode: Malay.
- Strong demo mode: English + Malay bilingual labels, but keep each label short.
- If using gpt-image-1 or another high text-fidelity model, use `hybrid` text rendering by default.
- Cover image: no text.
- Feature images: direct-render short confirmed labels when text fidelity is high.
- Spec images: direct-render stable confirmed specs, but leave unknown dimensions/weight as editable fields.

For example:

- `Built for Fast Inputs`
- `Compact Setup for Malaysian Gamers`
- `Fast Response / Respon Pantas`
- `USB-C Wired / USB-C Berwayar`

## One-Shot Output Contract

When generation is requested, the first visible result should be an actual generated image pack, not only JSON. Return:

1. Generated pack preview image path or rendered image.
2. Short list of included image modules.
3. Regional style summary and size plan.
4. Notes about which modules are ready for upload versus which need text overlays, exact specs, high-res export, or individual export.
5. Localized overlay copy by image.
6. Editable JSON/prompt only after the visual result.
