"use client";

import { useState } from "react";
import { LISTING, OPPORTUNITIES } from "@/lib/mock-data";
import { useAppStore } from "@/lib/store";
import Image from "next/image";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

async function imageToDataUrl(src: string) {
  const response = await fetch(src);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function ListingPage() {
  const l = useAppStore((s) => s.listing) ?? LISTING;
  const selectedProductId = useAppStore((s) => s.selectedProductId);
  const opportunity =
    OPPORTUNITIES.find((o) => o.id === selectedProductId || o.id === l.productId) ??
    OPPORTUNITIES[0];
  const marketplaceLinks = opportunity.evidenceLinks.filter((link) => link.type === "marketplace");
  const [isGenerating, setIsGenerating] = useState(false);

  async function downloadLaunchPack() {
    setIsGenerating(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 42;
      const orange = "#ee4d2d";
      const ink = "#111111";
      const soft = "#777777";

      function paintPage(withHeader = false) {
        doc.setFillColor("#faf6f0");
        doc.rect(0, 0, pageW, pageH, "F");
        if (!withHeader) return;
        doc.setFillColor(ink);
        doc.rect(0, 0, pageW, 82, "F");
        doc.setTextColor("#ffffff");
        doc.setFont("times", "bold");
        doc.setFontSize(24);
        doc.text("SeaLaunch AI", margin, 38);
        doc.setFont("courier", "bold");
        doc.setFontSize(10);
        doc.setTextColor(orange);
        doc.text("SHOPEE LAUNCH PACK / GENERATED", margin, 62);
      }

      function ensureSpace(currentY: number, needed: number) {
        if (currentY + needed <= pageH - 44) return currentY;
        doc.addPage();
        paintPage(false);
        return 58;
      }

      paintPage(true);

      doc.setTextColor(ink);
      doc.setFont("times", "bold");
      doc.setFontSize(28);
      doc.text(opportunity.productName, margin, 122);
      doc.setFont("courier", "normal");
      doc.setFontSize(10);
      doc.setTextColor(soft);
      doc.text(`${opportunity.targetMarkets.join(" + ")} · ${opportunity.decision.toUpperCase()} · ${opportunity.confidenceScore}% confidence`, margin, 142);

      const image = await imageToDataUrl(opportunity.galleryImages.main);
      doc.setDrawColor("#e8e0d5");
      doc.setFillColor("#ffffff");
      doc.rect(margin, 166, 176, 176, "FD");
      doc.addImage(image, "PNG", margin + 8, 174, 160, 160);

      const metrics = [
        ["Source", opportunity.sourcePrice],
        ["Selling band", opportunity.suggestedSellingPrice],
        ["Net margin", opportunity.netMargin],
        ["Risk", opportunity.riskLevel],
      ];
      let x = margin + 220;
      let y = 174;
      for (const [label, value] of metrics) {
        doc.setDrawColor("#e8e0d5");
        doc.setFillColor("#ffffff");
        doc.rect(x, y, 132, 58, "FD");
        doc.setFont("courier", "bold");
        doc.setFontSize(8);
        doc.setTextColor("#bbbbbb");
        doc.text(label.toUpperCase(), x + 12, y + 18);
        doc.setFont("times", "bold");
        doc.setFontSize(15);
        doc.setTextColor(ink);
        doc.text(value, x + 12, y + 40);
        x += 142;
        if (x > pageW - 150) {
          x = margin + 220;
          y += 68;
        }
      }

      doc.setFont("times", "bold");
      doc.setFontSize(16);
      doc.setTextColor(ink);
      doc.text("Shopee Listing Fields", margin, 396);

      let rowY = 420;
      for (const field of l.fields) {
        const lines = doc.splitTextToSize(field.value, pageW - margin * 2 - 130);
        const rowHeight = Math.max(34, Math.min(lines.length, 3) * 11 + 18);
        rowY = ensureSpace(rowY, rowHeight + 4);
        doc.setDrawColor("#e8e0d5");
        doc.line(margin, rowY, pageW - margin, rowY);
        doc.setFont("courier", "bold");
        doc.setFontSize(8);
        doc.setTextColor("#bbbbbb");
        doc.text(field.key, margin, rowY + 18);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(ink);
        doc.text(lines.slice(0, 3), margin + 130, rowY + 18);
        rowY += rowHeight;
      }

      doc.line(margin, rowY, pageW - margin, rowY);
      rowY += 30;
      const referenceRows = Math.max(marketplaceLinks.length, 1);
      rowY = ensureSpace(rowY, 42 + referenceRows * 30 + 46);
      doc.setFont("times", "bold");
      doc.setFontSize(16);
      doc.setTextColor(ink);
      doc.text("Reference Shopee URLs", margin, rowY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(orange);
      const linksForPdf =
        marketplaceLinks.length > 0
          ? marketplaceLinks
          : [{ label: "Shopee reference", href: opportunity.shopeeUrl, price: "", type: "marketplace" as const }];
      let linkY = rowY + 20;
      for (const link of linksForPdf) {
        doc.setFont("courier", "bold");
        doc.setFontSize(8);
        doc.setTextColor(soft);
        doc.text(link.label.toUpperCase(), margin, linkY);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(orange);
        doc.text(doc.splitTextToSize(link.href, pageW - margin * 2), margin, linkY + 12);
        linkY += 32;
      }

      doc.setFillColor(orange);
      doc.rect(margin, linkY + 8, pageW - margin * 2, 32, "F");
      doc.setTextColor("#ffffff");
      doc.setFont("times", "bold");
      doc.setFontSize(13);
      doc.text("Ready for human review in Shopee Seller Centre", margin + 14, linkY + 29);

      doc.save(`SeaLaunch-${opportunity.id}-launch-pack.pdf`);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div>
      <div className="grid min-h-[64vh] grid-cols-2">
        {/* Fields */}
        <div className="border-r hairline px-6 py-5">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-faint mb-3.5">
            Shopee Listing Fields
          </p>
          {l.fields.map((f) => (
            <div
              key={f.key}
              className="flex items-baseline gap-3 border-b hairline py-1.5"
            >
              <span className="font-mono text-[11px] text-ink-faint w-24 shrink-0">
                {f.key}
              </span>
              <span className="flex-1 text-[12px] leading-snug text-ink">
                {f.value}
              </span>
              <span className="flex gap-2">
                {f.editable && (
                  <span className="cursor-pointer font-mono text-[10px] text-orange">
                    edit
                  </span>
                )}
                <span className="cursor-pointer font-mono text-[10px] text-orange">
                  copy
                </span>
              </span>
            </div>
          ))}
        </div>

        {/* Preview */}
        <div className="bg-ivory px-5 py-5">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-faint mb-3">
            Shopee Preview
          </p>
          <div className="relative mb-3 h-52 overflow-hidden bg-ivory-deep">
            {l.preview.image ? (
              <Image src={l.preview.image} alt={l.preview.title} fill className="object-contain p-2" />
            ) : (
              <span className="flex h-full items-center justify-center font-mono text-[10px] text-ink-faint">
                Main image
              </span>
            )}
          </div>
          <h2 className="font-display text-[15px] font-semibold leading-snug text-ink mb-1">
            {l.preview.title}
          </h2>
          <p className="font-mono text-lg font-semibold text-orange mb-2">
            {l.preview.price}
          </p>
          <div className="flex flex-col gap-1">
            {l.preview.bullets.map((b) => (
              <span key={b} className="flex gap-1.5 items-baseline text-[11px] text-ink-soft">
                <span className="text-orange">·</span>
                {b}
              </span>
            ))}
          </div>
          <a
            href={opportunity.shopeeUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-2 border-b border-orange pb-1 font-mono text-[11px] font-semibold text-orange"
          >
            Actual Shopee reference URL
            <ExternalLink className="size-3" />
          </a>
          {marketplaceLinks.length > 1 && (
            <div className="mt-3 flex flex-col gap-1.5">
              {marketplaceLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-3 border-t hairline pt-1.5 font-mono text-[10px] text-ink-soft hover:text-orange"
                >
                  <span>
                    {link.label}
                    <span className="ml-2 text-ink-faint">{link.price}</span>
                  </span>
                  <ExternalLink className="size-3 shrink-0" />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-3 border-t hairline bg-ivory px-6 py-3">
        <button
          onClick={downloadLaunchPack}
          disabled={isGenerating}
          className="bg-ink px-3.5 py-1.5 font-display text-[11px] font-black text-white disabled:opacity-50"
        >
          {isGenerating ? "Generating PDF..." : "Download Launch Pack"}
        </button>
        <button className="border-b-[1.5px] border-orange pb-px font-display text-[11px] font-black text-orange">
          Copy JSON
        </button>
        <button className="border-b-[1.5px] border-orange pb-px font-display text-[11px] font-black text-orange">
          Export CSV
        </button>
        <button className="font-mono text-[11px] text-ink-faint">_ Mark as Approved</button>
        <Link href="/app/dashboard" className="ml-auto font-mono text-[11px] text-orange">
          View ROI Dashboard →
        </Link>
      </div>
    </div>
  );
}
