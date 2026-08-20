import { useRef, useState } from 'react';
import { Dialog } from './Dialog';
import { bestimmeMassstab, type MassstabBefund } from '../logik/planImport/massstab';
import { etagenzahlen, findeGondelpaare, findeZuege, type ErkannterZug } from '../logik/planImport/felder';
import { moebeletiketten, zuMoebel, type ErkanntesMoebel } from '../logik/planImport/moebel';
import { lesePlan, liesFuellflaechen, rendereSeite, type PlanBefund } from '../logik/planImport/pdfLesen';
import {
  farbeGleich,
  findeWandfarbe,
  inZentimeter,
  mittelpunkt,
  nurImGebaeude,
  rahmenAlsUmriss,
  teileEin,
  type Wandkoerper,
} from '../logik/planImport/wandkoerper';
import { BIBLIOTHEK } from '../daten/bibliothek';
import { usePlanStore } from '../zustand/planStore';
import type { Sicherheit } from '../logik/planImport/typen';
import type { Hintergrund } from '../typen/modell';

/**
 * Einen bestehenden Marktplan einlesen.
 *
 * Der Dialog hat drei Zustände: leer, geprüft, eingelesen. Dazwischen wird
 * nichts verändert – der Befund kommt zuerst, damit man sieht, worauf man
 * sich einlässt, bevor siebzig Regale in der Planung stehen.
 *
 * Der Befund ist bewusst ausführlich. Ein Import, der stillschweigend das
 * Falsche tut, ist schlimmer als einer, der gar nichts tut: Ein Regal mit
 * falscher Tiefe sieht richtig aus und fällt erst auf, wenn danach bestellt
 * wird. Deshalb wird jede Unsicherheit angesagt.
 */

interface Befund {
  plan: PlanBefund;
  massstab: MassstabBefund;
  zuege: ErkannterZug[];
  moebel: ErkanntesMoebel[];
  koerper: Wandkoerper[];
  dateiname: string;
  daten: ArrayBuffer;
}

const FARBE: Record<Sicherheit, string> = {
  sicher: 'var(--gut, #2e7d32)',
  wahrscheinlich: 'var(--warn, #b26a00)',
  geraten: 'var(--hilfslinie, #c0392b)',
};

const WORT: Record<Sicherheit, string> = {
  sicher: 'sicher',
  wahrscheinlich: 'wahrscheinlich',
  geraten: 'unsicher',
};

