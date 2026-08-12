import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import * as polygon from './logik/polygon';
import { usePlanStore } from './zustand/planStore';
import './stile/global.css';

const wurzel = document.getElementById('root');
if (!wurzel) throw new Error('Das Element mit der Kennung "root" fehlt in index.html.');

/**
 * Beim Entwickeln ist der Datenspeicher über die Browser-Konsole erreichbar:
 *
 *   marktplaner.getState().projekt.grundflaeche.umriss
 *
 * In der fertigen Fassung fällt das weg – `import.meta.env.DEV` ist dort
 * `false`, und der Baustein wirft den Block dann ganz heraus.
 */
if (import.meta.env.DEV) {
  const fenster = window as unknown as { marktplaner: unknown; polygon: unknown };
  fenster.marktplaner = usePlanStore;
  fenster.polygon = polygon;
}

createRoot(wurzel).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
