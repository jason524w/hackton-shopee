import { create } from "zustand";
import type { RunResult } from "../../../contract/result";
import {
  applyAuditStatuses,
  toBoardSummary,
  toBrief,
  toDepartments,
  toListing,
  toOpportunities,
  toPackaging,
  type BoardSummary,
} from "./adapters";
import { fetchAuditSnapshots, newRunId, PipelineError, runPipeline } from "./api";
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
    const runId = newRunId();
    set({
      runStatus: "running",
      runError: null,
      runResult: null,
      // Sequential pipeline: market starts first, the rest wait (War Room 渐进点亮).
      departments: applyAuditStatuses(EMPTY_DEPARTMENTS, []),
      opportunities: [],
      boardSummary: null,
      packaging: null,
      listing: null,
      currentStep: "company",
    });

    // Poll the audit endpoint while the run is in flight to light departments up
    // one by one. Best-effort: the POST result below remains the source of truth.
    const poller = setInterval(async () => {
      const snapshots = await fetchAuditSnapshots(runId);
      if (get().runStatus !== "running") return;
      if (snapshots.length) {
        set({ departments: applyAuditStatuses(EMPTY_DEPARTMENTS, snapshots) });
      }
    }, 3000);

    try {
      const result = await runPipeline(toBrief(brief), { runId });
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
    } finally {
      clearInterval(poller);
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
