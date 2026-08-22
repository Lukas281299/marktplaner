import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Konfiguration für Vite.
 *
 * Der `base`-Pfad ist der einzige Punkt, der Erklärung braucht: Auf GitHub
 * Pages liegt die Anwendung nicht unter der nackten Adresse, sondern in einem
 * Unterordner mit dem Namen des Repositorys. Ohne diese Angabe sucht der
 * Browser die Programmdateien an der falschen Stelle und die Seite bleibt weiß.
 *
 * Beim Entwickeln auf dem eigenen Rechner gilt das nicht – dort liegt alles
 * direkt unter `http://localhost:5180`. Deshalb wird der Pfad nur beim Bauen
 * gesetzt und `Marktplaner starten.cmd` funktioniert unverändert weiter.
 */
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/marktplaner/' : '/',
  server: { port: 5180 },
  /**
   * Der Zeitpunkt, zu dem diese Fassung gebaut wurde.
   *
   * Steht unten rechts in der Statusleiste. Klingt nach Kleinigkeit, ist aber
   * die Antwort auf eine Frage, die sonst jedes Mal Zeit kostet: Sieht man
   * gerade den neuen Stand oder einen zwischengespeicherten alten? Ohne diese
   * Angabe lässt sich das von außen nicht unterscheiden.
   */
  define: {
    __BAUZEIT__: JSON.stringify(new Date().toISOString()),
  },
}));
