# Image Size Specs

Use this file for image dimensions, layout, safe areas, and export planning.

## Default Marketplace Image Size

For Shopee listing gallery images:

- Aspect ratio: `1:1`
- Minimum practical size: `500x500 px`
- Recommended working size: `1024x1024 px`
- Maximum square generation size for `gpt-image-1`: `1024x1024 px`
- Format: PNG for generated/editing workflow; JPG/PNG for final marketplace upload.

Default skill output should plan every gallery image as a square.

## Pack Mode Sizes

```json
{
  "fast": {
    "image_count": 3,
    "individual_image_size": "1024x1024",
    "contact_sheet_grid": "3x1",
    "contact_sheet_output_size": "1536x1024"
  },
  "balanced": {
    "image_count": 6,
    "individual_image_size": "1024x1024",
    "contact_sheet_grid": "2x3",
    "contact_sheet_output_size": "1024x1536"
  },
  "premium": {
    "image_count": 9,
    "individual_image_size": "1024x1024",
    "contact_sheet_grid": "3x3",
    "contact_sheet_output_size": "1024x1024"
  }
}
```

Contact sheets are review previews. For upload, regenerate or export each panel as an individual `1024x1024` square and mark contact-sheet panels as `needs_individual_export`.

## Text Safe Areas

For direct text or overlay text:

- Keep important text inside the central 80% safe area.
- Avoid placing text within 6% of any edge.
- Use high contrast text/background.
- Use no more than 6 labels in one square image.
- Prefer large, straight horizontal text.
- Avoid tiny spec tables; keep spec panels sparse enough to be readable at `1024x1024`.

## Per-Image Size Notes

| Image type | Aspect | Recommended size | Text safe area |
|---|---|---|---|
| `cover_main` | 1:1 | 1024x1024 | No text |
| `premium_hero` | 1:1 | 1024x1024 | Caption inside central 80% |
| `localized_lifestyle` | 1:1 | 1024x1024 | Top or bottom strip, avoid edges |
| `in_use_model_or_hand` | 1:1 | 1024x1024 | Bottom strip |
| `feature_infographic` | 1:1 | 1024x1024 | Callouts around product, large labels |
| `specification_size` | 1:1 | 1024x1024 | Specs panel with large rows |
| `package_contents` | 1:1 | 1024x1024 | Labels near included items |
| `comparison_why_this` | 1:1 | 1024x1024 | Two-column label areas |
| `variant_or_detail_closeup` | 1:1 | 1024x1024 | Short detail labels only |

## Output Size Object

```json
{
  "size_plan": {
    "individual_image_size": "1024x1024",
    "individual_image_size": "1024x1024",
    "contact_sheet_grid": "2x3",
    "contact_sheet_output_size": "1024x1536",
    "individual_aspect_ratio": "1:1",
    "contact_sheet_aspect_ratio": "2:3",
    "text_safe_area": "central 80%; keep text 6% away from edges"
  }
}
```

## Export Strategy

Return these statuses in the asset manifest:

- `upload_ready`: already an individual square with acceptable text and specs.
- `needs_individual_export`: contact sheet panel must be regenerated or cropped into its own square.
- `needs_text_review`: text rendered directly and must be checked for spelling.
