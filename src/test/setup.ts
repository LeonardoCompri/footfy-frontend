const wallClockNow = Date.now.bind(Date)
let lastNow = 0
Date.now = () => (lastNow = Math.max(lastNow, wallClockNow()))

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver

window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
})) as typeof window.matchMedia

globalThis.visualViewport ??= Object.assign(new EventTarget(), {
  width: 1024,
  height: 768,
  offsetLeft: 0,
  offsetTop: 0,
  pageLeft: 0,
  pageTop: 0,
  scale: 1,
  onresize: null,
  onscroll: null,
}) as unknown as VisualViewport

Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', {
  configurable: true,
  get: () => 1,
})
Object.defineProperty(HTMLImageElement.prototype, 'naturalHeight', {
  configurable: true,
  get: () => 1,
})
