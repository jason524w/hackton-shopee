import { nowIso, roundMoney } from "../shared";
import { matchesRegion } from "./index";
import type { ShippingEstimateInput, ShippingEstimateResult, ShippingProvider, ShippingScenario } from "./types";

type EasyshipQuoteMode = "freight_only" | "freight_and_duties";

interface EasyshipShippingProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  apiVersion?: string;
  quoteMode?: EasyshipQuoteMode;
  hsCodeProvider?: string;
  taxDutyProvider?: string;
  fetchImpl?: typeof fetch;
  declaredValueCny?: number;
  productDescription?: string;
  productSku?: string;
  originAddress?: EasyshipAddress;
  destinationAddress?: EasyshipAddress;
  forwarderFallback?: boolean;
  forwarderOriginAddress?: EasyshipAddress;
}

interface EasyshipAddress {
  line_1?: string;
  line_2?: string;
  city: string;
  state: string;
  postal_code: string;
  country_alpha2: string;
}

interface EasyshipRateResponse {
  rates?: EasyshipRate[];
  meta?: {
    request_id?: string;
  };
  error?: {
    message?: string;
    details?: string[];
    request_id?: string;
  };
}

interface EasyshipRate {
  currency?: string;
  total_charge?: number | string | null;
  shipment_charge_total?: number | string | null;
  shipment_charge?: number | string | null;
  estimated_import_tax?: number | string | null;
  estimated_import_duty?: number | string | null;
  import_tax_charge?: number | string | null;
  import_duty_charge?: number | string | null;
  min_delivery_time?: number | null;
  max_delivery_time?: number | null;
  courier_service?: {
    id?: string;
    courier_id?: string;
    name?: string;
    umbrella_name?: string;
  };
  full_description?: string | null;
  incoterms?: string | null;
  value_for_money_rank?: number | null;
  cost_rank?: number | null;
}

interface EasyshipHsCodeResponse {
  hs_codes?: Array<{ code?: string; description?: string }>;
  meta?: {
    request_id?: string;
  };
  error?: {
    message?: string;
    details?: string[];
    request_id?: string;
  };
}

