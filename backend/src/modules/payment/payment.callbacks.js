const registry = {};

export function registerPaymentCallback(source, handler) {
  registry[source] = handler;
}

export function getPaymentCallback(source) {
  return registry[source] || null;
}
