"use client";

import { motion, useReducedMotion } from "framer-motion";

interface NumberMarkerProps {
  children: React.ReactNode;
}

/** Inline neon-marker highlight for a number embedded in narrative prose.
 * The background sweeps in on mount, like a highlighter stroke. */
export default function NumberMarker({ children }: NumberMarkerProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.span
      initial={reduceMotion ? false : { backgroundSize: "0% 100%" }}
      animate={{ backgroundSize: "100% 100%" }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="font-display font-bold px-1"
      style={{
        color: "#080808",
        background: "linear-gradient(#E8FF00, #E8FF00) no-repeat",
        backgroundSize: "100% 100%",
      }}
    >
      {children}
    </motion.span>
  );
}
