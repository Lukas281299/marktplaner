import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { Fehlerfang } from './komponenten/Fehlerfang';
import * as assistentWerkzeuge from './assistent/werkzeuge';
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
  const fenster = window as unknown as {
    marktplaner: unknown;
    polygon: unknown;
    werkzeuge: unknown;
  };
  fenster.marktplaner = usePlanStore;
  fenster.polygon = polygon;
  // Die Werkzeuge des Assistenten lassen sich so ohne Worker ausprobieren:
  //   werkzeuge.fuehreWerkzeugAus('plan_lesen', {})
  fenster.werkzeuge = assistentWerkzeuge;
}

createRoot(wurzel).render(
  <StrictMode>
    {/* Ohne diesen Fang räumt React bei einem Fehler die ganze Oberfläche
        ab und es bleibt eine weiße Seite – ohne Hinweis, und ohne Weg zu
        den eigenen Planungen zurück. */}
    <Fehlerfang>
      <App />
    </Fehlerfang>
  </StrictMode>,
);
