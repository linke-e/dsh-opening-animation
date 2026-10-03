import "fake-indexeddb/auto";

// jsdom ships no object URL implementation; the controller and the overlay
// both rely on createObjectURL/revokeObjectURL.
let urlCounter = 0;
const owner = URL as unknown as { createObjectURL?: unknown; revokeObjectURL?: unknown };
if (typeof owner.createObjectURL !== "function") {
  owner.createObjectURL = (): string => `blob:mock-${++urlCounter}`;
}
if (typeof owner.revokeObjectURL !== "function") {
  owner.revokeObjectURL = (): void => {};
}

// jsdom does not implement matchMedia; the controller reads reduced-motion through it.
if (typeof window.matchMedia !== "function") {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
