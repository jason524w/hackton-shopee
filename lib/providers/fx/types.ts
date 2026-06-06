import type { ProviderResultMeta } from "../shared";

export interface FxConvertInput {
  amount: number;
  from: string;
  to: string;
}

export interface FxConvertResult extends ProviderResultMeta {
  amount: number;
  from: string;
  to: string;
  rate: number;
  converted_amount: number;
}

export interface FxProvider {
  convert(input: FxConvertInput): Promise<FxConvertResult>;
}
