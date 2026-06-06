# Model Requirements

Use model or hand imagery only when it helps explain usage, scale, fit, or lifestyle. Many Shopee cover images should not use a model; reserve models for secondary images unless the category requires them.

## Model Policy

- Use generic commercial models only.
- Do not request real people, celebrities, influencers, public figures, private individuals, or lookalikes.
- Do not imply the model personally endorses the product.
- Avoid identifiable logos on clothing, walls, laptops, phones, or props.
- Keep model presence secondary to the product.
- Prefer hands-only or partial body when the product does not need a face.

## Fields To Specify

```json
{
  "needed": true,
  "type": "hands_only | partial_body | full_body | on_model | no_model",
  "market_fit": "Singapore home-office buyer",
  "age_range": "20s-30s adult",
  "appearance": "natural, everyday commercial model; diverse Southeast Asian representation if visible",
  "wardrobe": "plain neutral casual clothing, no logos",
  "pose_action": "holding product near keyboard to show scale",
  "expression": "neutral or lightly focused if face is visible",
  "framing": "product remains the focal point; hands and desk context support scale",
  "avoid": ["celebrity likeness", "brand logos", "sexualized pose", "unrealistic body proportions"]
}
```

## Category Defaults

| Category | Model guidance |
|---|---|
| Small home gadget | Hands-only or partial body; show scale and use. |
| Fashion / apparel | On-model fit image; include height/size only if provided. |
| Beauty | Hands, face, or application scene; avoid medical/dermatology claims. |
| Home decor | Lifestyle room scene; model usually unnecessary. |
| Kitchen | Hands-in-use scene; keep food claims factual. |
| Electronics | Hands or desk setup; avoid unsupported technical claims. |
| Baby / child products | Avoid using minors unless absolutely necessary and category-appropriate; keep safe, non-sensitive, and realistic. |

## Prompt Pattern

```text
Create a secondary Shopee listing image showing the product in realistic use. Use a generic adult commercial model only if needed. The model should be [type], [age_range], wearing [wardrobe], performing [pose_action]. Keep the product as the clear focus. Do not use celebrity likenesses, brand logos, exaggerated expressions, unsafe usage, or unsupported claims.
```
