"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { ShellBar } from "@/components/shell/shell-bar";
import { ProgressBar } from "@/components/shell/progress-bar";
import { PageTransition } from "@/components/primitives/motion";
import { flowKeyForPath, progressFor } from "@/lib/flow";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const key = flowKeyForPath(pathname);
  const percent = key ? progressFor(key) : 0;

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