export function createEasyshipShippingProvider(options: EasyshipShippingProviderOptions = {}): ShippingProvider {
  const fetcher = options.fetchImpl ?? fetch;
  const apiKey = options.apiKey ?? process.env.EASYSHIP_API_KEY;
  const baseUrl = stripTrailingSlash(options.baseUrl ?? process.env.EASYSHIP_API_BASE_URL ?? "https://public-api.easyship.com");
  const apiVersion = options.apiVersion ?? process.env.EASYSHIP_API_VERSION ?? "2024-09";
  const quoteMode = normalizeQuoteMode(options.quoteMode ?? process.env.LOGISTICS_QUOTE_MODE);
  const hsCodeProvider = options.hsCodeProvider ?? process.env.HS_CODE_PROVIDER;
  const taxDutyProvider = options.taxDutyProvider ?? process.env.TAX_DUTY_PROVIDER;
  const forwarderFallback = options.forwarderFallback ?? process.env.EASYSHIP_FORWARDER_FALLBACK !== "false";
  const declaredValueCny = positiveNumber(options.declaredValueCny ?? Number(process.env.EASYSHIP_DECLARED_VALUE_CNY), 10);
  const productDescription = options.productDescription ?? process.env.EASYSHIP_PRODUCT_DESCRIPTION ?? "Mini desk vacuum cleaner";
  const productSku = options.productSku ?? process.env.LIVE_PRODUCT_CODE ?? "SEA-MDV-SG-001";
  const originAddress = options.originAddress ?? {
    line_1: "Huaqiangbei",
    city: "Shenzhen",
    state: "Guangdong",
    postal_code: "518000",
    country_alpha2: "CN",
  };
  const destinationAddress = options.destinationAddress ?? {
    line_1: "1 Raffles Place",
    city: "Singapore",
    state: "Singapore",
    postal_code: "048616",
    country_alpha2: "SG",
  };
  const forwarderOriginAddress = options.forwarderOriginAddress ?? {
    line_1: "Central",
    city: "Hong Kong",
    state: "Hong Kong",
    postal_code: "999077",
    country_alpha2: "HK",
  };

  return {
    async estimateCrossBorder(input: ShippingEstimateInput): Promise<ShippingEstimateResult> {
      if (!apiKey) {
        throw new Error("EASYSHIP_API_KEY is missing.");
      }
      // Agents pass free-text place names ("Guangzhou, Guangdong, China"), not ISO codes —
      // match leniently on the same region aliases the seed provider uses so live wiring
      // doesn't throw on real upstream values.
      if (!matchesRegion("cn", input.from) || !matchesRegion("sg", input.to)) {
        throw new Error(`Easyship live provider is configured for CN->SG only, got ${input.from}->${input.to}.`);
      }

      const hsCode = await resolveHsCode({
        fetcher,
        apiKey,
        baseUrl,
        apiVersion,
        productDescription,
        hsCodeProvider,
      });
      const requestBody = buildRatesRequest({
        input,
        quoteMode,
        declaredValueCny,
        hsCode,
        productDescription,
        productSku,
        originAddress,
        destinationAddress,
        calculateTaxAndDuties: taxDutyProvider === "easyship" || quoteMode === "freight_and_duties",
      });
      const sourceUrl = `${baseUrl}/${apiVersion}/rates`;
      let response = await fetcher(sourceUrl, {
        method: "POST",
        headers: {
          accept: "application/json",
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });
      let body = (await response.json()) as EasyshipRateResponse;
      let usedForwarderFallback = false;
      let primaryError: string | undefined;
      if (!response.ok) {
        primaryError = `Easyship rates failed: ${response.status} ${formatEasyshipError(body)}`;
        if (!forwarderFallback || !isNoShippingSolutions(body)) {
          throw new Error(primaryError);
        }
        const fallbackBody = buildRatesRequest({
          input,
          quoteMode,
          declaredValueCny,
          hsCode,
          productDescription,
          productSku,
          originAddress: forwarderOriginAddress,
          destinationAddress,
          calculateTaxAndDuties: taxDutyProvider === "easyship" || quoteMode === "freight_and_duties",
        });
        response = await fetcher(sourceUrl, {
          method: "POST",
          headers: {
            accept: "application/json",
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(fallbackBody),
        });
        body = (await response.json()) as EasyshipRateResponse;
        if (!response.ok) {
          throw new Error(`${primaryError}; forwarder fallback failed: ${response.status} ${formatEasyshipError(body)}`);
        }
        usedForwarderFallback = true;
      }

      const rates = normalizeRates(body.rates ?? [], quoteMode);
      if (!rates.length) {
        throw new Error(`Easyship returned no usable rates for request ${body.meta?.request_id ?? "unknown"}.`);
      }

      const sortedByCost = [...rates].sort((left, right) => left.cost_sgd - right.cost_sgd);
      const low = sortedByCost[0];
      const base = selectBaseRate(rates);
      const high = sortedByCost[sortedByCost.length - 1] ?? base;

      return {
        source: {
          provider: "easyship",
          mode: "live",
          source_url: sourceUrl,
          raw_snapshot_id: body.meta?.request_id,
          captured_at: nowIso(),
        },
        from: input.from,
        to: input.to,
        chargeable_weight_g: input.weight_g,
        scenarios: {
          low: toScenario(low),
          base: toScenario(base),
          high: toScenario(high),
        },
        assumptions: [
          `Easyship live Rates API ${apiVersion}; quote mode=${quoteMode}; incoterms=${quoteMode === "freight_and_duties" ? "DDP" : "DDU"}.`,
          `Declared customs value CNY ${declaredValueCny.toFixed(2)}; HS code ${hsCode}.`,
          "Origin/destination are standard demo addresses for Shenzhen supplier to Singapore buyer.",
          ...(usedForwarderFallback
            ? [
                `Primary ${originAddress.country_alpha2}->${destinationAddress.country_alpha2} Easyship request returned no shipping solution; using ${forwarderOriginAddress.country_alpha2}->${destinationAddress.country_alpha2} forwarder export leg.`,
                "Domestic supplier-to-forwarder transport is not included in this Easyship rate and must remain a separate sourcing/fulfillment assumption.",
              ]
            : []),
        ],
        warnings: buildWarnings(rates, quoteMode, hsCodeProvider, taxDutyProvider, usedForwarderFallback, primaryError),
      };
    },
  };
}

function buildRatesRequest(input: {
  input: ShippingEstimateInput;
  quoteMode: EasyshipQuoteMode;
  declaredValueCny: number;
  hsCode: string;
  productDescription: string;
  productSku: string;
  originAddress: EasyshipAddress;
  destinationAddress: EasyshipAddress;
  calculateTaxAndDuties: boolean;
}): Record<string, unknown> {
  return {
    origin_address: input.originAddress,
    destination_address: input.destinationAddress,
    incoterms: input.quoteMode === "freight_and_duties" ? "DDP" : "DDU",
    insurance: {
      is_insured: false,
    },
    courier_settings: {
      show_courier_logo_url: false,
      apply_shipping_rules: true,
    },
    shipping_settings: {
      units: {
        weight: "g",
        dimensions: "cm",
      },
      output_currency: "SGD",
    },
    parcels: [
      {
        total_actual_weight: input.input.weight_g,
        box: {
          length: input.input.dimensions_cm.length,
          width: input.input.dimensions_cm.width,
          height: input.input.dimensions_cm.height,
        },
        items: [
          {
            description: input.productDescription,
            hs_code: input.hsCode,
            sku: input.productSku,
            quantity: 1,
            actual_weight: input.input.weight_g,
            dimensions: input.input.dimensions_cm,
            origin_country_alpha2: "CN",
            declared_currency: "CNY",
            declared_customs_value: input.declaredValueCny,
          },
        ],
      },
    ],
    calculate_tax_and_duties: input.calculateTaxAndDuties,
  };
}

async function resolveHsCode(input: {
  fetcher: typeof fetch;
  apiKey: string;
  baseUrl: string;
  apiVersion: string;
  productDescription: string;
  hsCodeProvider?: string;
}): Promise<string> {
  const configured = process.env.EASYSHIP_HS_CODE ?? process.env.LIVE_HS_CODE;
  if (configured && /^\d{8}$/.test(configured)) {
    return configured;
  }
  const fallback = "85081100";
  if (input.hsCodeProvider !== "easyship") {
    return fallback;
  }

  const sourceUrl = new URL(`${input.baseUrl}/${input.apiVersion}/hs_codes`);
  sourceUrl.searchParams.set("description", input.productDescription);
  sourceUrl.searchParams.set("per_page", "10");
  const response = await input.fetcher(sourceUrl, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${input.apiKey}`,
    },
  });
  const body = (await response.json()) as EasyshipHsCodeResponse;
  if (!response.ok) {
    throw new Error(`Easyship HS code lookup failed: ${response.status} ${formatEasyshipError(body)}`);
  }
  const exact = (body.hs_codes ?? []).find((candidate) => candidate.code && /^\d{8}$/.test(candidate.code));
  return exact?.code ?? fallback;
}

function normalizeRates(rates: EasyshipRate[], quoteMode: EasyshipQuoteMode): NormalizedEasyshipRate[] {
  return rates
    .map((rate) => normalizeRate(rate, quoteMode))
    .filter((rate): rate is NormalizedEasyshipRate => Boolean(rate));
}

function normalizeRate(rate: EasyshipRate, quoteMode: EasyshipQuoteMode): NormalizedEasyshipRate | undefined {
  const currency = String(rate.currency ?? "SGD").toUpperCase();
  if (currency !== "SGD") {
    return undefined;
  }
  const freightOnly = firstNumber(rate.shipment_charge_total, rate.shipment_charge);
  const total = firstNumber(rate.total_charge, freightOnly);
  const tax = firstNumber(rate.import_tax_charge, rate.estimated_import_tax, 0) ?? 0;
  const duty = firstNumber(rate.import_duty_charge, rate.estimated_import_duty, 0) ?? 0;
  const selectedCost = quoteMode === "freight_and_duties" ? total : freightOnly;
  if (!selectedCost || selectedCost <= 0) {
    return undefined;
  }
  return {
    cost_sgd: roundMoney(selectedCost),
    days_min: positiveInteger(rate.min_delivery_time, 1),
    days_max: positiveInteger(rate.max_delivery_time, positiveInteger(rate.min_delivery_time, 1) + 2),
    method: [
      rate.courier_service?.umbrella_name ?? rate.courier_service?.name,
      rate.full_description,
    ]
      .filter(Boolean)
      .join(" ")
      .slice(0, 180),
    value_for_money_rank: typeof rate.value_for_money_rank === "number" ? rate.value_for_money_rank : undefined,
    cost_rank: typeof rate.cost_rank === "number" ? rate.cost_rank : undefined,
    tax_sgd: roundMoney(tax),
    duty_sgd: roundMoney(duty),
    incoterms: rate.incoterms ?? undefined,
  };
}

interface NormalizedEasyshipRate {
  cost_sgd: number;
  days_min: number;
  days_max: number;
  method: string;
  value_for_money_rank?: number;
  cost_rank?: number;
  tax_sgd: number;
  duty_sgd: number;
  incoterms?: string;
}

function selectBaseRate(rates: NormalizedEasyshipRate[]): NormalizedEasyshipRate {
  const bestValue = [...rates].sort(
    (left, right) =>
      (left.value_for_money_rank ?? Number.MAX_SAFE_INTEGER) - (right.value_for_money_rank ?? Number.MAX_SAFE_INTEGER) ||
      left.cost_sgd - right.cost_sgd,
  )[0];
  return bestValue ?? [...rates].sort((left, right) => left.cost_sgd - right.cost_sgd)[Math.floor(rates.length / 2)] ?? rates[0];
}

function toScenario(rate: NormalizedEasyshipRate): ShippingScenario {
  return {
    cost_sgd: rate.cost_sgd,
    days_min: Math.max(1, rate.days_min),
    days_max: Math.max(rate.days_min, rate.days_max),
    method: rate.method || "Easyship courier rate",
  };
}

function buildWarnings(
  rates: NormalizedEasyshipRate[],
  quoteMode: EasyshipQuoteMode,
  hsCodeProvider?: string,
  taxDutyProvider?: string,
  usedForwarderFallback = false,
  primaryError?: string,
): ShippingEstimateResult["warnings"] {
  const warnings: ShippingEstimateResult["warnings"] = [];
  if (usedForwarderFallback) {
    warnings.push({
      code: "easyship_forwarder_origin_fallback",
      severity: "warning",
      message: `Easyship direct CN->SG had no available shipping solution; rate uses HK->SG forwarder export leg. ${primaryError ?? ""}`.trim(),
    });
  }
  if (quoteMode === "freight_and_duties" && rates.every((rate) => rate.tax_sgd === 0 && rate.duty_sgd === 0)) {
    warnings.push({
      code: "easyship_tax_duty_zero",
      severity: "warning",
      message: "Easyship returned freight rates but no non-zero tax/duty charges; validate account tier and HS code before treating this as landed cost.",
    });
  }
  if (hsCodeProvider !== "easyship" && !process.env.EASYSHIP_HS_CODE && !process.env.LIVE_HS_CODE) {
    warnings.push({
      code: "hs_code_defaulted",
      severity: "warning",
      message: "HS code defaulted to 85081100 for mini vacuum cleaners because Easyship HS lookup was not enabled or returned no match.",
    });
  }
  if (taxDutyProvider !== "easyship" && quoteMode === "freight_and_duties") {
    warnings.push({
      code: "tax_duty_provider_not_easyship",
      severity: "warning",
      message: "freight_and_duties mode requested but TAX_DUTY_PROVIDER is not easyship.",
    });
  }
  return warnings.length ? warnings : undefined;
}

function formatEasyshipError(body: EasyshipRateResponse | EasyshipHsCodeResponse): string {
  if (body.error) {
    return JSON.stringify({
      message: body.error.message,
      details: body.error.details,
      request_id: body.error.request_id,
    }).slice(0, 700);
  }
  return JSON.stringify(body).slice(0, 700);
}

function isNoShippingSolutions(body: EasyshipRateResponse): boolean {
  const details = body.error?.details ?? [];
  return details.some((detail) => /no shipping solutions available/i.test(detail));
}

function firstNumber(...values: Array<number | string | null | undefined>): number | undefined {
  for (const value of values) {
    const parsed = typeof value === "string" ? Number(value) : value;
    if (typeof parsed === "number" && Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function positiveNumber(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function positiveInteger(value: number | null | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

function normalizeQuoteMode(value: string | undefined): EasyshipQuoteMode {
  return value === "freight_and_duties" ? "freight_and_duties" : "freight_only";
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
