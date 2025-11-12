// jest.setup.js
jest.setTimeout(30000);

// Mock global para evitar problemas de timers
global.setInterval = jest.fn();
global.clearInterval = jest.fn();

// Limpiar todos los mocks después de cada test
afterEach(() => {
  jest.clearAllMocks();
});

// Limpiar todos los timers después de todos los tests
afterAll(() => {
  jest.clearAllTimers();
});