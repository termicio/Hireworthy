"use client";

import { motion } from "framer-motion";
import type { ReactNode, CSSProperties } from "react";

interface Props {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  delay?: number; // ms
}

export default function AnimatedSection({ children, style, className, delay = 0 }: Props) {
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.65, ease: [0.17, 0.55, 0.55, 1], delay: delay / 1000 }}
    >
      {children}
    </motion.div>
  );
}
