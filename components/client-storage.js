"use client";

import { useEffect, useRef, useState } from "react";

export function useLocalStorageState(key, initialValue) {
  const [value, setValue] = useState(initialValue);
  const [ready, setReady] = useState(false);
  const fallbackRef = useRef(initialValue);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        setValue(JSON.parse(raw));
      }
    } catch {
      setValue(fallbackRef.current);
    } finally {
      setReady(true);
    }
  }, [key]);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, ready, value]);

  return [value, setValue, ready];
}

export function toggleIdInList(list, id) {
  return list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id];
}
