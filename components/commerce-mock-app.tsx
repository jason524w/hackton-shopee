"use client";

import { useMemo, useState, type ReactNode } from "react";
import type {
  AgentResult,
  Decision,
  MarketTrendSignal,
  Opportunity,
  RiskLevel,
  RunResult,
  SourcingSignal,
} from "@/contract/result";

const opportunityByDirection: Record<string, string> = {
  "mini-desk-vacuum": "opp_mini_desk_vacuum",
  "portable-dehumidifier": "opp_portable_dehumidifier",
  "cable-organizer": "opp_cable_organizer",
  "pet-grooming-tool": "opp_pet_grooming_tool",
  "compact-garment-steamer": "opp_compact_garment_steamer",
};

type DetailTab = "market" | "sourcing" | "json";

interface CommerceMockAppProps {
  result: RunResult;
}

export function CommerceMockApp({ result }: CommerceMockAppProps) {
  const [selectedDirectionId, setSelectedDirectionId] = useState(result.product_directions[0]?.id ?? "");
  const [detailTab, setDetailTab] = useState<DetailTab>("market");

  const selectedDirection = result.product_directions.find((direction) => direction.id === selectedDirectionId);
  const selectedMarketSignal = result.market_trend_agent_output.signals.find(
    (signal) => signal.product_direction_id === selectedDirectionId,
  );
  const selectedSourcingSignal = result.sourcing_agent_output.signals.find(
    (signal) => signal.product_direction_id === selectedDirectionId,
  );
  const selectedOpportunity = result.opportunities.find(
    (opportunity) => opportunity.id === opportunityByDirection[selectedDirectionId],
  );

  const primaryOpportunity = result.opportunities.find((opportunity) => opportunity.is_primary);
  const committeeTop = result.opportunities.find((opportunity) => opportunity.id === result.committee.ranked_ids[0]);
  const jsonPreview = useMemo(
    () =>
      JSON.stringify(
        {
          product_direction: selectedDirection,
          market_trend_agent_output: selectedMarketSignal,
          sourcing_agent_output: selectedSourcingSignal,
        },
        null,
        2,
      ),
    [selectedDirection, selectedMarketSignal, selectedSourcingSignal],
  );

  return (
    <main className="app-shell">
      <section className="workspace-header">
        <div>
          <p className="eyebrow">Sea Launch AI mock workspace</p>
          <h1>Shopee SG 市场信号 + 1688 货源信号</h1>
          <p className="header-copy">
            用 mock 数据先跑通完整网页和 API 输出，覆盖图一的 Market Trend Agent 字段与图二的 Sourcing
            Agent 字段。
          </p>
        </div>
        <div className="header-actions" aria-label="Mock run controls">
          <a className="text-button" href="/api/run?mock=1">
            API mock
          </a>
          <a className="text-button secondary" href="#agent-output">
            Agent output
          </a>
        </div>
      </section>

      <section className="summary-strip" aria-label="Run summary">
        <Metric label="Market platform" value="Shopee SG" detail={result.brief.target_market} />
        <Metric label="Sourcing platform" value="1688" detail="English search keywords" />
        <Metric label="Directions" value={String(result.product_directions.length)} detail="mocked product ideas" />
        <Metric label="Committee pick" value={committeeTop?.name ?? "Pending"} detail={committeeTop?.decision ?? "Watch"} />
      </section>

      <section className="section-grid">
        <div className="panel product-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Product directions</p>
              <h2>商品方向</h2>
            </div>
            <span className="small-badge">mock seed</span>
          </div>

          <div className="direction-list" role="list" aria-label="Product directions">
            {result.product_directions.map((direction) => (
              <button
                className={`direction-row ${direction.id === selectedDirectionId ? "active" : ""}`}
                key={direction.id}
                onClick={() => setSelectedDirectionId(direction.id)}
                type="button"
              >
                <span>{direction.english_name}</span>
                <span>{direction.chinese_name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="panel selected-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Selected direction</p>
              <h2>{selectedDirection?.english_name ?? "No direction"}</h2>
            </div>
            {selectedOpportunity ? <DecisionBadge decision={selectedOpportunity.decision} /> : null}
          </div>
          <dl className="brief-grid">
            <div>
              <dt>中文名</dt>
              <dd>{selectedDirection?.chinese_name}</dd>
            </div>
            <div>
              <dt>1688 搜索词</dt>
              <dd>{selectedDirection?.search_keyword}</dd>
            </div>
            <div>
              <dt>目标平台</dt>
              <dd>{result.brief.target_platform} SG</dd>
            </div>
            <div>
              <dt>最大履约</dt>
              <dd>{result.brief.max_fulfillment_days} days</dd>
            </div>
          </dl>
          <p className="judgment-text">{selectedOpportunity?.decision_reason}</p>
        </div>
      </section>

      <section className="signal-layout" id="agent-output">
        <div className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Market Trend Agent</p>
              <h2>真实市场信号 mock</h2>
            </div>
            <span className="source-chip">Shopee SG</span>
          </div>
          {selectedMarketSignal ? <MarketSignalView signal={selectedMarketSignal} /> : null}
        </div>

        <div className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Sourcing Agent</p>
              <h2>真实货源信号 mock</h2>
            </div>
            <span className="source-chip orange">1688</span>
          </div>
          {selectedSourcingSignal ? <SourcingSignalView signal={selectedSourcingSignal} /> : null}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Field-level output</p>
            <h2>Agent 输出字段</h2>
          </div>
          <div className="segmented-control" role="tablist" aria-label="Signal details">
            <TabButton active={detailTab === "market"} onClick={() => setDetailTab("market")}>
              Market
            </TabButton>
            <TabButton active={detailTab === "sourcing"} onClick={() => setDetailTab("sourcing")}>
              Sourcing
            </TabButton>
            <TabButton active={detailTab === "json"} onClick={() => setDetailTab("json")}>
              JSON
            </TabButton>
          </div>
        </div>
        {detailTab === "market" && selectedMarketSignal ? <MarketFieldTable signal={selectedMarketSignal} /> : null}
        {detailTab === "sourcing" && selectedSourcingSignal ? <SourcingFieldTable signal={selectedSourcingSignal} /> : null}
        {detailTab === "json" ? <pre className="json-panel">{jsonPreview}</pre> : null}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Agent war room</p>
            <h2>7-agent mock 状态</h2>
          </div>
          <span className="small-badge">all done</span>
        </div>
        <div className="agent-grid">
          {result.agents.map((agent) => (
            <AgentCard agent={agent} key={agent.key} />
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Opportunity board</p>
            <h2>5 个方向排序</h2>
          </div>
          <span className="source-chip green">Committee</span>
        </div>
        <div className="opportunity-grid">
          {result.committee.ranked_ids.map((id, index) => {
            const opportunity = result.opportunities.find((item) => item.id === id);
            return opportunity ? <OpportunityCard index={index + 1} key={id} opportunity={opportunity} /> : null;
          })}
        </div>
        <div className="tradeoff-list">
          {result.committee.tradeoffs.map((tradeoff) => (
            <div className="tradeoff-row" key={tradeoff.opportunity_id}>
              <strong>{tradeoff.conflict}</strong>
              <span>{tradeoff.resolution}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="studio-layout">
        <div className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Margin snapshot</p>
              <h2>{primaryOpportunity?.name ?? "Primary opportunity"}</h2>
            </div>
            {primaryOpportunity ? <DecisionBadge decision={primaryOpportunity.decision} /> : null}
          </div>
          {primaryOpportunity?.margin ? <MarginBreakdown opportunity={primaryOpportunity} /> : null}
        </div>

        <div className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Listing studio</p>
              <h2>Shopee 上架草稿</h2>
            </div>
            <span className="small-badge">editable JSON ready</span>
          </div>
          <ListingStudio result={result} />
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="metric-tile">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function MarketSignalView({ signal }: { signal: MarketTrendSignal }) {
  return (
    <div className="signal-stack">
      <div className="score-row">
        <div>
          <span className="score-label">demand_signal_score</span>
          <strong>{signal.demand_signal_score}</strong>
        </div>
        <ProgressBar value={signal.demand_signal_score} />
      </div>
      <div className="metric-grid two-col">
        <Metric label="competitor_count" value={String(signal.competitor_count)} detail="Shopee SG listings" />
        <Metric label="price_band" value={signal.price_band.label} detail="visible search range" />
        <Metric label="review_density" value={signal.review_density.label} detail={`${signal.review_density.top_listing_reviews} top reviews`} />
        <Metric
          label="rating_distribution"
          value={`${signal.rating_distribution.average_rating.toFixed(2)} avg`}
          detail={`${signal.rating_distribution.five_star_percent}% five-star`}
        />
      </div>
      <LinkList links={signal.trend_source_links} />
    </div>
  );
}

function SourcingSignalView({ signal }: { signal: SourcingSignal }) {
  return (
    <div className="signal-stack">
      <div className="metric-grid two-col">
        <Metric label="source_price" value={signal.source_price.label} detail="1688 supplier range" />
        <Metric label="available_stock" value={formatNumber(signal.available_stock)} detail="combined stock" />
        <Metric label="min_order_quantity" value={String(signal.min_order_quantity)} detail="lowest MOQ found" />
        <Metric label="domestic_shipping" value={signal.estimated_domestic_shipping_time} detail="to forwarder warehouse" />
        <Metric label="package_weight" value={signal.package_weight.label} detail="mock package spec" />
        <Metric label="package_dimensions" value={signal.package_dimensions.label} detail="L x W x H" />
      </div>
      <SupplierTable signal={signal} />
    </div>
  );
}

function MarketFieldTable({ signal }: { signal: MarketTrendSignal }) {
  return (
    <div className="field-table">
      <FieldRow name="demand_signal_score" value={`${signal.demand_signal_score}/100`} />
      <FieldRow name="competitor_count" value={`${signal.competitor_count} listings`} />
      <FieldRow name="price_band" value={signal.price_band.label} />
      <FieldRow
        name="review_density"
        value={`${signal.review_density.median_reviews} median reviews · ${signal.review_density.top_listing_reviews} top listing reviews`}
      />
      <FieldRow
        name="rating_distribution"
        value={`${signal.rating_distribution.average_rating} avg · ${signal.rating_distribution.five_star_percent}% five-star`}
      />
      <FieldRow name="trend_source_links" value={signal.trend_source_links.map((link) => link.label).join(" / ")} />
    </div>
  );
}

function SourcingFieldTable({ signal }: { signal: SourcingSignal }) {
  return (
    <div className="field-table">
      <FieldRow name="source_price" value={signal.source_price.label} />
      <FieldRow name="supplier_candidates" value={`${signal.supplier_candidates.length} suppliers mocked`} />
      <FieldRow name="available_stock" value={`${formatNumber(signal.available_stock)} pcs`} />
      <FieldRow name="min_order_quantity" value={`${signal.min_order_quantity} pcs`} />
      <FieldRow name="estimated_domestic_shipping_time" value={signal.estimated_domestic_shipping_time} />
      <FieldRow name="package_weight" value={signal.package_weight.label} />
      <FieldRow name="package_dimensions" value={signal.package_dimensions.label} />
    </div>
  );
}

function FieldRow({ name, value }: { name: string; value: string }) {
  return (
    <div className="field-row">
      <code>{name}</code>
      <span>{value}</span>
    </div>
  );
}

function SupplierTable({ signal }: { signal: SourcingSignal }) {
  return (
    <div className="supplier-table" role="table" aria-label="Supplier candidates">
      <div className="supplier-row header" role="row">
        <span>Supplier</span>
        <span>Location</span>
        <span>Price</span>
        <span>MOQ</span>
        <span>Stock</span>
      </div>
      {signal.supplier_candidates.map((supplier) => (
        <div className="supplier-row" key={supplier.supplier_name} role="row">
          <span>{supplier.supplier_name}</span>
          <span>{supplier.location}</span>
          <span>CNY {supplier.price_cny.toFixed(2)}</span>
          <span>{supplier.minimum_order_quantity}</span>
          <span>{formatNumber(supplier.available_stock)}</span>
        </div>
      ))}
    </div>
  );
}

function AgentCard({ agent }: { agent: AgentResult }) {
  return (
    <article className="agent-card">
      <div className="agent-card-top">
        <div>
          <span className="agent-key">{agent.key}</span>
          <h3>{agent.name}</h3>
        </div>
        <strong>{agent.score}</strong>
      </div>
      <p>{agent.role}</p>
      <ProgressBar value={agent.score} />
      <dl className="agent-evidence">
        {agent.evidence.slice(0, 3).map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
      <small>{agent.key_judgment}</small>
    </article>
  );
}

function OpportunityCard({ opportunity, index }: { opportunity: Opportunity; index: number }) {
  return (
    <article className="opportunity-card">
      <div className="opportunity-card-top">
        <span className="rank">#{index}</span>
        <DecisionBadge decision={opportunity.decision} />
      </div>
      <h3>{opportunity.name}</h3>
      <p>{opportunity.direction}</p>
      <div className="score-pair">
        <span>Overall</span>
        <strong>{opportunity.scores.overall}</strong>
      </div>
      <div className="opportunity-meta">
        <RiskBadge risk={opportunity.risk_level} />
        <span>{opportunity.market_heat} heat</span>
        <span>{opportunity.fulfillment_days} days</span>
      </div>
      <ul className="reason-list">
        {opportunity.key_reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
    </article>
  );
}

function MarginBreakdown({ opportunity }: { opportunity: Opportunity }) {
  if (!opportunity.margin) {
    return null;
  }

  return (
    <div className="margin-stack">
      <div className="metric-grid three-col">
        <Metric label="Low" value={`SGD ${opportunity.margin.low.net_profit.toFixed(2)}`} detail={`${Math.round(opportunity.margin.low.net_margin * 100)}% margin`} />
        <Metric label="Base" value={`SGD ${opportunity.margin.base.net_profit.toFixed(2)}`} detail={`${Math.round(opportunity.margin.base.net_margin * 100)}% margin`} />
        <Metric label="High" value={`SGD ${opportunity.margin.high.net_profit.toFixed(2)}`} detail={`${Math.round(opportunity.margin.high.net_margin * 100)}% margin`} />
      </div>
      <div className="cost-stack">
        {opportunity.margin.cost_breakdown.map((line) => (
          <div className={`cost-line ${line.type}`} key={line.label}>
            <span>{line.label}</span>
            <strong>{line.amount > 0 ? "+" : ""}SGD {line.amount.toFixed(2)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function ListingStudio({ result }: { result: RunResult }) {
  const listing = result.selected_listing.shopee;

  return (
    <div className="listing-stack">
      <div className="image-grid">
        {result.selected_listing.images.map((image) => (
          <figure key={image.type}>
            <img alt={`${image.type} mock asset`} src={image.url} />
            <figcaption>
              <span>{image.type}</span>
              <small>{image.compliance}</small>
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="field-table compact">
        <FieldRow name="item_name" value={listing.item_name} />
        <FieldRow name="category" value={listing.category} />
        <FieldRow name="price" value={`SGD ${listing.price.toFixed(2)}`} />
        <FieldRow name="stock" value={`${listing.stock} pcs`} />
        <FieldRow
          name="logistics"
          value={`${listing.logistics.weight_g}g · ${listing.logistics.length_cm} x ${listing.logistics.width_cm} x ${listing.logistics.height_cm} cm`}
        />
      </div>
      <div className="warning-box">
        {result.selected_listing.compliance.warnings.map((warning) => (
          <span key={warning}>{warning}</span>
        ))}
      </div>
    </div>
  );
}

function LinkList({ links }: { links: { label: string; url: string }[] }) {
  return (
    <div className="link-list">
      {links.map((link) => (
        <a href={link.url} key={link.url} rel="noreferrer" target="_blank">
          {link.label}
        </a>
      ))}
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="progress-track" aria-label={`Score ${value}`}>
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button aria-selected={active} className={active ? "active" : ""} onClick={onClick} role="tab" type="button">
      {children}
    </button>
  );
}

function DecisionBadge({ decision }: { decision: Decision }) {
  return <span className={`decision-badge ${decision.toLowerCase()}`}>{decision}</span>;
}

function RiskBadge({ risk }: { risk: RiskLevel }) {
  return <span className={`risk-badge ${risk}`}>{risk} risk</span>;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-SG").format(value);
}
