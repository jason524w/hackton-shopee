"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { OPPORTUNITIES, PACKAGING_OUTPUT, PACKAGING_TABS, LISTING } from "@/lib/mock-data";
import { useAppStore } from "@/lib/store";

function dot(status: string, active: boolean) {
  if (active) return "bg-orange";
  if (status === "complete") return "bg-go";
  if (status === "running") return "bg-orange";
  return "bg-ink-faint/40";
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-orange">
      {children}
    </p>
  );
}

function Para({ children }: { children: React.ReactNode }) {
  return <p className="max-w-3xl text-[14px] leading-relaxed text-ink-soft">{children}</p>;
}

function NumberedList({ items }: { items: string[] }) {
  return (
    <div className="grid gap-2">
      {items.map((it, i) => (
        <div key={it} className="grid grid-cols-[34px_1fr] gap-3 border-t hairline py-2">
          <span className="font-mono text-[12px] text-ink-faint">
            {String(i + 1).padStart(2, "0")}
          </span>
          <span className="text-[13px] leading-snug text-ink-soft">{it}</span>
        </div>
      ))}
    </div>
  );
}

function StudioSection({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      data-studio-section
      className="scroll-mt-24 border-b hairline px-8 py-10 first:pt-7"
    >
      <div className="mb-4 flex items-center gap-3">
        <Label>{label}</Label>
        <div className="h-px flex-1 bg-hairline" />
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function ImageModule({
  label,
  direction,
  image,
}: {
  label: string;
  direction: string;
  image: string;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[420px_1fr]">
      <div className="relative aspect-square overflow-hidden border border-hairline bg-ivory-deep">
        <Image src={image} alt={label} fill className="object-cover" sizes="420px" />
      </div>
      <div className="flex flex-col justify-end border-l-2 border-orange pl-5">
        <h3 className="font-display text-[28px] font-black text-ink">{label}</h3>
        <p className="mt-2 max-w-md font-display text-base font-light italic leading-relaxed text-ink-soft">
          {direction}
        </p>
        <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-faint">
          1024 x 1024 · Shopee gallery module
        </p>
      </div>
    </div>
  );
}

export default function StudioPage() {
  const router = useRouter();
  const [active, setActive] = useState(PACKAGING_TABS[0].id);
  const p = useAppStore((s) => s.packaging) ?? PACKAGING_OUTPUT;
  const listing = useAppStore((s) => s.listing) ?? LISTING;
  const selectedProductId = useAppStore((s) => s.selectedProductId);
  const opportunity =
    OPPORTUNITIES.find((o) => o.id === selectedProductId || o.id === p.productId) ??
    OPPORTUNITIES[0];
  const marketplaceLinks = opportunity.evidenceLinks.filter((link) => link.type === "marketplace");

  const tabMap = useMemo(() => new Map(PACKAGING_TABS.map((t) => [t.id, t])), []);

  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-studio-section]"));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActive(visible.target.id);
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0.15, 0.35, 0.6] },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  function jump(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="grid min-h-[70vh] grid-cols-[232px_1fr]">
      <aside className="border-r hairline bg-ivory-deep">
        <div className="sticky top-0 py-4">
          <p className="mb-3 px-5 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-faint">
            {opportunity.productName}
          </p>
          {PACKAGING_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => jump(t.id)}
              className={`flex w-full items-center gap-2 px-5 py-2 text-left text-[12px] transition-colors ${
                active === t.id
                  ? "border-l-2 border-orange bg-surface font-semibold text-ink"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              <span className={`h-[5px] w-[5px] shrink-0 rounded-full ${dot(t.status, active === t.id)}`} />
              {t.label}
            </button>
          ))}
        </div>
      </aside>

      <div className="bg-surface">
        <StudioSection id="brief" label={tabMap.get("brief")?.label ?? "Product Brief"}>
          <h1 className="font-display text-[36px] font-black tracking-tight text-ink">
            {opportunity.productName}
          </h1>
          <p className="font-mono text-[12px] text-ink-faint">
            Shopee · {opportunity.targetMarkets.join(" + ")} · selected from Opportunity Board
          </p>
          <Para>{p.productDescription}</Para>
        </StudioSection>

        <StudioSection id="title" label={tabMap.get("title")?.label ?? "Shopee Title"}>
          <h2 className="max-w-4xl font-display text-[28px] font-semibold leading-tight text-ink">
            {p.localizedShopeeTitle}
          </h2>
          <p className="font-mono text-[12px] text-ink-faint">
            {p.titleCharCount} chars · SEO optimized · Shopee SG compliant
          </p>
        </StudioSection>

        <StudioSection id="points" label={tabMap.get("points")?.label ?? "Selling Points"}>
          <NumberedList items={p.sellingPoints} />
        </StudioSection>

        <StudioSection id="positioning" label={tabMap.get("positioning")?.label ?? "Positioning"}>
          <Para>{p.positioningAngle}</Para>
        </StudioSection>

        <StudioSection id="bundle" label={tabMap.get("bundle")?.label ?? "Bundle Strategy"}>
          <Para>{p.bundleStrategy}</Para>
          <p className="font-mono text-[12px] text-ink-faint">Designed to raise average order value.</p>
        </StudioSection>

        <StudioSection id="gift" label={tabMap.get("gift")?.label ?? "Gift Strategy"}>
          <Para>{p.giftStrategy}</Para>
          <p className="font-mono text-[12px] text-ink-faint">Used as a low-cost conversion hook.</p>
        </StudioSection>

        <StudioSection id="prompts" label={tabMap.get("prompts")?.label ?? "Image Prompts"}>
          <NumberedList items={p.imagePrompts} />
        </StudioSection>

        <StudioSection id="main" label={tabMap.get("main")?.label ?? "Main Image"}>
          <ImageModule
            label="Main Image"
            direction={p.heroImageDirection}
            image={opportunity.galleryImages.main}
          />
        </StudioSection>

        <StudioSection id="lifestyle" label={tabMap.get("lifestyle")?.label ?? "Lifestyle Image"}>
          <ImageModule
            label="Lifestyle Image"
            direction={p.lifestyleImageDirection}
            image={opportunity.galleryImages.lifestyle}
          />
        </StudioSection>

        <StudioSection id="feature" label={tabMap.get("feature")?.label ?? "Feature Image"}>
          <ImageModule
            label="Feature Image"
            direction={p.featureImageDirection}
            image={opportunity.galleryImages.feature}
          />
        </StudioSection>

        <StudioSection id="preview" label={tabMap.get("preview")?.label ?? "Listing Preview"}>
          <div className="grid max-w-5xl gap-6 lg:grid-cols-[360px_1fr]">
            <div className="relative aspect-square overflow-hidden border border-hairline bg-ivory-deep">
              <Image
                src={listing.preview.image || opportunity.galleryImages.main}
                alt={listing.preview.title}
                fill
                className="object-contain p-3"
              />
            </div>
            <div className="flex flex-col justify-end">
              <h3 className="font-display text-[24px] font-semibold leading-snug text-ink">
                {listing.preview.title}
              </h3>
              <p className="my-2 font-mono text-2xl font-semibold text-orange">
                {listing.preview.price}
              </p>
              <div className="mb-5 flex flex-col gap-1">
                {listing.preview.bullets.map((b) => (
                  <span key={b} className="flex items-baseline gap-1.5 text-[13px] text-ink-soft">
                    <span className="text-orange">·</span>
                    {b}
                  </span>
                ))}
              </div>
              <a
                href={opportunity.shopeeUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-fit items-center gap-2 border-b border-orange pb-1 font-mono text-[12px] font-semibold text-orange"
              >
                Reference Shopee URL
                <ExternalLink className="size-3.5" />
              </a>
              {marketplaceLinks.length > 1 && (
                <div className="mt-4 grid max-w-xl gap-2">
                  {marketplaceLinks.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-3 border-t hairline pt-2 font-mono text-[11px] text-ink-soft hover:text-orange"
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
        </StudioSection>

        <StudioSection id="compliance" label={tabMap.get("compliance")?.label ?? "Compliance Notes"}>
          <NumberedList items={p.complianceNotes} />
          <div className="max-w-3xl border-t hairline pt-4">
            <Label>Price Uplift Reasoning</Label>
            <Para>{p.priceUpliftReasoning}</Para>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => router.push("/app/listing")}
              className="bg-ink px-5 py-2.5 font-display text-xs font-black text-white"
            >
              Generate Shopee Listing →
            </button>
            <Link href="/app/history" className="font-mono text-[11px] text-orange">
              Back to case history
            </Link>
          </div>
        </StudioSection>
      </div>
    </div>
  );
}
