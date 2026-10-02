import { useEffect, useState } from "react";

function getMotionPreference() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;
}

export function useTypewriter(text, speed = 18) {
  const [displayed, setDisplayed] = useState(() => getMotionPreference()?.matches ? text || "" : "");
  const [done, setDone] = useState(() => !text || Boolean(getMotionPreference()?.matches));

  useEffect(() => {
    const preference = getMotionPreference();
    if (!text) {
      setDisplayed("");
      setDone(true);
      return undefined;
    }

    if (preference?.matches) {
      setDisplayed(text);
      setDone(true);
      return undefined;
    }

    setDisplayed("");
    setDone(false);

    let index = 0;
    const chunkSize = text.length > 420 ? 4 : text.length > 180 ? 3 : 2;
    const interval = setInterval(() => {
      index += chunkSize;
      setDisplayed(text.slice(0, index));
      if (index >= text.length) {
        clearInterval(interval);
        setDisplayed(text);
        setDone(true);
      }
    }, Math.max(speed, 28));

    function handleMotionChange(event) {
      if (event.matches) {
        clearInterval(interval);
        setDisplayed(text);
        setDone(true);
      }
      // Re-enabling motion does not replay narration already shown in full.
      // The next text starts an animation using the current preference.
    }
    if (preference?.addEventListener) preference.addEventListener("change", handleMotionChange);
    else preference?.addListener?.(handleMotionChange);

    return () => {
      clearInterval(interval);
      if (preference?.removeEventListener) preference.removeEventListener("change", handleMotionChange);
      else preference?.removeListener?.(handleMotionChange);
    };
  }, [text, speed]);

  return { displayed, done };
}
