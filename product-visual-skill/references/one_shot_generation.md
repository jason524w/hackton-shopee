# One-Shot Generation

Use this file when the user asks to generate final listing images directly.

## Default Behavior

If image generation is available and the user says "generate", "生成", "one shot", "直接出图", or similar:

1. Generate the complete image pack first.
2. Do not stop at JSON or prompts.
3. Return the generated image preview before long explanation.
4. Include an asset manifest and per-image notes after the image.
5. Include localized overlay copy and placement rules when the pack needs words, labels, specs, or local language.

## Output Formats

Prefer the best available format in this order:

1. Individual square images for every gallery slot.
2. A cohesive contact sheet plus individual images.
3. A cohesive contact sheet only, with per-image prompts for later splitting.

When only one image output is available, use a contact sheet:

- `balanced`: 2 columns x 3 rows, six square panels.
- `premium`: 3 columns x 3 rows, nine square panels.
- `fast`: 3 square panels in one row or 1x3 vertical stack.

Each panel should look like a final listing asset, not a storyboard sketch.

## Contact Sheet Rules

- Keep each panel square and visually separated.
- Use consistent product identity, color, and lighting language.
- Make the cover image conservative and text-free.
- Keep generated text out of images when exact wording matters and the model text quality is unknown.
- If using GPT Image 2 or another high text-fidelity model, short confirmed labels may be rendered directly into secondary images.
- For infographic/spec panels, either render short confirmed labels directly or create clean empty areas for editable labels, depending on `text_rendering_mode`.
- Do not add panel numbers or labels inside the image unless the user asks.
- Do not use a mood-board collage style; each panel must be a plausible Shopee gallery image.

## One-Shot Prompt Structure

Build one generation prompt with:

1. Strict product reference summary.
2. Target platform and market.
3. Regional visual style.
4. Number of images, image size, and grid format.
5. Image slot list with concise directions.
6. Product truth constraints.
7. Localized overlay strategy.
8. Negative constraints.
9. Style unifier.

Template:

```text
Use the provided product image as the strict product reference. Generate a {pack_mode} Shopee {target_market} ecommerce listing image pack as {image_count} separate square 1:1 images in one cohesive {grid_format} contact sheet. Target individual image size: {individual_image_size}. Regional visual style: {regional_style}. Preserve {visible_attributes}. Do not {must_avoid}.

Create these {image_count} final-looking listing assets:
1. {slot_1}
2. {slot_2}
...

Style: {brand_tone}, realistic commercial product photography, Shopee-ready, consistent visual language. Text handling: use {text_rendering_mode}. If direct text is enabled, render only the short exact labels provided with crisp readable ecommerce typography. If hybrid or design-layer mode is enabled, leave clean areas for editable labels where specified.
```

## After Generation

Return:

```json
{
  "generated_pack_preview": "/path/to/generated/contact-sheet.png",
  "regional_style": {},
  "size_plan": {},
  "asset_manifest": [
    {
      "slot": 1,
      "image_type": "cover_main",
      "status": "preview_ready | upload_ready | needs_text_overlay | needs_individual_export | needs_specs_confirmation",
      "next_step": ""
    }
  ],
  "localized_text_overlay_plan": {},
  "overlay_copy_by_image": [],
  "text_rendering_mode": "design_layer | direct_image_text | hybrid",
  "image_model_capability": "unknown | high_text_fidelity",
  "one_shot_generation_prompt": "",
  "visual_compliance_notes": [],
  "missing_inputs": []
}
```

## Upload Readiness

Use these statuses:

- `upload_ready`: standalone square image with no missing text/spec issues.
- `preview_ready`: good visual direction, but generated as part of contact sheet.
- `needs_text_overlay`: image is intentionally text-free and needs design-layer labels.
- `needs_text_review`: direct image text was rendered and spelling/legibility must be checked.
- `needs_individual_export`: contact sheet panel must be regenerated or cropped into its own image.
- `needs_specs_confirmation`: exact dimensions, weight, package contents, or certifications are missing.
