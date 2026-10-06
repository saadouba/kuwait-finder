"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const KuwaitScene = dynamic(() => import("./KuwaitScene"), {
  ssr: false,
  loading: () => <div className="scene-loading" aria-hidden="true" />,
});

function shouldEnableScene(): boolean {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const compact = window.matchMedia("(max-width: 760px), (pointer: coarse)").matches;
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    hardwareConcurrency?: number;
    connection?: { saveData?: boolean };
  };
  const lowMemory = typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4;
  const lowCore = typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 4;
  const canvas = document.createElement("canvas");
  const webGlAvailable = Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  return !reducedMotion && !compact && !lowMemory && !lowCore && !nav.connection?.saveData && webGlAvailable;
}

export default function HeroSceneLoader() {
  const [enableScene, setEnableScene] = useState(false);

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setEnableScene(shouldEnableScene());
    update();
    window.addEventListener("resize", update, { passive: true });
    motionQuery.addEventListener("change", update);
    return () => {
      window.removeEventListener("resize", update);
      motionQuery.removeEventListener("change", update);
    };
  }, []);

  return enableScene
    ? <KuwaitScene />
    : <div className="hero-scene-fallback" aria-hidden="true"><div className="fallback-moon" /><div className="fallback-tower fallback-tower-left"><i /><b /></div><div className="fallback-tower fallback-tower-center"><i /><b /></div><div className="fallback-tower fallback-tower-right"><i /><b /></div><div className="fallback-water" /></div>;
}
