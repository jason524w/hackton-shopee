import { describe, expect, it } from "vitest";
import { createEasyshipShippingProvider } from "../index";

describe("Easyship shipping provider", () => {
  it("maps freight-and-duties rates into low/base/high scenarios", async () => {
    const requests: Array<{ url: string; body?: Record<string, unknown> }> = [];
    const provider = createEasyshipShippingProvider({
      apiKey: "test-token",
      baseUrl: "https://public-api.easyship.com",
      apiVersion: "2024-09",
      quoteMode: "freight_and_duties",
      taxDutyProvider: "easyship",
      hsCodeProvider: "static",
      fetchImpl: async (url, init) => {
        requests.push({
          url: String(url),
          body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined,
        });
        return jsonResponse({
          rates: [
            easyshipRate({ total_charge: 5.1, shipment_charge_total: 4.3, value_for_money_rank: 2, cost_rank: 1 }),
            easyshipRate({
              total_charge: 6.4,
              shipment_charge_total: 5.3,
              value_for_money_rank: 1,
              cost_rank: 2,
              courier_name: "Best Value Courier",
              min_delivery_time: 5,
              max_delivery_time: 8,
            }),
            easyshipRate({ total_charge: 8.2, shipment_charge_total: 6.8, value_for_money_rank: 3, cost_rank: 3 }),
          ],
          meta: { request_id: "req_easyship_1" },
        });
      },
    });

    const result = await provider.estimateCrossBorder({
      weight_g: 150,
      dimensions_cm: { length: 8, width: 8, height: 6 },
      from: "CN",
      to: "SG",
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe("https://public-api.easyship.com/2024-09/rates");
    expect(requests[0]?.body?.incoterms).toBe("DDP");
    expect(requests[0]?.body?.calculate_tax_and_duties).toBe(true);
    expect(result.source.provider).toBe("easyship");
    expect(result.source.mode).toBe("live");
    expect(result.source.raw_snapshot_id).toBe("req_easyship_1");
    expect(result.scenarios.low.cost_sgd).toBe(5.1);
    expect(result.scenarios.base.cost_sgd).toBe(6.4);
    expect(result.scenarios.base.method).toContain("Best Value Courier");
    expect(result.scenarios.high.cost_sgd).toBe(8.2);
    expect(result.assumptions.join(" ")).toContain("freight_and_duties");
  });

  it("uses shipment charge only in freight-only mode", async () => {
    const provider = createEasyshipShippingProvider({
      apiKey: "test-token",
      quoteMode: "freight_only",
      taxDutyProvider: "easyship",
      hsCodeProvider: "static",
      fetchImpl: async () =>
        jsonResponse({
          rates: [
            easyshipRate({
              total_charge: 9.9,
              shipment_charge_total: 4.2,
              value_for_money_rank: 1,
            }),
          ],
          meta: { request_id: "req_easyship_2" },
        }),
    });

    const result = await provider.estimateCrossBorder({
      weight_g: 150,
      dimensions_cm: { length: 8, width: 8, height: 6 },
      from: "CN",
      to: "SG",
    });

    expect(result.scenarios.base.cost_sgd).toBe(4.2);
    expect(result.assumptions.join(" ")).toContain("incoterms=DDU");
  });

  it("looks up HS code through Easyship when configured", async () => {
    const requests: string[] = [];
    const provider = createEasyshipShippingProvider({
      apiKey: "test-token",
      hsCodeProvider: "easyship",
      quoteMode: "freight_and_duties",
      taxDutyProvider: "easyship",
      fetchImpl: async (url) => {
        requests.push(String(url));
        if (String(url).includes("/hs_codes")) {
          return jsonResponse({
            hs_codes: [{ code: "85081100", description: "Vacuum cleaners" }],
            meta: { request_id: "req_hs_1" },
          });
        }
        return jsonResponse({
          rates: [easyshipRate({ total_charge: 5.7, value_for_money_rank: 1 })],
          meta: { request_id: "req_rate_1" },
        });
      },
    });

    const result = await provider.estimateCrossBorder({
      weight_g: 150,
      dimensions_cm: { length: 8, width: 8, height: 6 },
      from: "CN",
      to: "SG",
    });

    expect(requests[0]).toContain("/2024-09/hs_codes");
    expect(requests[1]).toContain("/2024-09/rates");
    expect(result.assumptions.join(" ")).toContain("HS code 85081100");
  });
});

function easyshipRate(input: {
  total_charge: number;
  shipment_charge_total?: number;
  value_for_money_rank?: number;
  cost_rank?: number;
  courier_name?: string;
  min_delivery_time?: number;
  max_delivery_time?: number;
}) {
  return {
    currency: "SGD",
    total_charge: input.total_charge,
    shipment_charge_total: input.shipment_charge_total ?? input.total_charge,
    estimated_import_tax: 0.4,
    estimated_import_duty: 0.1,
    import_tax_charge: 0.4,
    import_duty_charge: 0.1,
    min_delivery_time: input.min_delivery_time ?? 4,
    max_delivery_time: input.max_delivery_time ?? 7,
    value_for_money_rank: input.value_for_money_rank,
    cost_rank: input.cost_rank,
    courier_service: {
      name: input.courier_name ?? "Easyship Courier",
      umbrella_name: input.courier_name ?? "Easyship Courier",
    },
    full_description: `${input.courier_name ?? "Easyship Courier"} (4-7 working days)`,
    incoterms: "DDP",
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
