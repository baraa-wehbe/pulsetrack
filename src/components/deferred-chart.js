"use client";

import { useEffect, useRef, useState } from "react";

import ChartSkeleton from "@/components/chart-skeleton";

export default function DeferredChart({ children, loadingLabel }) {
  const [shouldRender, setShouldRender] = useState(false);
  const boundaryRef = useRef(null);

  useEffect(() => {
    const boundary = boundaryRef.current;
    if (!boundary) return;

    if (!("IntersectionObserver" in window)) {
      const fallbackTimer = window.setTimeout(() => setShouldRender(true), 0);
      return () => window.clearTimeout(fallbackTimer);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShouldRender(true);
        observer.disconnect();
      },
      { rootMargin: "240px 0px" },
    );

    observer.observe(boundary);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={boundaryRef}>
      {shouldRender ? (
        children
      ) : (
        <ChartSkeleton label={loadingLabel ?? "Loading chart"} />
      )}
    </div>
  );
}
