# Visual Blocks

## Block Types

### cover_main

Best first image for Shopee search and listing thumbnails.

```json
{
  "block_type": "cover_main",
  "goal": "Show exactly what the buyer is purchasing",
  "layout": "full product centered on white or clean solid background",
  "text_overlay": false,
  "prompt_focus": [
    "clear full product",
    "realistic color",
    "no text or watermark",
    "no extra accessories",
    "product fills 60%+ of frame"
  ]
}
```

### premium_hero

Best first render. Turns a rough product photo into a polished, high-end ecommerce hero image.

```json
{
  "block_type": "premium_hero",
  "goal": "Make the product look professionally shot and premium",
  "layout": "product centered, clean premium background",
  "text_overlay": false,
  "prompt_focus": [
    "preserve product identity",
    "premium studio lighting",
    "realistic shadow",
    "clean ecommerce composition"
  ]
}
```

### localized_lifestyle

Shows the product in a local use scene.

```json
{
  "block_type": "localized_lifestyle",
  "goal": "Show how the product fits the target market",
  "layout": "product in realistic local environment",
  "text_overlay": false,
  "prompt_focus": [
    "market-specific interior",
    "real use case",
    "natural light",
    "premium but believable"
  ]
}
```

### in_use_model_or_hand

Shows usage, scale, fit, or handling. Use hands-only for small gadgets unless a full model is truly useful.

```json
{
  "block_type": "in_use_model_or_hand",
  "goal": "Show how the product is used and how large it feels",
  "layout": "hands or partial model using the product in a realistic scene",
  "text_overlay": false,
  "prompt_focus": [
    "generic commercial model or hands only",
    "realistic usage",
    "product remains the focal point",
    "no celebrity likeness or logos"
  ]
}
```

### feature_callout

Shows 2-3 product benefits with clean visual hierarchy.

```json
{
  "block_type": "feature_callout",
  "goal": "Explain why the product is useful",
  "layout": "product on one side, simple feature badges on the other",
  "text_overlay": true,
  "prompt_focus": [
    "clear product detail",
    "minimal feature labels",
    "no exaggerated claims"
  ]
}
```

### specification_size

Shows dimensions, material, weight, power/charging, compatibility, or care facts when confirmed.

```json
{
  "block_type": "specification_size",
  "goal": "Reduce buyer uncertainty with factual specs",
  "layout": "product cutout with measurement lines and a small specs table",
  "text_overlay": true,
  "prompt_focus": [
    "clear dimensions",
    "confirmed specs only",
    "mobile-readable labels",
    "clean ecommerce infographic"
  ]
}
```

### bundle_preview

Shows a bundle, gift, or kit only when those items are included or explicitly planned.

```json
{
  "block_type": "bundle_preview",
  "goal": "Increase perceived value through a clear kit visual",
  "layout": "main product plus included accessories",
  "text_overlay": true,
  "prompt_focus": [
    "only show included items",
    "neat ecommerce arrangement",
    "value pack feel"
  ]
}
```

### comparison_why_this

Shows generic differentiation without naming or copying competitors.

```json
{
  "block_type": "comparison_why_this",
  "goal": "Explain the positioning or use-case advantage",
  "layout": "simple side-by-side use-case comparison",
  "text_overlay": true,
  "prompt_focus": [
    "generic comparison",
    "no competitor brand names",
    "no unsupported performance claims",
    "clear buyer benefit"
  ]
}
```

### variant_or_detail_closeup

Shows texture, controls, ports, material, colors, or angle details.

```json
{
  "block_type": "variant_or_detail_closeup",
  "goal": "Help buyers inspect details",
  "layout": "macro detail or alternate angle with minimal labels",
  "text_overlay": true,
  "prompt_focus": [
    "close-up product detail",
    "accurate material and color",
    "no fake variants",
    "clear mobile composition"
  ]
}
```

## Prompt Templates

### Shopee Cover Image

```text
Create a clean Shopee cover image for {product_name}. Show the full product clearly, centered on a white or very light neutral solid background. The product should fill roughly 60% or more of the square frame, with realistic color, sharp detail, and soft natural shadow. Do not add text, logos, watermarks, borders, collage elements, props, models, certification marks, or accessories not included in the package.
```

### Product Photo Upgrade

```text
Transform the provided product photo into a premium ecommerce hero image. Preserve the product's exact shape, color, material, proportions, and visible design. Place it in a refined studio setup with soft directional lighting, realistic shadows, crisp product detail, clean background, and high-end commercial photography style. Do not add logos, new features, extra accessories, certification marks, or misleading text. Make it look professional, polished, and suitable for a Shopee product hero image.
```

### Singapore Lifestyle

```text
Create a premium localized ecommerce lifestyle image for {product_name}. Preserve the product's real appearance and visible attributes. Show it in a clean Singapore HDB or condo home-office setting, on a compact desk with natural daylight, tidy modern props, and a space-saving daily-use feel. The image should look polished, realistic, and commercially shot for Shopee Singapore. Do not add unsupported features, brand logos, or exaggerated claims.
```

### Philippines Lifestyle

```text
Create a premium localized ecommerce lifestyle image for {product_name}. Preserve the product's real appearance and visible attributes. Show it in a warm, tidy Philippines home or student desk setting, with practical everyday-use styling, soft natural light, and an accessible premium feel. The product should remain the clear focus and look suitable for a Shopee Philippines listing. Do not add unsupported features, brand logos, or exaggerated claims.
```

### Small Gadget Feature Infographic

```text
Create a square Shopee secondary image for {product_name} with a clean ecommerce infographic layout. Show the product clearly and add 3 short factual callouts based only on confirmed input: {confirmed_callouts}. Use simple icons or leader lines, generous spacing, and mobile-readable composition. Do not add unsupported specs, certifications, brand logos, fake accessories, or exaggerated performance claims. If text rendering is unreliable, leave clean space for labels to be added later.
```

### Specification Image

```text
Create a square Shopee specification image for {product_name}. Use a clean product cutout, measurement lines, and a small specs panel using only these confirmed specs: {confirmed_specs}. Keep the layout minimal, mobile-readable, and realistic. Do not invent dimensions, weight, capacity, voltage, runtime, certifications, or package contents.
```

### Fancy Perfume Upgrade Example

```text
Transform the provided perfume bottle photo into a luxury fragrance campaign hero image. Preserve the bottle shape, label placement, cap, glass color, and visible design. Use elegant studio lighting, glossy reflections, soft shadows, premium marble or satin surface, refined background depth, and high-end editorial product photography. Do not invent brand logos, change the bottle identity, or add unreadable promotional text.
```
