const opportunityByDirection = {
  "mini-desk-vacuum": "opp_mini_desk_vacuum",
  "portable-dehumidifier": "opp_portable_dehumidifier",
  "cable-organizer": "opp_cable_organizer",
  "pet-grooming-tool": "opp_pet_grooming_tool",
  "compact-garment-steamer": "opp_compact_garment_steamer",
};

const state = {
  data: null,
  selectedDirectionId: "",
  activeTab: "market",
};

const $ = (selector) => document.querySelector(selector);
const fmt = new Intl.NumberFormat("en-SG");

init();

async function init() {
  try {
    const response = await fetch("./data/signals.json");
    if (!response.ok) {
      throw new Error(`Unable to load mock data: ${response.status}`);
    }

    state.data = await response.json();
    state.selectedDirectionId = state.data.product_directions[0]?.id ?? "";
    render();
  } catch (error) {
    document.body.innerHTML = `
      <main class="app-shell">
        <section class="panel error-panel">
          <h1>Mock data failed to load</h1>
          <p>${escapeHtml(error.message)}</p>
          <p>Run a local static server from the repo root, for example:</p>
          <pre>python -m http.server 4000 -d mock</pre>
        </section>
      </main>
    `;
  }
}

function render() {
  const data = state.data;
  const direction = getSelectedDirection();
  const marketSignal = getSelectedMarketSignal();
  const sourcingSignal = getSelectedSourcingSignal();
  const opportunity = getSelectedOpportunity();
  const committeeTop = data.opportunities.find((item) => item.id === data.committee.ranked_ids[0]);

  $("#summary").innerHTML = [
    metric("Market platform", "Shopee SG", data.brief.target_market),
    metric("Sourcing platform", "1688", "English search keywords"),
    metric("Directions", String(data.product_directions.length), "mocked product ideas"),
    metric("Committee pick", committeeTop?.name ?? "Pending", committeeTop?.decision ?? "Watch"),
  ].join("");

  $("#directions").innerHTML = data.product_directions
    .map(
      (item) => `
        <button class="direction-row ${item.id === state.selectedDirectionId ? "active" : ""}" data-direction-id="${item.id}" type="button">
          <span>${escapeHtml(item.english_name)}</span>
          <span>${escapeHtml(item.chinese_name)}</span>
        </button>
      `,
    )
    .join("");

  document.querySelectorAll("[data-direction-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedDirectionId = button.dataset.directionId;
      render();
    });
  });

  $("#selected-direction").innerHTML = `
    <div class="section-heading">
      <div>
        <p class="eyebrow">Selected direction</p>
        <h2>${escapeHtml(direction?.english_name ?? "No direction")}</h2>
      </div>
      ${opportunity ? decisionBadge(opportunity.decision) : ""}
    </div>
    <dl class="brief-grid">
      ${briefItem("中文名", direction?.chinese_name)}
      ${briefItem("1688 搜索词", direction?.search_keyword)}
      ${briefItem("目标平台", `${data.brief.target_platform} SG`)}
      ${briefItem("最大履约", `${data.brief.max_fulfillment_days} days`)}
    </dl>
    <p class="judgment-text">${escapeHtml(opportunity?.decision_reason ?? "")}</p>
  `;

  $("#market-signal").innerHTML = marketSignal ? renderMarketSignal(marketSignal) : "";
  $("#sourcing-signal").innerHTML = sourcingSignal ? renderSourcingSignal(sourcingSignal) : "";
  renderTabs();
  renderAgents(data.agents);
  renderOpportunities(data);
  renderMargin(data);
  renderListing(data);
}

function renderTabs() {
  $("#tabs").innerHTML = ["market", "sourcing", "json"]
    .map(
      (tab) => `
        <button class="${state.activeTab === tab ? "active" : ""}" data-tab="${tab}" type="button">
          ${tab[0].toUpperCase()}${tab.slice(1)}
        </button>
      `,
    )
    .join("");

  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeTab = button.dataset.tab;
      renderTabs();
    });
  });

  const marketSignal = getSelectedMarketSignal();
  const sourcingSignal = getSelectedSourcingSignal();
  const direction = getSelectedDirection();

  if (state.activeTab === "market" && marketSignal) {
    $("#field-output").innerHTML = `
      <div class="field-table">
        ${field("demand_signal_score", `${marketSignal.demand_signal_score}/100`)}
        ${field("competitor_count", `${marketSignal.competitor_count} listings`)}
        ${field("price_band", marketSignal.price_band.label)}
        ${field(
          "review_density",
          `${marketSignal.review_density.median_reviews} median reviews · ${marketSignal.review_density.top_listing_reviews} top listing reviews`,
        )}
        ${field(
          "rating_distribution",
          `${marketSignal.rating_distribution.average_rating} avg · ${marketSignal.rating_distribution.five_star_percent}% five-star`,
        )}
        ${field("trend_source_links", marketSignal.trend_source_links.map((link) => link.label).join(" / "))}
      </div>
    `;
    return;
  }

  if (state.activeTab === "sourcing" && sourcingSignal) {
    $("#field-output").innerHTML = `
      <div class="field-table">
        ${field("source_price", sourcingSignal.source_price.label)}
        ${field("supplier_candidates", `${sourcingSignal.supplier_candidates.length} suppliers mocked`)}
        ${field("available_stock", `${fmt.format(sourcingSignal.available_stock)} pcs`)}
        ${field("min_order_quantity", `${sourcingSignal.min_order_quantity} pcs`)}
        ${field("estimated_domestic_shipping_time", sourcingSignal.estimated_domestic_shipping_time)}
        ${field("package_weight", sourcingSignal.package_weight.label)}
        ${field("package_dimensions", sourcingSignal.package_dimensions.label)}
      </div>
    `;
    return;
  }

  $("#field-output").innerHTML = `<pre class="json-panel">${escapeHtml(
    JSON.stringify(
      {
        product_direction: direction,
        market_trend_agent_output: marketSignal,
        sourcing_agent_output: sourcingSignal,
      },
      null,
      2,
    ),
  )}</pre>`;
}

