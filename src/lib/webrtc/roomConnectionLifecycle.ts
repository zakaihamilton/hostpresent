export function clearWindowTimer(timerRef) {
  if (!timerRef.current) return;
  window.clearTimeout(timerRef.current);
  timerRef.current = null;
}

export function closeCalls(calls) {
  for (const call of calls.values()) call.close();
  calls.clear();
}
