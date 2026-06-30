import { useEffect, useState } from "react";

const DEFAULT_DURATION_MS = 180;

export function useAnimatedPresence<T>(value: T | null | false, durationMs = DEFAULT_DURATION_MS) {
  const [presentValue, setPresentValue] = useState<T | null>(() => value || null);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (value) {
      setPresentValue(value);
      setIsClosing(false);
      return;
    }

    if (!presentValue) {
      return;
    }

    setIsClosing(true);
    const timeout = window.setTimeout(() => {
      setPresentValue(null);
      setIsClosing(false);
    }, durationMs);

    return () => window.clearTimeout(timeout);
  }, [durationMs, presentValue, value]);

  return { presentValue, isClosing };
}
