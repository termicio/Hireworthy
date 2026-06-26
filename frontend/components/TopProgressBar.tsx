"use client";
import "nprogress/nprogress.css";
import { useEffect } from "react";
import NProgress from "nprogress";

interface Props {
  loading: boolean;
}

export default function TopProgressBar({ loading }: Props) {
  useEffect(() => {
    NProgress.configure({
      minimum: 0.15,
      speed: 400,
      trickleSpeed: 500,
      showSpinner: false,
    });

    if (loading) {
      NProgress.start();
    } else {
      NProgress.done();
    }

    return () => {
      NProgress.done();
    };
  }, [loading]);

  return null;
}
