export const notifySignalConnected = () => {
  window.dispatchEvent(new CustomEvent("signal:connected"));
};

export const notifySignalDisconnected = () => {
  window.dispatchEvent(new CustomEvent("signal:disconnected"));
};
