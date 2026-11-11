"use client";

import dynamic from "next/dynamic";

// three.js stays out of the first-load bundle: the scene mounts after hydration.
export const LazyMathScene = dynamic(
  () => import("./MathScene").then((m) => m.MathScene),
  { ssr: false, loading: () => <div className="rdc-scene" aria-hidden="true" /> },
);
