// O porDia no fuso UTC, o da Vercel. O fuso entra no processo antes de
// importar, como no api/__tests__/zapFuso.test.js.
import { vi, afterAll } from 'vitest';

const fusoDaMaquina = vi.hoisted(() => {
  const antes = globalThis.process.env.TZ;
  globalThis.process.env.TZ = 'UTC';
  return antes;
});

import { casosPorDia } from './porDiaCasos.js';

afterAll(() => {
  if (fusoDaMaquina === undefined) delete globalThis.process.env.TZ;
  else globalThis.process.env.TZ = fusoDaMaquina;
});

casosPorDia('UTC');
