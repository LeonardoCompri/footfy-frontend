// Date.now que nunca anda para trás: o Vue ignora um evento cujo timestamp (`_vts`, que o
// test-utils grava com Date.now() + 1 no trigger) não é maior que o horário em que o listener foi
// anexado. Quando o relógio de parede recua (ajustes de hora do WSL2/NTP chegam a voltar segundos),
// cliques em componentes recém-montados eram descartados e os testes falhavam de forma intermitente.
// Continua sendo o relógio de parede (igual a `new Date()`); só segura o valor enquanto ele recua.
const wallClockNow = Date.now.bind(Date)
let lastNow = 0
Date.now = () => (lastNow = Math.max(lastNow, wallClockNow()))

// Polyfills de APIs de browser que o jsdom não implementa e o Vuetify/tema usam.
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

// VOverlay (v-dialog/v-menu) observa o visualViewport para reposicionar o conteúdo.
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
