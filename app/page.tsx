import mockResult from "@/contract/mock-result.json";
import type { RunResult } from "@/contract/result";
import { CommerceMockApp } from "@/components/commerce-mock-app";

export default function Page() {
  return <CommerceMockApp result={mockResult as RunResult} />;
}