function renderMarketSignal(signal) {
  return `
    <div class="signal-stack">
      <div class="score-row">
        <div>
          <span class="score-label">demand_signal_score</span>
          <strong>${signal.demand_signal_score}</strong>
        </div>
        ${progress(signal.demand_signal_score)}
      </div>
      <div class="metric-grid two-col">
        ${metric("competitor_count", String(signal.competitor_count), "Shopee SG listings")}
        ${metric("price_band", signal.price_band.label, "visible search range")}
        ${metric("review_density", signal.review_density.label, `${signal.review_density.top_listing_reviews} top reviews`)}
        ${metric(
          "rating_distribution",
          `${signal.rating_distribution.average_rating.toFixed(2)} avg`,
          `${signal.rating_distribution.five_star_percent}% five-star`,
        )}
      </div>
      <div class="link-list">
        ${signal.trend_source_links
          .map((link) => `<a href="${escapeAttr(link.url)}" target="_blank" rel="noreferrer">${escapeHtml(link.label)}</a>`)
          .join("")}
      </div>
    </div>
  `;
}

function renderSourcingSignal(signal) {
  return `
    <div class="signal-stack">
      <div class="metric-grid two-col">
        ${metric("source_price", signal.source_price.label, "1688 supplier range")}
        ${metric("available_stock", fmt.format(signal.available_stock), "combined stock")}
        ${metric("min_order_quantity", String(signal.min_order_quantity), "lowest MOQ found")}
        ${metric("domestic_shipping", signal.estimated_domestic_shipping_time, "to forwarder warehouse")}
        ${metric("package_weight", signal.package_weight.label, "mock package spec")}
        ${metric("package_dimensions", signal.package_dimensions.label, "L x W x H")}
      </div>
      <div class="supplier-table">
        <div class="supplier-row header">
          <span>Supplier</span><span>Location</span><span>Price</span><span>MOQ</span><span>Stock</span>
        </div>
        ${signal.supplier_candidates
          .map(
            (supplier) => `
              <div class="supplier-row">
                <span>${escapeHtml(supplier.supplier_name)}</span>
                <span>${escapeHtml(supplier.location)}</span>
                <span>CNY ${supplier.price_cny.toFixed(2)}</span>
                <span>${supplier.minimum_order_quantity}</span>
                <span>${fmt.format(supplier.available_stock)}</span>
              </div>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderAgents(agents) {
  $("#agents").innerHTML = agents
    .map(
      (agent) => `
        <article class="agent-card">
          <div class="agent-card-top">
            <div>
              <span class="agent-key">${escapeHtml(agent.key)}</span>
              <h3>${escapeHtml(agent.name)}</h3>
            </div>
            <strong>${agent.score}</strong>
          </div>
          <p>${escapeHtml(agent.role)}</p>
          ${progress(agent.score)}
          <dl class="agent-evidence">
            ${agent.evidence
              .slice(0, 3)
              .map((item) => `<div><dt>${escapeHtml(item.label)}</dt><dd>${escapeHtml(item.value)}</dd></div>`)
              .join("")}
          </dl>
          <small>${escapeHtml(agent.key_judgment)}</small>
        </article>
      `,
    )
    .join("");
}

function renderOpportunities(data) {
  $("#opportunities").innerHTML = data.committee.ranked_ids
    .map((id, index) => data.opportunities.find((item) => item.id === id))
    .filter(Boolean)
    .map(
      (opportunity, index) => `
        <article class="opportunity-card">
          <div class="opportunity-card-top">
            <span class="rank">#${index + 1}</span>
            ${decisionBadge(opportunity.decision)}
          </div>
          <h3>${escapeHtml(opportunity.name)}</h3>
          <p>${escapeHtml(opportunity.direction)}</p>
          <div class="score-pair">
            <span>Overall</span>
            <strong>${opportunity.scores.overall}</strong>
          </div>
          <div class="opportunity-meta">
            ${riskBadge(opportunity.risk_level)}
            <span>${escapeHtml(opportunity.market_heat)} heat</span>
            <span>${opportunity.fulfillment_days} days</span>
          </div>
          <ul class="reason-list">
            ${opportunity.key_reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}
          </ul>
        </article>
      `,
    )
    .join("");

  $("#tradeoffs").innerHTML = data.committee.tradeoffs
    .map(
      (tradeoff) => `
        <div class="tradeoff-row">
          <strong>${escapeHtml(tradeoff.conflict)}</strong>
          <span>${escapeHtml(tradeoff.resolution)}</span>
        </div>
      `,
    )
    .join("");
}

function renderMargin(data) {
  const primary = data.opportunities.find((item) => item.is_primary);
  if (!primary?.margin) {
    $("#margin").innerHTML = "";
    return;
  }

  $("#margin-title").textContent = primary.name;
  $("#margin-decision").innerHTML = decisionBadge(primary.decision);
  $("#margin").innerHTML = `
    <div class="margin-stack">
      <div class="metric-grid three-col">
        ${metric("Low", `SGD ${primary.margin.low.net_profit.toFixed(2)}`, `${Math.round(primary.margin.low.net_margin * 100)}% margin`)}
        ${metric("Base", `SGD ${primary.margin.base.net_profit.toFixed(2)}`, `${Math.round(primary.margin.base.net_margin * 100)}% margin`)}
        ${metric("High", `SGD ${primary.margin.high.net_profit.toFixed(2)}`, `${Math.round(primary.margin.high.net_margin * 100)}% margin`)}
      </div>
      <div class="cost-stack">
        ${primary.margin.cost_breakdown
          .map(
            (line) => `
              <div class="cost-line ${line.type}">
                <span>${escapeHtml(line.label)}</span>
                <strong>${line.amount > 0 ? "+" : ""}SGD ${line.amount.toFixed(2)}</strong>
              </div>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderListing(data) {
  const listing = data.selected_listing.shopee;
  $("#listing").innerHTML = `
    <div class="listing-stack">
      <div class="image-grid">
        ${data.selected_listing.images
          .map((image) => {
            const filename = image.url.split("/").pop();
            return `
              <figure>
                <img alt="${escapeAttr(`${image.type} mock asset`)}" src="./assets/${escapeAttr(filename)}" />
                <figcaption><span>${escapeHtml(image.type)}</span><small>${escapeHtml(image.compliance)}</small></figcaption>
              </figure>
            `;
          })
          .join("")}
      </div>
      <div class="field-table compact">
        ${field("item_name", listing.item_name)}
        ${field("category", listing.category)}
        ${field("price", `SGD ${listing.price.toFixed(2)}`)}
        ${field("stock", `${listing.stock} pcs`)}
        ${field(
          "logistics",
          `${listing.logistics.weight_g}g · ${listing.logistics.length_cm} x ${listing.logistics.width_cm} x ${listing.logistics.height_cm} cm`,
        )}
      </div>
      <div class="warning-box">
        ${data.selected_listing.compliance.warnings.map((warning) => `<span>${escapeHtml(warning)}</span>`).join("")}
      </div>
    </div>
  `;
}

function getSelectedDirection() {
  return state.data.product_directions.find((item) => item.id === state.selectedDirectionId);
}

function getSelectedMarketSignal() {
  return state.data.market_trend_agent_output.signals.find((item) => item.product_direction_id === state.selectedDirectionId);
}

function getSelectedSourcingSignal() {
  return state.data.sourcing_agent_output.signals.find((item) => item.product_direction_id === state.selectedDirectionId);
}

function getSelectedOpportunity() {
  return state.data.opportunities.find((item) => item.id === opportunityByDirection[state.selectedDirectionId]);
}

function metric(label, value, detail) {
  return `
    <div class="metric-tile">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(detail)}</small>
    </div>
  `;
}

function briefItem(label, value) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value ?? "")}</dd></div>`;
}

function field(name, value) {
  return `<div class="field-row"><code>${escapeHtml(name)}</code><span>${escapeHtml(value)}</span></div>`;
}

function progress(value) {
  const width = Math.max(0, Math.min(100, Number(value) || 0));
  return `<div class="progress-track" aria-label="Score ${width}"><span style="width: ${width}%"></span></div>`;
}

function decisionBadge(decision) {
  return `<span class="decision-badge ${String(decision).toLowerCase()}">${escapeHtml(decision)}</span>`;
}

function riskBadge(risk) {
  return `<span class="risk-badge ${escapeAttr(risk)}">${escapeHtml(risk)} risk</span>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
