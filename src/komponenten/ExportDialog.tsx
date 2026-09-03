import { useState } from 'react';
import { nimmPlanAuf } from '../logik/planAufnahme';
import { bauePdf, bauePdfVektor, PAPIERE, type Papier } from '../logik/pdf';
import { MASSSTAEBE, passtAufsBlatt, pdfInhalt } from '../logik/planblatt';
import { planAlsVektor } from '../logik/planvektor';
import { baueBeispielseite, baueWebSvg } from '../logik/webExport';
import { berechneFlaechen } from '../logik/flaechen';
import { dateinameAus, ladeDateiHerunter } from '../speicher/projektArchiv';
import { usePlanStore } from '../zustand/planStore';
import { Dialog } from './Dialog';

/**
 * Der Dialog zum Herausgeben des Plans.
 *
 * Zwei Wege, weil es zwei Zwecke gibt: Das PDF ist zum Ansehen, Drucken und
 * Verschicken. Das SVG ist zum Weiterverarbeiten – es trägt ein
 * Koordinatensystem in Zentimetern, auf dem eine andere Anwendung etwas
 * ablegen kann.
 */

/** Auflösungen als Kantenlänge in Bildpunkten. */
const GUETEN = [
  { name: 'Entwurf', kante: 2000, hinweis: 'schnell, für den Bildschirm' },
  { name: 'Normal', kante: 4000, hinweis: 'für den Ausdruck' },
  { name: 'Fein', kante: 7000, hinweis: 'große Formate, dauert etwas' },
];

