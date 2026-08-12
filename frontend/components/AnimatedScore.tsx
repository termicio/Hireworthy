"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronUp, ChevronDown } from "lucide-react";

interface AnimatedScoreProps {
  score: number;
  color: string;
  fontSize?: string;
}

/** Big tabular score number that counts up/down from its previous value on
 * change, plus a transient delta chip ("+9 ▲" / "-4 ▼") that fades out after
 * ~3s. Reused by MatchScore and ReviewResult so a future re-analysis (Phase
 * 5) gets the delta animation for free — it only needs to pass a new score. */
export default function AnimatedScore({ score, color, fontSize = "5rem" }: AnimatedScoreProps) {
  const [displayed, setDisplayed] = useState(0);
  const [delta, setDelta] = useState<number | null>(null);
  const previousScore = useRef<number | null>(null);
  const displayedRef = useRef(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const from = displayedRef.current;
    const to = score;
    const hadPrevious = previousScore.current !== null;
    const changed = hadPrevious && previousScore.current !== score;

    if (changed) {
      setDelta(score - (previousScore.current as number));
    }
    previousScore.current = score;

    if (reduceMotion) {
      setDisplayed(to);
      displayedRef.current = to;
      return;
    }

    let start: number | null = null;
    const duration = 1000;
    let raf: number;
    const step = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(from + (to - from) * eased);
      setDisplayed(value);
      displayedRef.current = value;
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [score, reduceMotion]);

  useEffect(() => {
    if (delta === null) return;
    const timer = setTimeout(() => setDelta(null), 3000);
    return () => clearTimeout(timer);
  }, [delta]);

  return (
    <div className="relative inline-flex items-end gap-2">
      <span
        className="font-display font-bold tabular leading-none"
        style={{ fontSize, color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}
      >
        {displayed}
      </span>
      <AnimatePresence>
        {delta !== null && (
          <motion.span
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-0.5 font-mono font-bold tabular mb-2"
            style={{ fontSize: "0.85rem", color: delta >= 0 ? "#E8FF00" : "#FF3D00" }}
          >
            {delta >= 0 ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {delta >= 0 ? `+${delta}` : delta}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
