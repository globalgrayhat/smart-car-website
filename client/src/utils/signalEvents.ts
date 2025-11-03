// frontend/src/utils/signalEvents.ts
// Small helpers to broadcast socket status to the whole app.
// Several hooks/pages already import these names, so we keep them.

export function notifySignalConnected() {
  window.dispatchEvent(new CustomEvent("signal:connected"));
}

export function notifySignalDisconnected() {
  window.dispatchEvent(new CustomEvent("signal:disconnected"));
}