export function ExportDialog({ schliessen }: { schliessen: () => void }) {
  const projekt = usePlanStore((s) => s.projekt);

  const [art, setArt] = useState<'vektor' | 'pdf' | 'web'>('vektor');
  const [massstab, setMassstab] = useState<number>(100);
  const [papier, setPapier] = useState<Papier>(PAPIERE[1]);
  const [quer, setQuer] = useState(true);
  const [guete, setGuete] = useState(GUETEN[1]);
  const [mitTitel, setMitTitel] = useState(true);
  const [mitBeispiel, setMitBeispiel] = useState(true);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState('');

  const uebersicht = berechneFlaechen(projekt);

  const blattmasse = {
    breiteMm: quer ? papier.hoehe : papier.breite,
    hoeheMm: quer ? papier.breite : papier.hoehe,
    randMm: 10,
  };
  // Nur für die Vorschau im Dialog – die Ausgabe rechnet noch einmal neu.
  const probe = passtAufsBlatt(planAlsVektor(projekt), blattmasse, massstab);

  const ausgeben = async () => {
    setLaeuft(true);
    setMeldung('Der Plan wird gezeichnet …');
    try {
      if (art === 'vektor') {
        const name = dateinameAus(projekt.name);
        const { inhalt, deckkraft } = pdfInhalt({
          projekt,
          blatt: blattmasse,
          massstab,
          schriftfeld: {
            markt: projekt.name,
            zusatz:
              `Verkaufsfläche ${(uebersicht.verkaufsflaeche / 10000).toFixed(0)} m² · ` +
              `${projekt.elemente.length} Möbel`,
            datum: new Date().toLocaleDateString('de-DE'),
          },
        });
        const blatt = bauePdfVektor({
          inhalt,
          breiteMm: blattmasse.breiteMm,
          hoeheMm: blattmasse.hoeheMm,
          deckkraft,
        });
        ladeDateiHerunter(blatt, `${name}.pdf`);
        setMeldung(`Fertig: ${name}.pdf (${Math.round(blatt.size / 1024)} kB, Maßstab 1:${massstab})`);
        return;
      }

      const aufnahme = await nimmPlanAuf(guete.kante);
      if (!aufnahme) {
        setMeldung('Der Plan ließ sich nicht aufnehmen. Ist ein Grundriss angelegt?');
        return;
      }

      const name = dateinameAus(projekt.name);

      if (art === 'pdf') {
        setMeldung('Das PDF wird gebaut …');
        const blatt = await bauePdf({
          bild: aufnahme.bild,
          papier,
          quer,
          rand: 12,
          texte: mitTitel
            ? {
                titel: projekt.name,
                fusszeile:
                  `Verkaufsfläche ${(uebersicht.verkaufsflaeche / 10000).toFixed(0)} m² · ` +
                  `${projekt.elemente.length} Möbel · ` +
                  `erstellt am ${new Date().toLocaleDateString('de-DE')} mit dem Marktplaner`,
              }
            : {},
        });
        ladeDateiHerunter(blatt, `${name}.pdf`);
        setMeldung(`Fertig: ${name}.pdf (${(blatt.size / 1024 / 1024).toFixed(1)} MB)`);
        return;
      }

      setMeldung('Das SVG wird gebaut …');
      const daten = baueWebSvg(projekt, aufnahme);
      const svgName = `${name}.svg`;
      ladeDateiHerunter(new Blob([daten.svg], { type: 'image/svg+xml' }), svgName);

      if (mitBeispiel) {
        // Kurz warten: Zwei Downloads im selben Atemzug schluckt mancher
        // Browser als einen und fragt beim zweiten gar nicht mehr.
        await new Promise((fertig) => window.setTimeout(fertig, 600));
        ladeDateiHerunter(
          new Blob([baueBeispielseite(daten, svgName)], { type: 'text/html' }),
          `${name}-kameras.html`,
        );
      }
      setMeldung(
        `Fertig: ${svgName}` +
          (mitBeispiel ? ` und ${name}-kameras.html` : '') +
          ` · Plan ${(daten.masse.breiteCm / 100).toFixed(1)} × ${(daten.masse.hoeheCm / 100).toFixed(1)} m`,
      );
    } catch (fehler) {
      console.error('Marktplaner: Export', fehler);
      setMeldung('Da ist etwas schiefgegangen. Mehr steht in der Entwicklerkonsole.');
    } finally {
      setLaeuft(false);
    }
  };

  return (
    <Dialog
      titel="Plan ausgeben"
      breit
      schliessen={schliessen}
      fuss={
        <>
          {meldung && <span className="hinweis">{meldung}</span>}
          <span style={{ flex: 1 }} />
          <button className="knopf" onClick={schliessen}>
            Schließen
          </button>
          <button className="knopf knopf-haupt" onClick={() => void ausgeben()} disabled={laeuft}>
            {laeuft ? 'Einen Moment …' : art === 'web' ? 'SVG speichern' : 'PDF speichern'}
          </button>
        </>
      }
    >
      <div className="knopfreihe" style={{ marginBottom: 'var(--abstand-3)' }}>
        <button
          className={`knopf${art === 'vektor' ? ' aktiv' : ''}`}
          onClick={() => setArt('vektor')}
        >
          PDF – maßstäblich
        </button>
        <button
          className={`knopf${art === 'pdf' ? ' aktiv' : ''}`}
          onClick={() => setArt('pdf')}
        >
          PDF – als Bild
        </button>
        <button
          className={`knopf${art === 'web' ? ' aktiv' : ''}`}
          onClick={() => setArt('web')}
        >
          SVG – für eine Webanwendung
        </button>
      </div>

      {art === 'vektor' ? (
        <>
          <div className="feld-zeile">
            <div className="feld">
              <label>Maßstab</label>
              <select value={massstab} onChange={(e) => setMassstab(Number(e.target.value))}>
                {MASSSTAEBE.map((m) => (
                  <option key={m} value={m}>
                    1:{m}
                  </option>
                ))}
              </select>
            </div>
            <div className="feld">
              <label>Papier</label>
              <select
                value={papier.name}
                onChange={(e) =>
                  setPapier(PAPIERE.find((p) => p.name === e.target.value) ?? PAPIERE[1])
                }
              >
                {PAPIERE.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name} ({p.breite} × {p.hoehe} mm)
                  </option>
                ))}
              </select>
            </div>
            <div className="feld">
              <label>Ausrichtung</label>
              <select value={quer ? 'quer' : 'hoch'} onChange={(e) => setQuer(e.target.value === 'quer')}>
                <option value="quer">Querformat</option>
                <option value="hoch">Hochformat</option>
              </select>
            </div>
          </div>

          {/* Ob es passt, steht **vor** dem Ausgeben da. Sonst probiert man
              Maßstab und Format so lange durch, bis es zufällig hinkommt. */}
          {probe.passt ? (
            <p className="hinweis" style={{ marginTop: 0 }}>
              Passt: Der Plan braucht {probe.brauchtBreiteMm.toFixed(0)} × {probe.brauchtHoeheMm.toFixed(0)} mm
              auf {papier.name} {quer ? 'quer' : 'hoch'}.
            </p>
          ) : (
            <p className="hinweis" style={{ marginTop: 0, color: 'var(--hilfslinie)' }}>
              Passt nicht: Der Plan bräuchte {probe.brauchtBreiteMm.toFixed(0)} ×{' '}
              {probe.brauchtHoeheMm.toFixed(0)} mm.{' '}
              {probe.empfehlung
                ? `Mit 1:${probe.empfehlung} geht es, oder nimm ein größeres Blatt.`
                : 'Nimm ein größeres Blatt.'}
            </p>
          )}

          <p className="hinweis">
            <strong>Echte Linien statt eines Bildes.</strong> Der Plan bleibt bei jeder
            Vergrößerung scharf, die Datei ist klein, und der Maßstab steht im Schriftfeld –
            man kann auf dem Ausdruck mit dem Lineal nachmessen. Dazu Legende und
            Maßstabsbalken; der Balken gilt auch dann noch, wenn ein Kopierer den Plan
            heimlich verkleinert hat. Gezeichnet wird alles, was auch auf dem Bildschirm
            steht: Paletten unter den Böden, Türbögen, Feldbeschriftungen.
          </p>
        </>
      ) : art === 'pdf' ? (
        <>
          <div className="feld-zeile">
            <div className="feld">
              <label>Papier</label>
              <select
                value={papier.name}
                onChange={(e) =>
                  setPapier(PAPIERE.find((p) => p.name === e.target.value) ?? PAPIERE[1])
                }
              >
                {PAPIERE.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name} ({p.breite} × {p.hoehe} mm)
                  </option>
                ))}
              </select>
            </div>
            <div className="feld">
              <label>Ausrichtung</label>
              <select value={quer ? 'quer' : 'hoch'} onChange={(e) => setQuer(e.target.value === 'quer')}>
                <option value="quer">Querformat</option>
                <option value="hoch">Hochformat</option>
              </select>
            </div>
          </div>

          <label className="schalter">
            <input type="checkbox" checked={mitTitel} onChange={(e) => setMitTitel(e.target.checked)} />
            <span>Titel und Fußzeile aufs Blatt</span>
          </label>

          <p className="hinweis">
            Der Plan wird eingepasst und behält seine Seitenverhältnisse. Ein Markt von{' '}
            {(uebersicht.verkaufsflaeche / 10000).toFixed(0)} m² Verkaufsfläche liest sich auf A3
            quer gut; für die Wand nimm A1 oder A0.
          </p>
        </>
      ) : (
        <>
          <p className="hinweis" style={{ marginTop: 0 }}>
            Das SVG trägt ein <strong>Koordinatensystem in Zentimetern</strong>: Ein Punkt darin
            ist ein Zentimeter im Markt. Eine Kamera an der Stelle 1200/800 im Markt sitzt im Bild
            genau bei 1200/800 — ohne Umrechnung, und ohne dass es beim nächsten Export verrutscht.
          </p>
          <p className="hinweis">
            Die Maße stehen zusätzlich am SVG selbst (<code>data-breite-cm</code>,{' '}
            <code>data-hoehe-cm</code>) und alle Möbel mit Position und Warengruppe im
            <code>&lt;metadata&gt;</code>-Block.
          </p>

          <label className="schalter">
            <input
              type="checkbox"
              checked={mitBeispiel}
              onChange={(e) => setMitBeispiel(e.target.checked)}
            />
            <span>
              Beispielseite mitgeben – eine fertige HTML-Datei mit klickbaren Kamerasymbolen zum
              Ausprobieren und Abschauen
            </span>
          </label>
        </>
      )}

      {/* Auflösung und Aufnahme betreffen nur die Wege, die ein Bild vom
          Bildschirm abnehmen. Der maßstäbliche Plan wird gerechnet, nicht
          fotografiert – dort gäbe es keine Auflösung einzustellen. */}
      {art !== 'vektor' && (
        <>
          <div className="feld-zeile" style={{ marginTop: 'var(--abstand-3)' }}>
            <div className="feld">
              <label>Auflösung</label>
              <select
                value={guete.name}
                onChange={(e) => setGuete(GUETEN.find((g) => g.name === e.target.value) ?? GUETEN[1])}
              >
                {GUETEN.map((g) => (
                  <option key={g.name} value={g.name}>
                    {g.name} – {g.hinweis}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="hinweis">
            Beim Ausgeben zoomt der Plan kurz auf Normalgröße und springt danach zurück. Das muss
            sein: Beschriftungen werden nur gezeichnet, wenn sie auch lesbar wären — herausgezoomt
            käme ein Plan ohne Warengruppen heraus.
          </p>
        </>
      )}
    </Dialog>
  );
}
