"use client";

import { useRouter } from "next/navigation";

const INPUT_TYPES = [
  ["Product image", "Product, supplier, or competitor photos"],
  ["Product link", "Shopee or supplier URL"],
  ["Keyword", "Search terms for the product"],
  ["Supplier quote", "Cost and MOQ from a supplier"],
  ["Product specs", "Size, weight, colour, function, contents"],
  ["Existing price", "Any price you already have"],
];

const PARSED = [
  ["Guessed name", "Mini Desk Vacuum Cleaner"],
  ["Guessed category", "Home Appliances › Vacuum Cleaners"],
  ["Visible attributes", "USB rechargeable · compact · white"],
  ["Likely specs", "~0.3 kg · 18 × 8 × 8 cm"],
  ["To confirm", "Battery capacity · suction power · warranty"],
];

export default function UploadPage() {
  const router = useRouter();
  return (
    <div>
      <div className="px-14 pt-8 pb-5">
        <h1 className="font-display text-[34px] font-black tracking-tight text-ink mb-1">
          Give your team more to work with.
        </h1>
        <p className="font-display text-base font-light italic text-ink-soft">
          Optional. Anything you add sharpens the analysis.
        </p>
      </div>

      <div className="grid grid-cols-2">
        {/* Upload */}
        <div className="border-r hairline px-14 py-6">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint mb-4">
            Add signals
          </p>
          <div className="mb-6 flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-hairline">
            <span className="font-mono text-[11px] text-ink-faint">
              Drop product images or paste a link
            </span>
          </div>
          {INPUT_TYPES.map(([t, d]) => (
            <div key={t} className="flex items-baseline gap-3 border-t hairline py-2.5 last:border-b">
              <span className="font-display text-sm font-semibold text-ink w-36 shrink-0">
                {t}
              </span>
              <span className="font-display text-[12px] font-light italic text-ink-soft">
                {d}
              </span>
            </div>
          ))}
        </div>

        {/* Parse */}
        <div className="bg-surface px-14 py-6">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-orange mb-4">
            Parsed by AI
          </p>
          {PARSED.map(([k, v]) => (
            <div key={k} className="border-b hairline py-2.5">
              <p className="font-mono text-[11px] text-ink-faint mb-0.5">{k}</p>
              <p className="text-[12px] text-ink">{v}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between border-t hairline px-14 py-5">
        <button
          onClick={() => router.push("/app/org-room")}
          className="bg-ink px-6 py-2.5 font-display text-sm font-black text-white"
        >
          Continue to AI Company →
        </button>
        <button
          onClick={() => router.push("/app/org-room")}
          className="font-mono text-[11px] text-ink-faint"
        >
          _ Skip — I have nothing to add
        </button>
      </div>
    </div>
  );
}
