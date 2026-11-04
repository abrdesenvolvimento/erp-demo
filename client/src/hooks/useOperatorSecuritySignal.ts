import { useEffect, useRef } from "react";
import {
  isOperatorSignal,
  OPERATOR_SIGNAL_CHANNEL,
  OPERATOR_SIGNAL_STORAGE_KEY,
  type OperatorSignal,
  type OperatorSignalType,
} from "./operatorSecurityRuntime";

const LOCAL_EVENT = "abrwf:operator-security";

/** The payload contains only an action and random nonce, never identity or PIN. */
// "unlocked" announces a committed PIN mutation, not permission to release UI.
// Each tab still needs its own fresh status and matching auth before rendering.
export function broadcastOperatorSecurity(type: OperatorSignalType): void {
  const signal: OperatorSignal = { type, nonce: crypto.randomUUID() };
  window.dispatchEvent(new CustomEvent(LOCAL_EVENT, { detail: signal }));
  try {
    const channel = new BroadcastChannel(OPERATOR_SIGNAL_CHANNEL);
    channel.postMessage(signal);
    channel.close();
  } catch { /* Storage events also support browsers without BroadcastChannel. */ }
  try {
    localStorage.setItem(OPERATOR_SIGNAL_STORAGE_KEY, JSON.stringify(signal));
    localStorage.removeItem(OPERATOR_SIGNAL_STORAGE_KEY);
  } catch { /* A blocked storage API must never prevent a server-side lock. */ }
}

export function useOperatorSecuritySignal(onSignal: (signal: OperatorSignal) => void): void {
  const callback = useRef(onSignal);
  callback.current = onSignal;
  useEffect(() => {
    const seen = new Set<string>();
    const receive = (value: unknown) => {
      if (!isOperatorSignal(value) || seen.has(value.nonce)) return;
      seen.add(value.nonce);
      if (seen.size > 100) seen.delete(seen.values().next().value!);
      callback.current(value);
    };
    const local = (event: Event) => receive((event as CustomEvent).detail);
    const storage = (event: StorageEvent) => {
      if (event.key !== OPERATOR_SIGNAL_STORAGE_KEY || !event.newValue) return;
      try { receive(JSON.parse(event.newValue)); } catch { /* Ignore malformed messages. */ }
    };
    let channel: BroadcastChannel | undefined;
    try {
      channel = new BroadcastChannel(OPERATOR_SIGNAL_CHANNEL);
      channel.onmessage = event => receive(event.data);
    } catch { /* The storage listener remains available. */ }
    window.addEventListener(LOCAL_EVENT, local);
    window.addEventListener("storage", storage);
    return () => {
      channel?.close();
      window.removeEventListener(LOCAL_EVENT, local);
      window.removeEventListener("storage", storage);
    };
  }, []);
}
