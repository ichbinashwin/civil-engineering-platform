import { configure } from "@testing-library/dom";

// Role queries otherwise evaluate CSS visibility for every element, which is very slow in jsdom on the
// full workspace page. Tests assert hidden state explicitly (hidden attribute, aria-expanded) instead.
configure({ defaultHidden: true });

// jsdom lacks ResizeObserver; the plan view only needs it to exist.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
