import { build } from 'esbuild';
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
  entryPoints: [resolve(hier, 'plan-nach-projekt.ts'), resolve(hier, 'plan-seiten.ts'), resolve(hier, 'plan-diagnose.ts'), resolve(hier, 'plan-ringe.ts'), resolve(hier, 'plan-raster.ts'), resolve(hier, 'plan-striche.ts')],
  outdir: hier,
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  // pdf.js bleibt draußen: Es bringt eigene Node-Pfade mit, und gebündelt
  // findet es seine Standardschriften nicht mehr.
  external: ['pdfjs-dist/legacy/build/pdf.mjs'],
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
