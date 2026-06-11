"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { ShellBar } from "@/components/shell/shell-bar";
import { ProgressBar } from "@/components/shell/progress-bar";
import { PageTransition } from "@/components/primitives/motion";
import { flowKeyForPath, progressFor } from "@/lib/flow";
import { useAppStore } from "@/lib/store";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const key = flowKeyForPath(pathname);
  const percent = key ? progressFor(key) : 0;

  // On first mount, re-attach to an in-flight run persisted before a refresh (no-op if none).
  const resumeActiveRun = useAppStore((s) => s.resumeActiveRun);
  useEffect(() => {
    void resumeActiveRun();
  }, [resumeActiveRun]);

  return (
    <div className="min-h-screen bg-ivory">
      <ShellBar />
      <ProgressBar percent={percent} />
      <AnimatePresence mode="wait">
        <PageTransition key={pathname}>{children}</PageTransition>
      </AnimatePresence>
    </div>
  );
}