export function PlanImportDialog({ schliessen }: { schliessen: () => void }) {
  const dateiRef = useRef<HTMLInputElement>(null);
  const [laeuft, setzeLaeuft] = useState(false);
  const [fehler, setzeFehler] = useState('');
  const [befund, setzeBefund] = useState<Befund | null>(null);
  const [uebernehmen, setzeUebernehmen] = useState(true);
  const [waendeUebernehmen, setzeWaendeUebernehmen] = useState(true);

  const pruefen = async (datei: File | undefined) => {
    if (!datei) return;
    setzeFehler('');
    setzeLaeuft(true);
    try {
      const daten = await datei.arrayBuffer();
      // pdf.js übernimmt den Puffer und leert ihn dabei. Für das spätere
      // Rendern wird deshalb mit einer Kopie gearbeitet.
      const { befund: plan, dokument } = await lesePlan(daten.slice(0));
      const massstab = bestimmeMassstab(plan.texte);

      let zuege: ErkannterZug[] = [];
      let moebel: ErkanntesMoebel[] = [];
      let koerper: Wandkoerper[] = [];
      if (plan.planart === 'vektor') {
        zuege = findeZuege(etagenzahlen(plan.texte), massstab.mmJePunkt).filter(
          (z) => z.felder.length > 1,
        );
        const paare = findeGondelpaare(zuege, massstab.mmJePunkt);
        const zweiteSeite = new Set(paare.map(([, b]) => b));
        const istGondel = new Set(paare.map(([a]) => a));
        const etiketten = moebeletiketten(plan.texte);
        moebel = zuege
          .map((zug, i) =>
            zweiteSeite.has(i) ? null : zuMoebel(zug, etiketten, massstab.mmJePunkt, istGondel.has(i)),
          )
          .filter((m): m is ErkanntesMoebel => m !== null);

        // Wände kommen aus den gefüllten Flächen, nicht aus langen Linien.
        // Ein CAD-Plan zeichnet sie als Polygone in einer eigenen Farbe, und
        // die findet sich von selbst.
        const flaechen = await liesFuellflaechen(dokument);
        const wandfarbe = findeWandfarbe(flaechen);
        if (wandfarbe) {
          const eigene = flaechen.filter((f) => farbeGleich(f.fuellung, wandfarbe));
          koerper = nurImGebaeude(teileEin(eigene, massstab.mmJePunkt), 2000, massstab.mmJePunkt);
        }
      }

      setzeBefund({ plan, massstab, zuege, moebel, koerper, dateiname: datei.name, daten });
    } catch (e) {
      setzeFehler(e instanceof Error ? e.message : 'Das PDF ließ sich nicht lesen.');
    } finally {
      setzeLaeuft(false);
      if (dateiRef.current) dateiRef.current.value = '';
    }
  };

  const einlesen = async () => {
    if (!befund) return;
    setzeLaeuft(true);
    setzeFehler('');
    try {
      const { dokument } = await lesePlan(befund.daten.slice(0));
      const bild = await rendereSeite(dokument);

      // Der Plan wird im Maßstab 1:1 eingelegt: Ein A1-Blatt im Maßstab 1:100
      // steht für rund 84 × 59 Meter Wirklichkeit. Dadurch liegen die
      // erkannten Möbel von selbst an der richtigen Stelle darauf.
      const jeCm = befund.massstab.mmJePunkt / 10;
      const hintergrund: Hintergrund = {
        bild: bild.bild,
        breite: befund.plan.breitePt * jeCm,
        hoehe: befund.plan.hoehePt * jeCm,
        x: 0,
        y: 0,
        deckkraft: 0.55,
        sichtbar: true,
        gesperrt: true,
        quelle: befund.dateiname,
        massstab: befund.massstab.massstab,
      };

      const store = usePlanStore.getState();
      store.schnappschuss();
      store.setzeHintergrund(hintergrund);

      const baulich = befund.koerper.filter((k) => k.art !== 'fremd');
      if (waendeUebernehmen && baulich.length > 0) {
        const umriss = rahmenAlsUmriss(befund.koerper, befund.massstab.mmJePunkt);
        if (umriss.length >= 3) store.setzeUmriss(umriss);

        // Die Wandzüge werden so uebernommen, wie sie gezeichnet sind.
        store.setzeWandkoerper(
          befund.koerper
            .filter((k) => k.art === 'wand')
            .map((k) => inZentimeter(k.punkte, befund.massstab.mmJePunkt)),
        );

        // Stützen werden zu echten Elementen, mit ihrem echten Maß.
        const stuetze = BIBLIOTHEK.find((v) => v.id === 'stuetze-eckig');
        const stuetzen = befund.koerper.filter((k) => k.art === 'stuetze');
        if (stuetze && stuetzen.length > 0) {
          store.fuegeErkannteMoebelHinzu(
            stuetzen.map((k) => {
              const m = mittelpunkt(k.punkte);
              return {
                vorlage: stuetze,
                x: m.x * jeCm,
                y: m.y * jeCm,
                breite: k.breiteMm / 10,
                tiefe: k.hoeheMm / 10,
                hoehe: 300,
                drehung: 0,
                achsmass: 0,
                beidseitig: false,
                beschriftung: '',
              };
            }),
          );
        }
      }

      if (uebernehmen && befund.moebel.length > 0) {
        store.fuegeErkannteMoebelHinzu(
          befund.moebel.map((m) => ({
            vorlage: m.vorlage,
            x: m.mitte.x * jeCm,
            y: m.mitte.y * jeCm,
            breite: m.breite,
            tiefe: m.tiefe,
            hoehe: m.hoehe,
            drehung: m.drehung,
            achsmass: m.achsmass,
            beidseitig: m.beidseitig,
            beschriftung: `${m.felder} × A${Math.round(m.achsmass * 10)}`,
          })),
        );
      }

      schliessen();
    } catch (e) {
      setzeFehler(e instanceof Error ? e.message : 'Der Plan ließ sich nicht einlesen.');
      setzeLaeuft(false);
    }
  };

  const zaehle = (s: Sicherheit) => befund?.moebel.filter((m) => m.sicherheit === s).length ?? 0;

  return (
    <Dialog
      titel="Bestehenden Marktplan einlesen"
      breit
      schliessen={schliessen}
      fuss={
        <>
          <button className="knopf" onClick={schliessen}>
            Abbrechen
          </button>
          <button
            className="knopf knopf-betont"
            disabled={!befund || laeuft}
            onClick={() => void einlesen()}
          >
            {laeuft ? 'Einen Moment …' : 'Einlesen'}
          </button>
        </>
      }
    >
      <input
        ref={dateiRef}
        type="file"
        accept="application/pdf,.pdf"
        style={{ display: 'none' }}
        onChange={(e) => void pruefen(e.target.files?.[0])}
      />

      {!befund && (
        <>
          <p>
            Ein PDF eines bestehenden Marktplans wird maßstäblich unter die
            Zeichnung gelegt. Ist es ein CAD-Plan, werden zusätzlich die
            Regalzüge ausgelesen.
          </p>
          <button className="knopf" onClick={() => dateiRef.current?.click()} disabled={laeuft}>
            {laeuft ? 'Wird geprüft …' : 'PDF auswählen'}
          </button>
        </>
      )}

      {befund && (
        <>
          <div className="gruppe">
            <div className="gruppe-titel">Befund</div>
            <div className="kennzahl">
              <span>Datei</span>
              <span className="kennzahl-wert">{befund.dateiname}</span>
            </div>
            <div className="kennzahl">
              <span>Blattformat</span>
              <span className="kennzahl-wert">
                {Math.round(befund.plan.blattBreiteMm)} × {Math.round(befund.plan.blattHoeheMm)} mm
                {befund.plan.seiten > 1 && ` · Seite 1 von ${befund.plan.seiten}`}
              </span>
            </div>
            <div className="kennzahl">
              <span>Planart</span>
              <span className="kennzahl-wert">
                {befund.plan.planart === 'vektor' ? 'CAD-Plan' : 'Bildplan'}
              </span>
            </div>
            <p className="hinweis" style={{ marginTop: 2 }}>
              {befund.plan.begruendung}
            </p>

            <div className="kennzahl">
              <span>Maßstab</span>
              <span className="kennzahl-wert" style={{ color: FARBE[befund.massstab.sicherheit] }}>
                1:{befund.massstab.massstab} · {WORT[befund.massstab.sicherheit]}
              </span>
            </div>
            <p className="hinweis" style={{ marginTop: 2 }}>
              {befund.massstab.begruendung}
            </p>
          </div>

          {befund.plan.planart === 'vektor' && befund.koerper.length > 0 && (
            <div className="gruppe">
              <div className="gruppe-titel">Gefundener Grundriss</div>
              <div className="kennzahl">
                <span>Wandzüge</span>
                <span className="kennzahl-wert">
                  {befund.koerper.filter((k) => k.art === 'wand').length}
                </span>
              </div>
              <div className="kennzahl">
                <span>Stützen und Pfeiler</span>
                <span className="kennzahl-wert">
                  {befund.koerper.filter((k) => k.art === 'stuetze').length}
                </span>
              </div>
              <div className="kennzahl">
                <span>Gebäude</span>
                <span className="kennzahl-wert">
                  {(() => {
                    const u = rahmenAlsUmriss(befund.koerper, befund.massstab.mmJePunkt);
                    if (u.length < 3) return '–';
                    const xs = u.map((p) => p.x);
                    const ys = u.map((p) => p.y);
                    const b = (Math.max(...xs) - Math.min(...xs)) / 100;
                    const h = (Math.max(...ys) - Math.min(...ys)) / 100;
                    return `${b.toFixed(2).replace('.', ',')} × ${h.toFixed(2).replace('.', ',')} m`;
                  })()}
                </span>
              </div>
              <div className="kennzahl">
                <span>In der Wandfarbe, aber kein Bauteil</span>
                <span className="kennzahl-wert">
                  {befund.koerper.filter((k) => k.art === 'fremd').length}
                </span>
              </div>
              <label className="schalter" style={{ marginTop: 8 }}>
                <input
                  type="checkbox"
                  checked={waendeUebernehmen}
                  onChange={(e) => setzeWaendeUebernehmen(e.target.checked)}
                />
                <span>Grundriss und Stützen übernehmen</span>
              </label>
              <p className="hinweis" style={{ marginTop: 4 }}>
                Die Wandzüge werden so übernommen, wie sie gezeichnet sind – mit
                jedem Vorsprung und ihrer echten Stärke. Als Grundfläche wird ein
                Rechteck darum gelegt; die wirkliche Form steht in den Wandzügen.
                Ein massiver Block in der Wandfarbe ist meist ein Möbel und wird
                weggelassen, aber Stütze und kleines Möbel lassen sich am Umriss
                allein nicht immer unterscheiden.
              </p>
            </div>
          )}

          {befund.plan.planart === 'vektor' && (
            <div className="gruppe">
              <div className="gruppe-titel">Gefundene Regale</div>
              {befund.moebel.length === 0 ? (
                <p className="hinweis" style={{ marginTop: 0 }}>
                  Keine Regalzüge erkannt. Das Einlesen legt nur die Vorlage
                  unter die Zeichnung – gezeichnet wird dann von Hand.
                </p>
              ) : (
                <>
                  <div className="kennzahl">
                    <span>Regalzüge</span>
                    <span className="kennzahl-wert">{befund.moebel.length}</span>
                  </div>
                  <div className="kennzahl">
                    <span>Regalfelder</span>
                    <span className="kennzahl-wert">
                      {befund.moebel.reduce((s, m) => s + m.felder, 0)}
                    </span>
                  </div>
                  <div className="kennzahl">
                    <span>davon Gondeln</span>
                    <span className="kennzahl-wert">
                      {befund.moebel.filter((m) => m.beidseitig).length}
                    </span>
                  </div>
                  <div className="kennzahl">
                    <span>Einschätzung</span>
                    <span className="kennzahl-wert">
                      <span style={{ color: FARBE.sicher }}>{zaehle('sicher')} sicher</span>
                      {' · '}
                      <span style={{ color: FARBE.wahrscheinlich }}>
                        {zaehle('wahrscheinlich')} wahrscheinlich
                      </span>
                      {' · '}
                      <span style={{ color: FARBE.geraten }}>{zaehle('geraten')} unsicher</span>
                    </span>
                  </div>

                  <label className="schalter" style={{ marginTop: 8 }}>
                    <input
                      type="checkbox"
                      checked={uebernehmen}
                      onChange={(e) => setzeUebernehmen(e.target.checked)}
                    />
                    <span>Erkannte Regale in die Planung übernehmen</span>
                  </label>
                  <p className="hinweis" style={{ marginTop: 4 }}>
                    Die Vorlage bleibt danach liegen. Was übersehen wurde, sieht
                    man nur, wenn der Plan darunter noch sichtbar ist – die
                    Deckkraft lässt sich rechts regeln.
                  </p>
                </>
              )}
            </div>
          )}

          {befund.moebel.some((m) => m.anmerkungen.length > 0) && (
            <div className="gruppe">
              <div className="gruppe-titel">Was zu prüfen ist</div>
              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                {befund.moebel
                  .filter((m) => m.anmerkungen.length > 0)
                  .slice(0, 40)
                  .map((m, i) => (
                    <div key={i} className="kennzahl" style={{ alignItems: 'flex-start' }}>
                      <span style={{ color: FARBE[m.sicherheit], whiteSpace: 'nowrap' }}>
                        {m.felder} × A{Math.round(m.achsmass * 10)}
                      </span>
                      <span
                        className="kennzahl-wert"
                        style={{ textAlign: 'right', fontWeight: 400, whiteSpace: 'normal' }}
                      >
                        {m.anmerkungen.join(' · ')}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}

      {fehler && (
        <p className="hinweis" style={{ color: 'var(--hilfslinie, #c0392b)' }}>
          {fehler}
        </p>
      )}
    </Dialog>
  );
}
