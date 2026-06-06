import { create } from "zustand";
import type {
  DepartmentResult,
  Opportunity,
  PackagingOutput,
  SellerBrief,
  ShopeeListing,
} from "./types";
import {
  DEMO_BRIEF,
  DEPARTMENTS,
  OPPORTUNITIES,
  listingFor,
  packagingFor,
} from "./mock-data";
import type { FlowKey } from "./flow";

interface AppState {
  brief: SellerBrief | null;
  departments: DepartmentResult[];
  opportunities: Opportunity[];
  selectedProductId: string | null;
  packaging: PackagingOutput | null;
  listing: ShopeeListing | null;
  currentStep: FlowKey;

  setBrief: (brief: SellerBrief) => void;
  loadDemoBrief: () => void;
  startRun: () => void;
  selectProduct: (id: string) => void;
  setStep: (step: FlowKey) => void;
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  brief: null,
  departments: DEPARTMENTS,
  opportunities: OPPORTUNITIES,
  selectedProductId: null,
  packaging: null,
  listing: null,
  currentStep: "brief",

  setBrief: (brief) => set({ brief }),
  loadDemoBrief: () => set({ brief: DEMO_BRIEF }),
  startRun: () => set({ departments: DEPARTMENTS, currentStep: "company" }),
  selectProduct: (id) =>
    set({
      selectedProductId: id,
      packaging: packagingFor(id),
      listing: listingFor(id),
    }),
  setStep: (step) => set({ currentStep: step }),
  reset: () =>
    set({
      brief: null,
      selectedProductId: null,
      packaging: null,
      listing: null,
      currentStep: "brief",
    }),
}));
