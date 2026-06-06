# Shopee Image Rules

Use these as practical guardrails for Shopee Singapore listing image packs. If a user provides stricter category rules, follow the user-provided rules.

## Technical Defaults

- Use square images, `1:1`.
- Minimum practical size: `500x500`.
- Recommended generation/export size: `1024x1024` or higher.
- Use JPG/JPEG/PNG-compatible visuals.
- Keep images sharp, clear, realistic, and not pixelated.
- Avoid watermarks, borders, montage frames, platform UI screenshots, and unrelated decorative graphics.

## Cover Image

The cover image is the search/listing thumbnail. Keep it conservative.

- Show the full product clearly.
- Use a white, light neutral, or clean solid background.
- Product should fill roughly 60% or more of the frame.
- Avoid text overlays, badges, arrows, icons, frames, and collage layouts.
- Avoid models unless the category naturally requires model display, such as fashion, beauty, sports, or wearable products.
- Do not show accessories or props that are not included in the sale.
- Keep color realistic and consistent with the real product.

## Secondary Images

Secondary images may explain the product more actively:

- Lifestyle backgrounds and realistic environments are allowed.
- Model, hand, and in-use demonstrations are allowed when useful.
- Close-ups, cropped details, and different angles are allowed.
- Text callouts are allowed, but should be short and factual.
- Product and relevant props should remain prominent.
- Every image should answer a different buyer question.

## Avoid

- Unsupported claims: "strongest", "medical grade", "certified", "kills bacteria", "waterproof", "10-hour battery", unless provided.
- Fake bundles, gifts, accessories, colors, sizes, packaging, or certifications.
- Named competitor attacks or unauthorized competitor logos.
- Brand logos, celebrity faces, influencer likenesses, IP characters, platform watermarks, or screenshots.
- Before/after images that imply unverified performance.
- Misleading scale or unrealistic product proportions.
- Excessive text that will be unreadable on mobile.

## Compliance Output

For each image, return one of:

- `ready`: enough information and low obvious risk.
- `needs_seller_confirmation`: plausible, but a missing spec or included item needs confirmation.
- `do_not_generate`: high risk or likely misleading without more input.

Include a short reason.
