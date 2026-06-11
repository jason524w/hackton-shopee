import { create } from "zustand";
import type { RunResult } from "../../../contract/result";
import {
  applyAuditStatuses,
  toBoardSummary,
  toBrief,
  toCommittee,
  toDepartments,
  toListing,
  toOpportunities,
  toPackaging,
  type BoardSummary,
  type CommitteeView,
} from "./adapters";
import { fetchAuditSnapshots, fetchRunStatus, newRunId, PipelineError, submitRun } from "./api";
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

// Persist the in-flight run id so a page refresh / accidental nav can re-attach to the
// still-running server-side pipeline instead of losing it (the run continues regardless).
const ACTIVE_RUN_KEY = "sealaunch.activeRunId";

function persistActiveRun(runId: string): void {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(ACTIVE_RUN_KEY, runId);
  } catch {
    /* storage unavailable (private mode / SSR) — non-fatal */
  }
}

function clearActiveRun(): void {
  try {
    if (typeof window !== "undefined") window.localStorage.removeItem(ACTIVE_RUN_KEY);
  } catch {
    /* ignore */
  }
}

function readActiveRun(): string | null {
  try {
    return typeof window !== "undefined" ? window.localStorage.getItem(ACTIVE_RUN_KEY) : null;
  } catch {
    return null;
  }
}

// Hard ceiling so a wedged/forgotten run can't poll forever (worst-case pipeline ~6 min).
const MAX_WATCH_MS = 12 * 60 * 1000;
const POLL_INTERVAL_MS = 3000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Poll an already-submitted run to completion: light departments up from audit snapshots,
 * and when the run reaches a terminal state, hydrate the store from the RunResult (or
 * surface the error). Used by both startRun (fresh) and resumeActiveRun (after refresh).
 * The store's runStatus is the loop's stop signal, so reset()/a new run cancels it.
 */
async function watchRun(runId: string): Promise<void> {
  const deadline = Date.now() + MAX_WATCH_MS;
  while (Date.now() < deadline) {
    // A reset or a newly-started run flips runStatus away from "running" → stop watching.
    if (useAppStore.getState().runStatus !== "running") return;

    let status;
    try {
      status = await fetchRunStatus(runId);
    } catch (error) {
      // Transient fetch failure: keep polling unless it's a definitive 404 (run is gone).
      if (error instanceof PipelineError && error.status === 404) {
        clearActiveRun();
        useAppStore.setState({
          runStatus: "error",
          runError: "This run is no longer available on the backend.",
          departments: EMPTY_DEPARTMENTS,
        });
        return;
      }
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    // Progressive department lighting from the per-agent audit trail.
    const snapshots = await fetchAuditSnapshots(runId);
    if (useAppStore.getState().runStatus !== "running") return;
    if (snapshots.length) {
      useAppStore.setState({ departments: applyAuditStatuses(EMPTY_DEPARTMENTS, snapshots) });
    }

    if (status.status === "completed" && status.result) {
      const result = status.result;
      clearActiveRun();
      useAppStore.setState({
        runStatus: "done",
        runResult: result,
        departments: toDepartments(result),
        opportunities: toOpportunities(result),
        boardSummary: toBoardSummary(result),
        committee: toCommittee(result),
        selectedProductId: result.selected_listing.opportunity_id,
        packaging: toPackaging(result),
        listing: toListing(result),
      });
      return;
    }

    if (status.status === "failed") {
      clearActiveRun();
      useAppStore.setState({
        runStatus: "error",
        runError:
          status.error?.message ??
          "The pipeline failed. Check that the backend is running and OPENAI_API_KEY is configured.",
        departments: EMPTY_DEPARTMENTS,
      });
      return;
    }

    await sleep(POLL_INTERVAL_MS);
  }

  // Timed out waiting. The server-side run may still finish; surface a soft error.
  if (useAppStore.getState().runStatus === "running") {
    useAppStore.setState({
      runStatus: "error",
      runError: "Timed out waiting for the run. It may still be running on the backend — check History.",
    });
  }
}

interface AppState {
  brief: SellerBrief | null;
  runStatus: RunStatus;
  runError: string | null;
  runResult: RunResult | null;
  departments: DepartmentResult[];
  opportunities: Opportunity[];
  boardSummary: BoardSummary | null;
  committee: CommitteeView | null;
  selectedProductId: string | null;
  packaging: PackagingOutput | null;
  listing: ShopeeListing | null;
  currentStep: FlowKey;

  setBrief: (brief: SellerBrief) => void;
  loadDemoBrief: () => void;
  startRun: () => Promise<void>;
  /** Re-attach to an in-flight run after a page refresh (no-op if none). */
  resumeActiveRun: () => Promise<void>;
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
  committee: null,
  selectedProductId: null,
  packaging: null,
  listing: null,
  currentStep: "brief",

  setBrief: (brief) => set({ brief }),
  loadDemoBrief: () => set({ brief: DEMO_BRIEF }),

  startRun: async () => {
    // Guard against double-fire: a second click while a run is in flight would
    // kick off a second paid pipeline (2-4 min of OpenAI + live image spend).
    if (get().runStatus === "running") return;
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
      committee: null,
      packaging: null,
      listing: null,
      currentStep: "company",
    });

    // Enqueue (returns immediately); the pipeline runs server-side. Persist the run id
    // so a refresh can re-attach, then watch it to completion.
    try {
      await submitRun(toBrief(brief), { runId });
    } catch (error) {
      set({
        runStatus: "error",
        runError:
          error instanceof PipelineError
            ? error.message
            : "Could not submit the run. Check that the backend is running and OPENAI_API_KEY is configured.",
        departments: EMPTY_DEPARTMENTS,
      });
      return;
    }
    persistActiveRun(runId);
    await watchRun(runId);
  },

  resumeActiveRun: async () => {
    if (get().runStatus === "running") return;
    const runId = readActiveRun();
    if (!runId) return;

    // Confirm the run still exists and isn't already terminal before showing "running".
    try {
      const status = await fetchRunStatus(runId);
      if (status.status === "completed" && status.result) {
        const result = status.result;
        clearActiveRun();
        set({
          runStatus: "done",
          runResult: result,
          departments: toDepartments(result),
          opportunities: toOpportunities(result),
          boardSummary: toBoardSummary(result),
          committee: toCommittee(result),
          selectedProductId: result.selected_listing.opportunity_id,
          packaging: toPackaging(result),
          listing: toListing(result),
          currentStep: "company",
        });
        return;
      }
      if (status.status === "failed") {
        clearActiveRun();
        return; // leave the UI idle rather than resurrecting a stale error
      }
    } catch {
      clearActiveRun(); // run gone / backend unreachable — drop the stale pointer
      return;
    }

    // Still queued/running on the backend — re-attach and watch.
    set({ runStatus: "running", runError: null, currentStep: "company" });
    await watchRun(runId);
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
  reset: () => {
    clearActiveRun(); // stop any in-flight watcher from re-hydrating after a reset
    set({
      brief: null,
      runStatus: "idle",
      runError: null,
      runResult: null,
      departments: EMPTY_DEPARTMENTS,
      opportunities: [],
      boardSummary: null,
      committee: null,
      selectedProductId: null,
      packaging: null,
      listing: null,
      currentStep: "brief",
    });
  },
}));
