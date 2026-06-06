# Localized Text Overlays

Use this file when creating listing images with market-localized words, labels, captions, or infographic copy.

## Core Rule

For reliable ecommerce output, choose the text rendering mode based on image model capability.

- If the user uses a high text-fidelity model such as GPT Image 2, short text may be rendered directly in the image.
- If the model is unknown or weak at text, generate clean space and return design-layer overlay copy.
- For exact prices, dimensions, legal claims, package contents, warranty, and certification text, prefer editable design-layer text unless the user explicitly wants direct rendering.

## Text Rendering Modes

| Mode | Use when | Behavior |
|---|---|---|
| `design_layer` | Model text quality is unknown, text must be exact, or specs may change | Generate image with clean text areas; return overlay copy separately. |
| `direct_image_text` | User says GPT Image 2 or another strong text model will be used | Render short captions and labels directly into image. |
| `hybrid` | Some text is stable, some needs exact editing | Render hero/lifestyle captions and stable feature labels directly; leave specs/prices as design-layer text. |

Default:

- Use `hybrid` when `image_model_capability` is `high_text_fidelity`.
- Use `design_layer` otherwise.

## Market Language Defaults

| Market | Default | Optional |
|---|---|---|
| Singapore | English | English + Chinese for selected audiences |
| Malaysia | English | Malay, English + Malay |
| Philippines | English | English + Tagalog |
| Indonesia | Indonesian | English + Indonesian |
| Thailand | Thai | English + Thai |
| Vietnam | Vietnamese | English + Vietnamese |

For Shopee Malaysia, default to English for gaming and electronics. Use Malay for stronger local flavor or bilingual overlays for broader appeal.

## Per-Image Text Policy

| Image type | Text policy | Notes |
|---|---|---|
| `cover_main` | `none` | Keep cover clean and conservative. |
| `premium_hero` | `optional_short_caption` | 3-6 words max. |
| `localized_lifestyle` | `localized_caption` | Mention local setup/use case. |
| `in_use_model_or_hand` | `benefit_caption` | Focus on action or result. |
| `feature_infographic` | `required_labels` | Use 3-6 short factual labels. |
| `specification_size` | `required_fields` | Exact specs only if confirmed. |
| `package_contents` | `required_labels` | Only included items. |
| `comparison_why_this` | `short_comparison` | Generic comparison only. |
| `variant_or_detail_closeup` | `detail_labels` | Materials, ports, controls, variants. |

## Overlay Object

```json
{
  "image_type": "feature_infographic",
  "language_mode": "english | local | bilingual",
  "primary_language": "English",
  "secondary_language": "Malay",
  "copy": [
    {
      "text": "8000Hz Polling Rate",
      "local_text": "Kadar Polling 8000Hz",
      "placement": "top-left callout",
      "priority": 1
    }
  ],
  "style": {
    "font_direction": "bold condensed esports sans",
    "color": "white text on dark panel with red accent",
    "max_words_per_label": 5,
    "avoid": ["tiny text", "long paragraphs", "low contrast"]
  },
  "render_strategy": "direct_image_text | design_layer | hybrid",
  "text_rendering_mode": "direct_image_text | design_layer | hybrid",
  "image_model_capability": "unknown | high_text_fidelity",
  "image_prompt_instruction": "Render short labels directly with crisp readable typography, or leave clean areas depending on rendering mode."
}
```

## Malaysia Gaming Keyboard Copy

English default:

- Built for Fast Inputs
- Compact Setup for Malaysian Gamers
- Fast Response. Better Control.
- Magnetic Switch
- 8000Hz Polling Rate
- Rapid Trigger
- USB-C Wired
- 16.8M RGB
- 60% Compact Layout
- Custom Web Driver

Malay local flavor:

- Respon Pantas untuk Gaming
- Susun Atur Kompak 60%
- Sambungan USB-C Berwayar
- Suis Magnetik
- RGB 16.8 Juta Warna
- Kawalan Lebih Pantas

Suggested bilingual labels:

| English | Malay |
|---|---|
| Fast Response | Respon Pantas |
| 60% Compact Layout | Susun Atur Kompak 60% |
| USB-C Wired | USB-C Berwayar |
| Magnetic Switch | Suis Magnetik |
| 16.8M RGB | RGB 16.8 Juta |

## Copy Length

- Hero caption: 3-6 words.
- Lifestyle caption: 4-8 words.
- Feature label: 1-5 words.
- Spec label: 1-6 words plus value.
- Avoid full sentences inside generated images unless the user specifically wants detail-page banners.
- Directly rendered text should be high contrast, large, straight, and mobile-readable.
- Avoid tiny text, curved text, vertical text, crowded paragraphs, or more than 6 labels per image.

## Direct Image Text Rules

When `text_rendering_mode` is `direct_image_text`:

- Tell the image model to render exact text, spelled exactly as provided.
- Keep each label short.
- Use strong contrast, simple sans-serif typography, and generous spacing.
- Use English-only or bilingual pairs sparingly; do not overload a single image.
- For bilingual labels, prefer stacked pairs such as `Fast Response` plus `Respon Pantas`.
- Ask for clean ecommerce typography, not decorative fantasy lettering.
- After generation, visually inspect spelling and legibility before marking upload-ready.

When `text_rendering_mode` is `hybrid`:

- Render hero and lifestyle captions directly if short.
- Render stable feature labels directly if confirmed.
- Keep exact dimensions, weight, price, certification, package contents, and warranty as design-layer text.

## Output Requirements

When overlays are used, include:

- `localized_text_overlay_plan`
- `overlay_copy_by_image`
- `render_strategy`
- `text_rendering_mode`
- `image_model_capability`
- `design_layer_notes`
- `language_reasoning`

Flag text as `needs_text_overlay` in the asset manifest when it must be added after generation.
