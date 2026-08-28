import { build } from 'esbuild';
import { readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Baut `plan-nach-projekt.ts` zu einem Node-Programm.
 *
 * Der ganze Zweck ist die eine Umleitung: `planImport/arbeiter` liefert im
 * Browser die Adresse des pdf.js-Arbeiters über Vites `?url` – etwas, das es
 * in Node nicht gibt. Hier zeigt der Import stattdessen auf einen Ersatz, der
 * gar keinen Arbeiter meldet; pdf.js rechnet dann im selben Faden.
 *
 * Der Umweg über ein Plugin ist nötig, weil esbuilds `--alias` nur ganze
 * Paketnamen kennt und keine relativen Pfade.
 */
const hier = dirname(fileURLToPath(import.meta.url));

await build({
  // Alle plan-*.ts - so muss beim naechsten Werkzeug nichts nachgetragen
  // werden. Vergessene Eintraege waren hier schon zweimal die Fehlerquelle.
  entryPoints: readdirSync(hier)
    .filter((n) => n.startsWith('plan-') && n.endsWith('.ts'))
    .map((n) => resolve(hier, n)),
  outdir: hier,
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  // pdf.js bleibt draußen: Es bringt eigene Node-Pfade mit, und gebündelt
  // findet es seine Standardschriften nicht mehr.
  // @napi-rs/canvas hat native Teile und vertraegt kein Buendeln.
  external: ['pdfjs-dist/legacy/build/pdf.mjs', '@napi-rs/canvas'],
  logLevel: 'warning',
  plugins: [
    {
      // In Node braucht pdf.js seinen `legacy`-Build. Der normale setzt
      // Browser-Bausteine wie `DOMMatrix` voraus und stirbt beim Laden –
      // pdf.js sagt das selbst als Warnung, aber erst nach dem Absturz.
      name: 'pdfjs-legacy',
      setup(bau) {
        bau.onResolve({ filter: /^pdfjs-dist$/ }, () => ({
          path: 'pdfjs-dist/legacy/build/pdf.mjs',
          external: true,
        }));
      },
    },
    {
      name: 'arbeiter-fuer-node',
      setup(bau) {
        bau.onResolve({ filter: /(^|\/)arbeiter$/ }, () => ({
          path: resolve(hier, 'arbeiter-node.ts'),
        }));
      },
    },
  ],
});

console.log('gebaut: werkzeuge/plan-nach-projekt.mjs und plan-seiten.mjs');
