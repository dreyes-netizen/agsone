"use client";
import { useCallback } from "react";

export function useConfetti() {
  const fire = useCallback(() => {
    import("canvas-confetti").then(({ default: confetti }) => {
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ["#6366f1", "#f59e0b", "#10b981", "#3b82f6", "#ec4899"],
      });
    });
  }, []);
  return { fire };
}
