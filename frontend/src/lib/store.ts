import { create } from "zustand";
import type { RunResult } from "../../../contract/result";
import {
  toBoardSummary,
  toBrief,
  toDepartments,
  toListing,
  toOpportunities,
  toPackaging,
  type BoardSummary,
} from "./adapters";
import { PipelineError, runPipeline } from "./api";
import type { FlowKey } from "./flow";
import { DEMO_BRIEF, DEPARTMENT_META } from "./static-content";
import type {
  DepartmentResult,
  Opportunity,
  PackagingOutput,
  SellerBrief,
  ShopeeListing,
} from "./types";

export type RunStatus = "idle" | "running" | "done" | "error";

// Departments before any run: all waiting, no findings (live data only — no mock).
const EMPTY_DEPARTMENTS: DepartmentResult[] = DEPARTMENT_META.map((meta) => ({
  ...meta,
  status: "waiting",
  keyFinding: "",
  score: 0,
  evidence: [],
  outputPreview: [],
  inputUsed: [],
  reasoning: "",
  warnings: [],
  impactOnCommittee: "",
}));

interface AppState {
  brief: SellerBrief | null;
  runStatus: RunStatus;
  runError: string | null;
  runResult: RunResult | null;
  departments: DepartmentResult[];
  opportunities: Opportunity[];
  boardSummary: BoardSummary | null;
  selectedProductId: string | null;
  packaging: PackagingOutput | null;
  listing: ShopeeListing | null;
  currentStep: FlowKey;

  setBrief: (brief: SellerBrief) => void;
  loadDemoBrief: () => void;
  startRun: () => Promise<void>;
  selectProduct: (id: string) => void;
  setStep: (step: FlowKey) => void;
  reset: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  brief: null,
  runStatus: "idle",
  runError: null,
  runResult: null,
  departments: EMPTY_DEPARTMENTS,
  opportunities: [],
  boardSummary: null,
  selectedProductId: null,
  packaging: null,
  listing: null,
  currentStep: "brief",

  setBrief: (brief) => set({ brief }),
  loadDemoBrief: () => set({ brief: DEMO_BRIEF }),

  startRun: async () => {
    const brief = get().brief ?? DEMO_BRIEF;
    set({
      runStatus: "running",
      runError: null,
      runResult: null,
      departments: EMPTY_DEPARTMENTS.map((d) => ({ ...d, status: "running" })),
      opportunities: [],
      boardSummary: null,
      packaging: null,
      listing: null,
      currentStep: "company",
    });

    try {
      const result = await runPipeline(toBrief(brief));
      set({
        runStatus: "done",
        runResult: result,
        departments: toDepartments(result),
        opportunities: toOpportunities(result),
        boardSummary: toBoardSummary(result),
        selectedProductId: result.selected_listing.opportunity_id,
        packaging: toPackaging(result),
        listing: toListing(result),
      });
    } catch (error) {
      set({
        runStatus: "error",
        runError:
          error instanceof PipelineError
            ? error.message
            : "Pipeline request failed. Check that the backend is running and OPENAI_API_KEY is configured.",
        departments: EMPTY_DEPARTMENTS,
      });
    }
  },

  selectProduct: (id) => {
    const run = get().runResult;
    const hasDetail = run?.selected_listing.opportunity_id === id;
    set({
      selectedProductId: id,
      packaging: run && hasDetail ? toPackaging(run) : null,
      listing: run && hasDetail ? toListing(run) : null,
    });
  },

  setStep: (step) => set({ currentStep: step }),
  reset: () =>
    set({
      brief: null,
      runStatus: "idle",
      runError: null,
      runResult: null,
      departments: EMPTY_DEPARTMENTS,
      opportunities: [],
      boardSummary: null,
      selectedProductId: null,
      packaging: null,
      listing: null,
      currentStep: "brief",
    }),
}));
