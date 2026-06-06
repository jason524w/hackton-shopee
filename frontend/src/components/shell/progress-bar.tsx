"use client";

import { motion } from "framer-motion";

export function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="h-0.5 w-full bg-ivory-deep">
      <motion.div
        className="h-full bg-orange"
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{ type: "spring", stiffness: 200, damping: 30 }}
      />
    </div>
  );
}
