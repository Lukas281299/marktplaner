import { KATEGORIEN } from '../daten/kategorien';
import { RAUMARTEN, raumart } from '../daten/raumarten';
import { WARENGRUPPEN } from '../daten/warengruppen';
import { berechneFlaechen, berechneRegalmeter, raumflaeche } from '../logik/flaechen';
import { formatiereFlaeche, formatiereLaenge } from '../logik/masse';
import { feldliste, summe } from '../logik/feldaufteilung';
import {
  modulName,
  modulsatzFuer,
  zerlegeInModule,
  type Modulsatz,
} from '../daten/module';
import { hatEcken, kantenlaengen } from '../logik/elementEcken';
import { kannKopfgondel, kopfmasse } from '../logik/kopfgondel';
import { ROHR_UEBERSTAND, SPIEGELBAR } from './zeichenflaeche/ElementSymbol';
import { masslaenge } from '../logik/messen';
import { aussenmasse, flaeche, istRechteck, rahmen, rechteck } from '../logik/polygon';
import { wandlaenge, wandwinkel } from '../logik/waende';
import type {
  Grundform,
  KategorieId,
  Massinheit,
  Masslinie,
  Oeffnung,
  Oeffnungsart,
  PlanElement,
  Raum,
  Raumart,
  Verkaufsflaeche,
  Wand,
} from '../typen/modell';
import { usePlanStore, type Ausrichtung } from '../zustand/planStore';
import {
  Auswahlfeld,
  Farbfeld,
  FeldRahmen,
  Massfeld,
  Schalter,
  Textbereich,
  Textfeld,
  Zahlfeld,
} from './Feld';
import {
  SymbolAugeAus,
  SymbolAuge,
  SymbolAusrichten,
  SymbolDrehenLinks,
  SymbolDrehenRechts,
  SymbolNachHinten,
  SymbolNachVorne,
  SymbolSchloss,
} from './Symbole';

const FORMEN: { wert: Grundform; text: string }[] = [
  { wert: 'rechteck', text: 'Rechteck' },
  { wert: 'abgerundet', text: 'Abgerundetes Rechteck' },
  { wert: 'kreis', text: 'Kreis / Ellipse' },
  { wert: 'halbkreis', text: 'Halbkreis' },
  { wert: 'linie', text: 'Linie' },
  { wert: 'pfeil', text: 'Pfeil' },
  { wert: 'bakeoff', text: 'BakeOff-Turm' },
  { wert: 'bakeoffEcke', text: 'BakeOff-Eckstück' },
];

/**
 * Das Eigenschaftenfenster auf der rechten Seite.
 *
 * Ist etwas ausgewählt, zeigt es die Eigenschaften der Auswahl.
 * Ist nichts ausgewählt, zeigt es die Einstellungen des Projekts,
 * die Ebenen und die Flächenübersicht.
 */
export function Eigenschaftenfenster() {
  const auswahl = usePlanStore((s) => s.auswahl);
  const sonderauswahl = usePlanStore((s) => s.sonderauswahl);
  const projekt = usePlanStore((s) => s.projekt);
  const ausgewaehlte = projekt.elemente.filter((el) => auswahl.includes(el.id));

  const raum = sonderauswahl?.art === 'raum' ? projekt.raeume.find((r) => r.id === sonderauswahl.id) : undefined;
  const wand = sonderauswahl?.art === 'wand' ? projekt.waende.find((w) => w.id === sonderauswahl.id) : undefined;
  const oeffnung =
    sonderauswahl?.art === 'oeffnung'
      ? projekt.oeffnungen.find((o) => o.id === sonderauswahl.id)
      : undefined;
  const mass =
    sonderauswahl?.art === 'masslinie'
      ? projekt.masslinien.find((m) => m.id === sonderauswahl.id)
      : undefined;
  const verkauf =
    sonderauswahl?.art === 'verkaufsflaeche'
      ? projekt.verkaufsflaechen.find((v) => v.id === sonderauswahl.id)
      : undefined;

  const titel = raum
    ? 'Raum'
    : wand
      ? 'Innenwand'
      : oeffnung
        ? 'Öffnung'
        : mass
          ? 'Maß'
          : verkauf
            ? 'Verkaufsfläche'
            : ausgewaehlte.length === 0
              ? 'Projekt'
              : ausgewaehlte.length === 1
                ? 'Element'
                : `${ausgewaehlte.length} Elemente`;

  return (
    <aside className="spalte spalte-rechts">
      <div className="spalte-kopf">{titel}</div>
      <div className="spalte-inhalt">
        {raum ? (
          <RaumEigenschaften raum={raum} />
        ) : wand ? (
          <WandEigenschaften wand={wand} />
        ) : oeffnung ? (
          <OeffnungEigenschaften oeffnung={oeffnung} />
        ) : mass ? (
          <MassEigenschaften mass={mass} />
        ) : verkauf ? (
          <VerkaufsflaecheEigenschaften flaeche={verkauf} />
        ) : ausgewaehlte.length === 0 ? (
          <ProjektEigenschaften />
        ) : (
          <ElementEigenschaften ausgewaehlte={ausgewaehlte} />
        )}
      </div>
    </aside>
  );
}

/** Knöpfe „Auswahl aufheben" und „Löschen" – für Raum, Wand und Öffnung gleich. */
function SonderFuss({ gesperrt, was }: { gesperrt: boolean; was: string }) {
  return (
    <div className="gruppe">
      <div className="knopfreihe">
        <button className="knopf" onClick={() => usePlanStore.getState().waehleSonder(null)}>
          Auswahl aufheben
        </button>
        <button
          className="knopf knopf-gefahr"
          disabled={gesperrt}
          onClick={() => usePlanStore.getState().loescheSonderauswahl()}
          title={gesperrt ? 'Erst die Sperre aufheben' : `${was} löschen`}
        >
          {was} löschen
        </button>
      </div>
    </div>
  );
}

// ===========================================================================
//  Eigenschaften einer Maßlinie
// ===========================================================================

function MassEigenschaften({ mass }: { mass: Masslinie }) {
  const einheit = usePlanStore((s) => s.projekt.einstellungen.anzeigeEinheit);
  const beiStart = () => usePlanStore.getState().schnappschuss();
  const setze = (werte: Partial<Masslinie>) =>
    usePlanStore.getState().aendereMasslinie(mass.id, werte);

  const laenge = masslaenge(mass);

  return (
    <>
      <div className="gruppe">
        <div className="kennzahl">
          <span>Gemessen</span>
          <span className="kennzahl-wert">{formatiereLaenge(laenge, einheit)}</span>
        </div>
        <div className="feld-zeile einspaltig">
          <Textfeld
            label="Eigener Text statt des Maßes"
            wert={mass.text}
            platzhalter={formatiereLaenge(laenge, einheit)}
            beiStart={beiStart}
            aendern={(text) => setze({ text })}
          />
        </div>
        <p className="hinweis" style={{ marginTop: 0 }}>
          Leer lassen, dann steht das gemessene Maß da. Für Vorgaben wie
          „min. 1,20 m" hier den Text eintragen – gemessen wird trotzdem weiter.
        </p>
      </div>

      <div className="gruppe">
        <div className="gruppe-titel">Darstellung</div>
        <Massfeld
          label="Versatz der Maßlinie"
          cm={mass.versatz}
          einheit={einheit}
          min={-2000}
          beiStart={beiStart}
          aendern={(versatz) => setze({ versatz })}
        />
        <p className="hinweis" style={{ marginTop: 6 }}>
          Rückt die Linie seitlich aus dem Weg, damit sie nicht auf dem liegt,
          was sie bemisst. Negative Werte gehen auf die andere Seite.
        </p>
        <Schalter
          label="Gegen Verschieben sperren"
          wert={mass.gesperrt}
          aendern={(gesperrt) => setze({ gesperrt })}
        />
      </div>

      <SonderFuss gesperrt={mass.gesperrt} was="Maß" />
    </>
  );
}

// ===========================================================================
//  Eigenschaften einer Innenwand
// ===========================================================================

function WandEigenschaften({ wand }: { wand: Wand }) {
  const einheit = usePlanStore((s) => s.projekt.einstellungen.anzeigeEinheit);
  const beiStart = () => usePlanStore.getState().schnappschuss();
  const setze = (werte: Partial<Wand>) => usePlanStore.getState().aendereWand(wand.id, werte);

  const laenge = wandlaenge(wand);
  const winkel = wandwinkel(wand.von, wand.bis);

  /** Verlängert oder kürzt die Wand vom Anfangspunkt aus. */
  const setzeLaenge = (neu: number) => {
    if (laenge <= 0 || neu <= 0) return;
    const faktor = neu / laenge;
    setze({
      bis: {
        x: wand.von.x + (wand.bis.x - wand.von.x) * faktor,
        y: wand.von.y + (wand.bis.y - wand.von.y) * faktor,
      },
    });
  };

  return (
    <>
      <div className="gruppe">
        <div className="feld-zeile">
          <Massfeld
            label="Länge"
            cm={laenge}
            einheit={einheit}
            min={10}
            beiStart={beiStart}
            aendern={setzeLaenge}
          />
          <Massfeld
            label="Wandstärke"
            cm={wand.staerke}
            einheit={einheit}
            min={2}
            beiStart={beiStart}
            aendern={(staerke) => setze({ staerke })}
          />
        </div>
        <div className="feld-zeile einspaltig">
          <Auswahlfeld<Wand['art']>
            label="Art"
            wert={wand.art}
            moeglichkeiten={[
              { wert: 'tragend', text: 'Tragende Wand' },
              { wert: 'trennwand', text: 'Trennwand' },
              { wert: 'leicht', text: 'Leichte Wand / Stellwand' },
            ]}
            aendern={(art) => setze({ art })}
          />
        </div>
        <Schalter
          label="Gegen Verschieben sperren"
          wert={wand.gesperrt}
          aendern={(gesperrt) => setze({ gesperrt })}
        />
      </div>

      <div className="gruppe">
        <div className="gruppe-titel">Lage</div>
        <div className="kennzahl">
          <span>Anfang</span>
          <span className="kennzahl-wert">
            {formatiereLaenge(wand.von.x, einheit)} / {formatiereLaenge(wand.von.y, einheit)}
          </span>
        </div>
        <div className="kennzahl">
          <span>Ende</span>
          <span className="kennzahl-wert">
            {formatiereLaenge(wand.bis.x, einheit)} / {formatiereLaenge(wand.bis.y, einheit)}
          </span>
        </div>
        <div className="kennzahl">
          <span>Richtung</span>
          <span className="kennzahl-wert">
            {winkel === 0 ? 'waagerecht' : winkel === 90 ? 'senkrecht' : `${winkel.toFixed(1)}°`}
          </span>
        </div>
      </div>

      <SonderFuss gesperrt={wand.gesperrt} was="Wand" />

      <div className="gruppe">
        <p className="hinweis">
          Die Länge wird vom Anfangspunkt aus geändert – das Ende wandert mit. Zum Verschieben die
          ganze Wand auf dem Plan ziehen.
        </p>
      </div>
    </>
  );
}

// ===========================================================================
//  Eigenschaften einer Öffnung
// ===========================================================================

const OEFFNUNGSARTEN: { wert: Oeffnungsart; text: string }[] = [
  { wert: 'tuer', text: 'Tür' },
  { wert: 'doppeltuer', text: 'Doppeltür' },
  { wert: 'schiebetuer', text: 'Schiebetür' },
  { wert: 'durchgang', text: 'Durchgang (ohne Tür)' },
  { wert: 'rolltor', text: 'Rolltor' },
  { wert: 'fenster', text: 'Fenster' },
];

function OeffnungEigenschaften({ oeffnung }: { oeffnung: Oeffnung }) {
  const einheit = usePlanStore((s) => s.projekt.einstellungen.anzeigeEinheit);
  const beiStart = () => usePlanStore.getState().schnappschuss();
  const setze = (werte: Partial<Oeffnung>) =>
    usePlanStore.getState().aendereOeffnung(oeffnung.id, werte);

  const schlaegtAuf = oeffnung.art === 'tuer' || oeffnung.art === 'doppeltuer';

  return (
    <>
      <div className="gruppe">
        <div className="feld-zeile einspaltig">
          <Auswahlfeld<Oeffnungsart>
            label="Art"
            wert={oeffnung.art}
            moeglichkeiten={OEFFNUNGSARTEN}
            aendern={(art) => setze({ art })}
          />
        </div>
        <div className="feld-zeile">
          <Massfeld
            label="Lichte Breite"
            cm={oeffnung.breite}
            einheit={einheit}
            min={20}
            beiStart={beiStart}
            aendern={(breite) => setze({ breite })}
          />
          <Massfeld
            label="Wandstärke"
            cm={oeffnung.tiefe}
            einheit={einheit}
            min={2}
            beiStart={beiStart}
            aendern={(tiefe) => setze({ tiefe })}
          />
        </div>
        <div className="feld-zeile">
          <Zahlfeld
            label="Drehung"
            einheit="°"
            wert={oeffnung.drehung}
            min={-180}
            max={180}
            schritt={1}
            nachkommastellen={1}
            beiStart={beiStart}
            aendern={(drehung) => setze({ drehung })}
          />
          <div className="feld">
            <label>&nbsp;</label>
            <button
              className="knopf"
              disabled={!schlaegtAuf}
              onClick={() => setze({ gespiegelt: !oeffnung.gespiegelt })}
              title={
                schlaegtAuf
                  ? 'Auf welche Seite die Tür aufschlägt'
                  : 'Nur bei Türen und Doppeltüren'
              }
            >
              Anschlag wechseln
            </button>
          </div>
        </div>
      </div>

      <div className="gruppe">
        <div className="feld-zeile einspaltig">
          <Textfeld
            label="Beschriftung"
            wert={oeffnung.beschriftung}
            beiStart={beiStart}
            aendern={(beschriftung) => setze({ beschriftung })}
          />
        </div>
        <Schalter
          label="Gegen Verschieben sperren"
          wert={oeffnung.gesperrt}
          aendern={(gesperrt) => setze({ gesperrt })}
        />
      </div>

      <SonderFuss gesperrt={oeffnung.gesperrt} was="Öffnung" />

      <div className="gruppe">
        <p className="hinweis">
          Zieh die Öffnung auf dem Plan an eine andere Stelle – sie rastet von selbst in der Wand
          ein, über der sie landet, und übernimmt deren Richtung und Stärke. Die Drehung musst du
          nur dann von Hand setzen, wenn dort gar keine Wand ist.
        </p>
      </div>
    </>
  );
}

// ===========================================================================
//  Eigenschaften eines Raums
// ===========================================================================

function RaumEigenschaften({ raum }: { raum: Raum }) {
  const einheit = usePlanStore((s) => s.projekt.einstellungen.anzeigeEinheit);
  const aendereRaum = usePlanStore((s) => s.aendereRaum);
  const beiStart = () => usePlanStore.getState().schnappschuss();

  const setze = (werte: Partial<Raum>) => aendereRaum(raum.id, werte);
  const info = raumart(raum.art);
  const kasten = rahmen(raum.umriss);

  return (
    <>
      <div className="gruppe">
        <div className="feld-zeile einspaltig">
          <Textfeld label="Name" wert={raum.name} beiStart={beiStart} aendern={(name) => setze({ name })} />
        </div>
        <div className="feld-zeile einspaltig">
          <Auswahlfeld<Raumart>
            label="Art des Raums"
            wert={raum.art}
            moeglichkeiten={RAUMARTEN.map((a) => ({ wert: a.id, text: a.name }))}
            // Die Farbe zieht mit der Art mit – wer sie vorher von Hand
            // geändert hat, bekommt sie beim Umstellen bewusst überschrieben:
            // Sonst hieße ein Raum „Kühlraum" und wäre beige.
            aendern={(art) => setze({ art, farbe: raumart(art).farbe })}
          />
        </div>
        <p className="hinweis" style={{ marginTop: 0 }}>
          {info.hinweis}
        </p>
      </div>

      <div className="gruppe">
        <div className="gruppe-titel">Darstellung</div>
        <div className="feld-zeile">
          <Massfeld
            label="Wandstärke"
            cm={raum.wandstaerke}
            einheit={einheit}
            min={0}
            beiStart={beiStart}
            aendern={(wandstaerke) => setze({ wandstaerke })}
          />
          <Farbfeld label="Farbe" wert={raum.farbe} beiStart={beiStart} aendern={(farbe) => setze({ farbe })} />
        </div>
        <Schalter
          label="Name und Fläche anzeigen"
          wert={raum.beschriftungSichtbar}
          aendern={(beschriftungSichtbar) => setze({ beschriftungSichtbar })}
        />
        <Schalter
          label="Gegen Verschieben sperren"
          wert={raum.gesperrt}
          aendern={(gesperrt) => setze({ gesperrt })}
        />
      </div>

      <div className="gruppe">
        <div className="gruppe-titel">Maße</div>
        <div className="kennzahl">
          <span>Fläche (ohne Wände)</span>
          <span className="kennzahl-wert">{formatiereFlaeche(raumflaeche(raum))}</span>
        </div>
        <div className="kennzahl">
          <span>Umgrenzung</span>
          <span className="kennzahl-wert">
            {formatiereLaenge(kasten.rechts - kasten.links, einheit)} ×{' '}
            {formatiereLaenge(kasten.unten - kasten.oben, einheit)}
          </span>
        </div>
        <div className="kennzahl">
          <span>Ecken</span>
          <span className="kennzahl-wert">{raum.umriss.length}</span>
        </div>
      </div>

      <SonderFuss gesperrt={raum.gesperrt} was="Raum" />

      <div className="gruppe">
        <p className="hinweis">
          Zum Verschieben den Raum auf dem Plan ziehen. Die Regale darin bleiben stehen – sie
          gehören nicht zum Raum, sondern liegen nur darauf.
        </p>
      </div>
    </>
  );
}

// ===========================================================================
//  Feldaufteilung und Kopfgondeln eines Regalzugs
// ===========================================================================

/**
 * Der Zug, Feld für Feld.
 *
 * Ein Regalzug ist kein Balken, den man auf jedes Maß zieht: Er besteht aus
 * Feldern, und jedes hat eines von vier Achsmaßen. Deshalb wird hier nicht
 * eine Breite eingestellt, sondern die Aufteilung – Zahl, Maß und
 * Reihenfolge. Die Breite ergibt sich daraus und nicht umgekehrt.
 */
function Feldaufteilung({
  element,
  satz,
  einheit,
}: {
  element: PlanElement;
  satz: Modulsatz;
  einheit: Massinheit;
}) {
  const store = usePlanStore.getState;
  // Ohne gespeicherte Liste wird sie erschlossen: beim Regalzug aus dem
  // Achsmaß, sonst aus den Einheiten der Abteilung. Eine TK-Truhe von 2,50 m
  // ist damit vier Module und kein Klotz.
  const felder =
    element.felder ??
    (element.achsmass
      ? feldliste(element.breite, element.achsmass)
      : zerlegeInModule(element.breite, satz));
  /** Die Länge aus diesem Satz, die dem Wert am nächsten kommt. */
  const naechste = (wert: number) =>
    satz.laengen.reduce((a, b) => (Math.abs(b - wert) < Math.abs(a - wert) ? b : a));
  const setze = (neu: number[]) => {
    usePlanStore.getState().schnappschuss();
    usePlanStore.getState().setzeFelder(element.id, neu);
  };

  const tausche = (i: number, richtung: -1 | 1) => {
    const ziel = i + richtung;
    if (ziel < 0 || ziel >= felder.length) return;
    const neu = [...felder];
    [neu[i], neu[ziel]] = [neu[ziel], neu[i]];
    setze(neu);
  };

  const koepfeMoeglich = kannKopfgondel(element);
  const masse = koepfeMoeglich ? kopfmasse(element.tiefe) : null;

  return (
    <>
      <div className="gruppe">
        <div className="gruppe-titel">{satz.mehrzahl}</div>

        <div className="kennzahl">
          <span>
            {felder.length} {felder.length === 1 ? satz.einheit : satz.mehrzahl}
          </span>
          <span className="kennzahl-wert">{formatiereLaenge(summe(felder), einheit)}</span>
        </div>

        {satz.laengen
          .map((laenge) => ({
            laenge,
            anzahl: felder.filter((f) => Math.abs(f - laenge) < 0.05).length,
          }))
          .filter((e) => e.anzahl > 0)
          .map((eintrag) => (
            <div className="kennzahl" key={eintrag.laenge}>
              <span>Davon {modulName(satz, eintrag.laenge)}</span>
              <span className="kennzahl-wert">{eintrag.anzahl} ×</span>
            </div>
          ))}

        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {felder.map((feld, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="kategorie-anzahl" style={{ minWidth: 22 }}>
                {i + 1}.
              </span>
              <select
                style={{ flex: 1 }}
                value={String(naechste(feld))}
                onChange={(e) => {
                  const neu = [...felder];
                  neu[i] = Number(e.target.value);
                  setze(neu);
                }}
              >
                {satz.laengen.map((m) => (
                  <option key={m} value={String(m)}>
                    {modulName(satz, m)} · {formatiereLaenge(m, einheit)}
                  </option>
                ))}
              </select>
              <button
                className="knopf knopf-nur-symbol"
                disabled={i === 0}
                title={`${satz.einheit} nach vorn schieben`}
                onClick={() => tausche(i, -1)}
              >
                ↑
              </button>
              <button
                className="knopf knopf-nur-symbol"
                disabled={i === felder.length - 1}
                title={`${satz.einheit} nach hinten schieben`}
                onClick={() => tausche(i, 1)}
              >
                ↓
              </button>
              <button
                className="knopf knopf-nur-symbol knopf-gefahr"
                disabled={felder.length <= 1}
                title={`${satz.einheit} entfernen`}
                onClick={() => setze(felder.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {element.form === 'wt100' && (
          <>
            <Schalter
              label="Führungsrohr vorn"
              wert={Boolean(element.fuehrungsrohr)}
              aendern={(fuehrungsrohr) => {
                usePlanStore.getState().schnappschuss();
                usePlanStore.getState().aendereElemente([element.id], { fuehrungsrohr });
              }}
            />
            <p className="hinweis" style={{ marginTop: 4, marginBottom: 10 }}>
              Die Anschlagschiene für Einkaufswagen, unten vor dem Grundboden. Sie steht{' '}
              {formatiereLaenge(ROHR_UEBERSTAND, einheit)} vor der Front — bei einer Gondel auf
              beiden Seiten. Das Maß ist an einem Foto abgemessen, nicht aus dem Katalog; die
              Tiefe des Regals ändert sich dadurch nicht.
            </p>
          </>
        )}

        <div className="knopfreihe" style={{ marginTop: 8, flexWrap: 'wrap' }}>
          {satz.laengen.map((m) => (
            <button
              key={m}
              className="knopf"
              title={`${satz.einheit} ${modulName(satz, m)} hinten anfügen`}
              onClick={() => setze([...felder, m])}
            >
              + {modulName(satz, m)}
            </button>
          ))}
        </div>

        <p className="hinweis" style={{ marginTop: 8 }}>
          Andere Maße gibt es hier nicht: {satz.herkunft}. Die Länge ist die Summe
          — wird eine Einheit breiter, wächst das Möbel nach hinten, sein Anfang
          bleibt stehen.
        </p>
      </div>

      {koepfeMoeglich && masse && (
        <div className="gruppe">
          <div className="gruppe-titel">Kopfgondeln</div>
          <Schalter
            label="Am Anfang"
            wert={Boolean(element.kopfgondeln?.anfang)}
            aendern={(an) => {
              usePlanStore.getState().schnappschuss();
              store().setzeKopfgondel(element.id, 'anfang', an);
            }}
          />
          <Schalter
            label="Am Ende"
            wert={Boolean(element.kopfgondeln?.ende)}
            aendern={(an) => {
              usePlanStore.getState().schnappschuss();
              store().setzeKopfgondel(element.id, 'ende', an);
            }}
          />
          <p className="hinweis" style={{ marginTop: 6 }}>
            Vor diese Gondel gehört eine <strong>A{Math.round(masse.achsmass * 10)}</strong> mit{' '}
            {formatiereLaenge(masse.tiefe, einheit)} Tiefe — so tief wie eine Gondelseite. Das Maß
            ergibt sich aus der Gondeltiefe und ist nicht einstellbar.
          </p>
          <p className="hinweis">
            Der Kopf ist ein eigenes Möbel und zählt in den Regalmetern mit. Er gehört zur Gruppe
            des Zugs: Verschieben und Drehen nehmen ihn mit. Eine von Hand gesetzte Kopfgondel
            bewegt sich genauso mit, sobald du sie mit dem Zug gruppierst (Strg+G).
          </p>
        </div>
      )}
    </>
  );
}

// ===========================================================================
//  Eigenschaften einer markierten Verkaufsfläche
// ===========================================================================

function VerkaufsflaecheEigenschaften({ flaeche: markierung }: { flaeche: Verkaufsflaeche }) {
  const einheit = usePlanStore((s) => s.projekt.einstellungen.anzeigeEinheit);
  const anzahl = usePlanStore((s) => s.projekt.verkaufsflaechen.length);
  const aendere = usePlanStore((s) => s.aendereVerkaufsflaeche);
  const beiStart = () => usePlanStore.getState().schnappschuss();

  const setze = (werte: Partial<Verkaufsflaeche>) => aendere(markierung.id, werte);
  const kasten = rahmen(markierung.umriss);

  return (
    <>
      <div className="gruppe">
        <div className="feld-zeile einspaltig">
          <Textfeld
            label="Name"
            wert={markierung.name}
            beiStart={beiStart}
            aendern={(name) => setze({ name })}
          />
        </div>
        <p className="hinweis" style={{ marginTop: 0 }}>
          {anzahl === 1
            ? 'Diese Fläche ist die Verkaufsfläche des Marktes. Die Übersicht rechnet ab jetzt mit ihr statt mit den Räumen.'
            : `Eine von ${anzahl} Teilflächen. Die Verkaufsfläche ist ihre Summe – wo zwei sich überlappen, zählt die Überschneidung nur einmal.`}
        </p>
      </div>

      <div className="gruppe">
        <div className="gruppe-titel">Darstellung</div>
        <div className="feld-zeile">
          <Farbfeld
            label="Farbe"
            wert={markierung.farbe}
            beiStart={beiStart}
            aendern={(farbe) => setze({ farbe })}
          />
        </div>
        <Schalter
          label="Name und Fläche anzeigen"
          wert={markierung.beschriftungSichtbar}
          aendern={(beschriftungSichtbar) => setze({ beschriftungSichtbar })}
        />
        <Schalter
          label="Gegen Verschieben sperren"
          wert={markierung.gesperrt}
          aendern={(gesperrt) => setze({ gesperrt })}
        />
      </div>

      <div className="gruppe">
        <div className="gruppe-titel">Maße</div>
        <div className="kennzahl">
          <span>Fläche</span>
          <span className="kennzahl-wert">{formatiereFlaeche(flaeche(markierung.umriss))}</span>
        </div>
        <div className="kennzahl">
          <span>Umgrenzung</span>
          <span className="kennzahl-wert">
            {formatiereLaenge(kasten.rechts - kasten.links, einheit)} ×{' '}
            {formatiereLaenge(kasten.unten - kasten.oben, einheit)}
          </span>
        </div>
        <div className="kennzahl">
          <span>Ecken</span>
          <span className="kennzahl-wert">{markierung.umriss.length}</span>
        </div>
      </div>

      <SonderFuss gesperrt={markierung.gesperrt} was="Fläche" />

      <div className="gruppe">
        <p className="hinweis">
          Zum Verschieben die Fläche auf dem Plan ziehen. Wird die letzte Teilfläche gelöscht,
          rechnet die Übersicht wieder aus den Räumen: Innenfläche minus Nebenräume.
        </p>
      </div>
    </>
  );
}

// ===========================================================================
//  Eigenschaften der Auswahl
// ===========================================================================

function ElementEigenschaften({ ausgewaehlte }: { ausgewaehlte: PlanElement[] }) {
  const einheit = usePlanStore((s) => s.projekt.einstellungen.anzeigeEinheit);
  const ebenen = usePlanStore((s) => s.projekt.ebenen);
  const seitenverhaeltnisHalten = usePlanStore((s) => s.seitenverhaeltnisHalten);
  const setzeSeitenverhaeltnisHalten = usePlanStore((s) => s.setzeSeitenverhaeltnisHalten);

  // Als Anzeigewert dient jeweils das erste Element der Auswahl.
  const erstes = ausgewaehlte[0];
  const ids = ausgewaehlte.map((el) => el.id);
  const mehrere = ausgewaehlte.length > 1;

  /** Merkt den Stand vor einer Eingabe, damit Strg+Z sauber funktioniert. */
  const beiStart = () => usePlanStore.getState().schnappschuss();
  /** Ändert eine Eigenschaft aller ausgewählten Elemente (ohne neuen Historienpunkt). */
  const setze = (werte: Partial<PlanElement>) =>
    usePlanStore.getState().aendereElemente(ids, werte, false);
  /** Wie `setze`, aber als eigener Schritt in der Historie (für Schalter und Knöpfe). */
  const setzeMitPunkt = (werte: Partial<PlanElement>) =>
    usePlanStore.getState().aendereElemente(ids, werte, true);

  const store = usePlanStore.getState();

  /** Name der Gruppe, in der das erste ausgewählte Element steckt. */
  const gruppenName = usePlanStore((s) =>
    erstes.gruppeId ? (s.projekt.gruppen.find((g) => g.id === erstes.gruppeId)?.name ?? null) : null,
  );

  return (
    <>
      {mehrere && (
        <div className="gruppe">
          <p className="hinweis">
            Änderungen gelten für alle {ausgewaehlte.length} ausgewählten Elemente.
          </p>
        </div>
      )}

      {/* ------------------------------------------------------- Allgemein */}
      <div className="gruppe">
        <div className="gruppe-titel">Allgemein</div>
        <div className="feld-zeile einspaltig">
          <Textfeld
            label="Bezeichnung"
            wert={erstes.name}
            beiStart={beiStart}
            aendern={(name) => setze({ name })}
          />
        </div>
        <div className="feld-zeile">
          <Auswahlfeld<KategorieId>
            label="Kategorie"
            wert={erstes.kategorie}
            moeglichkeiten={KATEGORIEN.map((k) => ({ wert: k.id, text: k.name }))}
            beiStart={beiStart}
            aendern={(kategorie) => setzeMitPunkt({ kategorie })}
          />
          <Auswahlfeld
            label="Ebene"
            wert={erstes.ebeneId}
            moeglichkeiten={ebenen.map((e) => ({ wert: e.id, text: e.name }))}
            beiStart={beiStart}
            aendern={(ebeneId) => setzeMitPunkt({ ebeneId })}
          />
        </div>
      </div>

      {/* ------------------------------------------------------------ Maße */}
      <div className="gruppe">
        <div className="gruppe-titel">Maße</div>
        <div className="feld-zeile">
          <Massfeld
            label="Breite"
            cm={erstes.breite}
            einheit={einheit}
            min={2}
            beiStart={beiStart}
            aendern={(breite) => {
              if (seitenverhaeltnisHalten && erstes.breite > 0) {
                const faktor = breite / erstes.breite;
                setze({ breite, tiefe: Math.round(erstes.tiefe * faktor * 10) / 10 });
              } else {
                setze({ breite });
              }
            }}
          />
          <Massfeld
            label="Tiefe"
            cm={erstes.tiefe}
            einheit={einheit}
            min={2}
            beiStart={beiStart}
            aendern={(tiefe) => {
              if (seitenverhaeltnisHalten && erstes.tiefe > 0) {
                const faktor = tiefe / erstes.tiefe;
                setze({ tiefe, breite: Math.round(erstes.breite * faktor * 10) / 10 });
              } else {
                setze({ tiefe });
              }
            }}
          />
        </div>
        <div className="feld-zeile">
          <Massfeld
            label="Höhe"
            cm={erstes.hoehe ?? 0}
            einheit={einheit}
            beiStart={beiStart}
            titel="Nur zur Information – wird im Grundriss nicht gezeichnet."
            aendern={(hoehe) => setze({ hoehe })}
          />
          <Massfeld
            label="Korpustiefe"
            cm={erstes.korpustiefe ?? 0}
            einheit={einheit}
            beiStart={beiStart}
            titel="Der Teil, der auf dem Boden steht. Kragt die Front darüber hinaus, ist die Tiefe größer. 0 = keine auskragende Front."
            aendern={(korpustiefe) => setze({ korpustiefe: korpustiefe > 0 ? korpustiefe : undefined })}
          />
          <div className="feld">
            <label>Fläche</label>
            <div style={{ padding: '5px 0', fontWeight: 600 }}>
              {formatiereFlaeche(erstes.breite * erstes.tiefe)}
            </div>
          </div>
        </div>
        <Schalter
          label="Seitenverhältnis beibehalten"
          wert={seitenverhaeltnisHalten}
          aendern={setzeSeitenverhaeltnisHalten}
          titel="Gilt für die Eckanfasser und für die Eingabefelder oben."
        />
      </div>

      {/* -------------------------------------------------- Position/Drehung */}
      <div className="gruppe">
        <div className="gruppe-titel">Position &amp; Drehung</div>
        <div className="feld-zeile">
          <Massfeld
            label="X (Mitte)"
            cm={erstes.x}
            einheit={einheit}
            min={-100000}
            beiStart={beiStart}
            aendern={(x) => setze({ x })}
          />
          <Massfeld
            label="Y (Mitte)"
            cm={erstes.y}
            einheit={einheit}
            min={-100000}
            beiStart={beiStart}
            aendern={(y) => setze({ y })}
          />
        </div>
        <div className="feld-zeile">
          <Zahlfeld
            label="Drehung"
            einheit="°"
            wert={erstes.drehung}
            schritt={1}
            nachkommastellen={1}
            beiStart={beiStart}
            aendern={(drehung) => setze({ drehung: ((drehung % 360) + 360) % 360 })}
          />
          <div className="feld">
            <label>Um 90° drehen</label>
            <div className="knopfreihe">
              <button
                className="knopf knopf-nur-symbol"
                title="90° gegen den Uhrzeigersinn"
                onClick={() => store.dreheAuswahl(-90)}
              >
                <SymbolDrehenLinks />
              </button>
              <button
                className="knopf knopf-nur-symbol"
                title="90° im Uhrzeigersinn"
                onClick={() => store.dreheAuswahl(90)}
              >
                <SymbolDrehenRechts />
              </button>
            </div>
          </div>
        </div>
      </div>

      {ausgewaehlte.length === 1 && hatEcken(erstes) && (
        <div className="gruppe">
          <div className="gruppe-titel">Ecken</div>
          <p className="hinweis" style={{ marginTop: 0 }}>
            Dieses Möbel hat einen freien Umriss. Auf dem Plan sitzt an jeder Ecke ein Punkt —
            ziehen formt das Möbel um. Die Kantenlängen stehen dabei an den Kanten.
          </p>
          {kantenlaengen(erstes).map((laenge, i) => (
            <div className="kennzahl" key={i}>
              <span>Kante {i + 1}</span>
              <span className="kennzahl-wert">{formatiereLaenge(laenge, einheit)}</span>
            </div>
          ))}
          <p className="hinweis" style={{ marginTop: 6 }}>
            Solange ein solches Möbel ausgewählt ist, gibt es keinen Ziehrahmen — sonst läge
            er über den Eckpunkten. Größe und Drehung stellst du oben unter <em>Maße</em> und
            <em> Position &amp; Drehung</em> ein.
          </p>
        </div>
      )}

      {/* Felder und Kopfgondeln gehören zum Zug, nicht zu seinen Köpfen.
          Deshalb wird der Zug aus der Auswahl herausgesucht statt schlicht
          das erste Element genommen: Sobald ein Kopf gesetzt ist, sind Zug
          und Kopf gemeinsam ausgewählt – und ohne diesen Griff verschwände
          das Feld, mit dem man den zweiten Kopf setzt. */}
      {(() => {
        const zuege = ausgewaehlte.filter((el) => !el.kopfVon);
        if (zuege.length !== 1) return null;
        const satz = modulsatzFuer(zuege[0].form);
        return satz ? <Feldaufteilung element={zuege[0]} satz={satz} einheit={einheit} /> : null;
      })()}

      {/* ------------------------------------------------------ Darstellung */}
      <div className="gruppe">
        <div className="gruppe-titel">Darstellung</div>
        <div className="feld-zeile">
          <Farbfeld
            label="Farbe"
            wert={erstes.farbe}
            beiStart={beiStart}
            aendern={(farbe) => setze({ farbe })}
          />
          <Auswahlfeld<Grundform>
            label="Form"
            wert={erstes.form}
            moeglichkeiten={FORMEN}
            beiStart={beiStart}
            aendern={(form) => setzeMitPunkt({ form })}
          />
        </div>
      </div>

      {/* ------------------------------------------------------ Beschriftung */}
      <div className="gruppe">
        <div className="gruppe-titel">Beschriftung</div>
        <div className="feld-zeile einspaltig">
          <Textfeld
            label="Text"
            wert={erstes.beschriftung}
            beiStart={beiStart}
            aendern={(beschriftung) => setze({ beschriftung })}
          />
        </div>
        <div className="feld-zeile">
          <Zahlfeld
            label="Schriftgröße"
            wert={erstes.schriftgroesse}
            min={4}
            max={60}
            beiStart={beiStart}
            aendern={(schriftgroesse) => setze({ schriftgroesse })}
          />
          <div className="feld">
            <label>Anzeigen</label>
            <Schalter
              label="Sichtbar"
              wert={erstes.beschriftungSichtbar}
              aendern={(beschriftungSichtbar) => setzeMitPunkt({ beschriftungSichtbar })}
            />
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------- Zusatzangaben */}
      <div className="gruppe">
        <div className="gruppe-titel">Zusatzangaben</div>
        <div className="feld-zeile einspaltig">
          <Textfeld
            label="Warengruppe"
            wert={erstes.warengruppe ?? ''}
            vorschlaege={WARENGRUPPEN}
            beiStart={beiStart}
            aendern={(warengruppe) => setze({ warengruppe })}
          />
        </div>
        <div className="feld-zeile einspaltig">
          <Textfeld
            label="Hersteller / Modell"
            wert={erstes.hersteller ?? ''}
            platzhalter="optional"
            beiStart={beiStart}
            aendern={(hersteller) => setze({ hersteller })}
          />
        </div>
        <div className="feld-zeile einspaltig">
          <Textbereich
            label="Notiz"
            wert={erstes.notiz ?? ''}
            beiStart={beiStart}
            aendern={(notiz) => setze({ notiz })}
          />
        </div>
      </div>

      {/* --------------------------------------------------------- Anordnen */}
      <div className="gruppe">
        <div className="gruppe-titel">Anordnen</div>
        <div className="knopfreihe" style={{ marginBottom: 8 }}>
          <button
            className="knopf"
            title="Ganz nach vorne"
            onClick={() => store.setzeReihenfolge('ganzVorne')}
          >
            <SymbolNachVorne /> Vorne
          </button>
          <button
            className="knopf"
            title="Ganz nach hinten"
            onClick={() => store.setzeReihenfolge('ganzHinten')}
          >
            <SymbolNachHinten /> Hinten
          </button>
        </div>

        <label style={{ fontSize: 11, color: 'var(--text-schwach)' }}>Ausrichten</label>
        <div className="knopfreihe" style={{ margin: '3px 0 8px' }}>
          {(
            [
              ['links', 'Linksbündig'],
              ['mitteWaagerecht', 'Waagerecht zentrieren'],
              ['rechts', 'Rechtsbündig'],
              ['oben', 'Oben bündig'],
              ['mitteSenkrecht', 'Senkrecht zentrieren'],
              ['unten', 'Unten bündig'],
            ] as [Ausrichtung, string][]
          ).map(([art, titel]) => (
            <button
              key={art}
              className="knopf knopf-nur-symbol"
              title={titel}
              disabled={ausgewaehlte.length < 2}
              onClick={() => store.richteAus(art)}
            >
              <SymbolAusrichten art={art} />
            </button>
          ))}
        </div>

        <label style={{ fontSize: 11, color: 'var(--text-schwach)' }}>
          Gleichmäßig verteilen (ab 3 Elementen)
        </label>
        <div className="knopfreihe" style={{ margin: '3px 0 8px' }}>
          <button
            className="knopf knopf-nur-symbol"
            title="Waagerecht gleichmäßig verteilen"
            disabled={ausgewaehlte.length < 3}
            onClick={() => store.verteileGleichmaessig('waagerecht')}
          >
            <SymbolAusrichten art="verteilenWaagerecht" />
          </button>
          <button
            className="knopf knopf-nur-symbol"
            title="Senkrecht gleichmäßig verteilen"
            disabled={ausgewaehlte.length < 3}
            onClick={() => store.verteileGleichmaessig('senkrecht')}
          >
            <SymbolAusrichten art="verteilenSenkrecht" />
          </button>
        </div>

        <Schalter
          label="Gesperrt (nicht verschiebbar)"
          wert={erstes.gesperrt}
          aendern={(gesperrt) => setzeMitPunkt({ gesperrt })}
        />

        <button
          className="knopf"
          style={{ width: '100%', marginTop: 8 }}
          onClick={() => usePlanStore.getState().setzeTauschModus(true)}
          title="Danach links eine Vorlage anklicken. Lage und Drehung bleiben; bei einem Regalzug bleibt auch die Feldzahl."
        >
          Durch andere Vorlage ersetzen
        </button>
      </div>

      {/* ------------------------------------------- Gruppe und Regalmeter */}
      <div className="gruppe">
        <div className="gruppe-titel">Zusammenfassen</div>

        {SPIEGELBAR.has(erstes.form) && (
          <>
            <Schalter
              label="Seitenverkehrt (rechte Ausführung)"
              wert={Boolean(erstes.gespiegelt)}
              aendern={(gespiegelt) => setzeMitPunkt({ gespiegelt })}
            />
            <p className="hinweis" style={{ marginTop: 4 }}>
              Ein 45°-Eck gibt es links und rechts. Für eine 90°-Ecke braucht es beide: eines
              normal, eines seitenverkehrt. Über die Drehung geht das nicht — 180° vertauschen
              zwar links und rechts, drehen aber auch die Front nach hinten.
            </p>
          </>
        )}

        <Schalter
          label="Beidseitig bestückt (Gondel)"
          wert={Boolean(erstes.beidseitig)}
          aendern={(beidseitig) => setzeMitPunkt({ beidseitig })}
        />
        <p className="hinweis" style={{ marginTop: 4 }}>
          Zählt bei den Regalmetern doppelt. Gemeint ist <strong>ein</strong> Möbel mit zwei
          Seiten. Zwei Wandregale Rücken an Rücken sind zwei einseitige Möbel – die werden schon
          von selbst zweimal gezählt.
        </p>

        <div className="kennzahl">
          <span>Gruppe</span>
          <span className="kennzahl-wert">{gruppenName ?? 'keine'}</span>
        </div>

        <div className="knopfreihe">
          <button
            className="knopf"
            disabled={ausgewaehlte.length < 2}
            onClick={() => store.gruppiere('zug')}
            title="Als Regalzug zusammenfassen (Strg+G)"
          >
            Zug
          </button>
          <button
            className="knopf"
            disabled={ausgewaehlte.length < 2}
            onClick={() => store.gruppiere('gondel')}
            title="Als Gondel zusammenfassen (Strg+G)"
          >
            Gondel
          </button>
          <button
            className="knopf"
            disabled={!gruppenName}
            onClick={() => store.hebeGruppeAuf()}
            title="Gruppierung auflösen (Strg+Umschalt+G)"
          >
            Lösen
          </button>
        </div>

        <div className="knopfreihe">
          <button
            className="knopf"
            disabled={ausgewaehlte.length < 2}
            onClick={() => store.reiheAneinanderAus()}
            title="Lückenlos aneinanderschieben"
          >
            Aneinanderreihen
          </button>
        </div>

        <p className="hinweis">
          Ein Klick auf ein gruppiertes Regal wählt die ganze Gruppe. Mit gedrückter{' '}
          <strong>Alt</strong>-Taste greifst du ein einzelnes Feld heraus.
        </p>
      </div>
    </>
  );
}

// ===========================================================================
//  Projekteigenschaften (wenn nichts ausgewählt ist)
// ===========================================================================

function ProjektEigenschaften() {
  const projekt = usePlanStore((s) => s.projekt);
  const setzeGrundflaeche = usePlanStore((s) => s.setzeGrundflaeche);
  const setzeEinstellung = usePlanStore((s) => s.setzeEinstellung);
  const setzeEbene = usePlanStore((s) => s.setzeEbene);
  const setzeHintergrund = usePlanStore((s) => s.setzeHintergrund);
  const aendereHintergrund = usePlanStore((s) => s.aendereHintergrund);
  const einheit = projekt.einstellungen.anzeigeEinheit;
  const beiStart = () => usePlanStore.getState().schnappschuss();

  const flaechen = berechneFlaechen(projekt);
  const regalmeter = berechneRegalmeter(projekt);

  const umriss = projekt.grundflaeche.umriss;
  const rechteckig = istRechteck(umriss);
  const masse = aussenmasse(umriss);

  /** Zieht ein rechteckiges Gebäude auf neue Maße – die linke obere Ecke bleibt. */
  const setzeUmrissGroesse = (breite: number, laenge: number) => {
    const kasten = rahmen(umriss);
    usePlanStore.getState().setzeUmriss(rechteck(kasten.links, kasten.oben, breite, laenge));
  };

  return (
    <>
      {/* ------------------------------------------------------ Grundfläche */}
      <div className="gruppe">
        <div className="gruppe-titel">Grundfläche des Marktes</div>

        {/* Solange der Grundriss ein Rechteck ist, lassen sich Breite und
            Länge einfach eintippen. Bei einer zusammengesetzten Form ergäben
            zwei Zahlen keinen Sinn mehr – dann steht dort die Umgrenzung. */}
        {rechteckig ? (
          <div className="feld-zeile">
            <Massfeld
              label="Breite"
              cm={masse.breite}
              einheit={einheit}
              min={100}
              beiStart={beiStart}
              aendern={(breite) => setzeUmrissGroesse(breite, masse.laenge)}
            />
            <Massfeld
              label="Länge"
              cm={masse.laenge}
              einheit={einheit}
              min={100}
              beiStart={beiStart}
              aendern={(laenge) => setzeUmrissGroesse(masse.breite, laenge)}
            />
          </div>
        ) : (
          <>
            <div className="kennzahl">
              <span>Umgrenzung</span>
              <span className="kennzahl-wert">
                {formatiereLaenge(masse.breite, einheit)} × {formatiereLaenge(masse.laenge, einheit)}
              </span>
            </div>
            <div className="kennzahl">
              <span>Ecken</span>
              <span className="kennzahl-wert">{projekt.grundflaeche.umriss.length}</span>
            </div>
            <p className="hinweis" style={{ marginTop: 6 }}>
              Zusammengesetzte Form. Zum Ändern oben in der Werkzeugleiste unter
              <strong> Grundriss</strong> ein Werkzeug wählen.
            </p>
          </>
        )}

        <div className="feld-zeile">
          <Massfeld
            label="Wandstärke"
            cm={projekt.grundflaeche.wandstaerke}
            einheit={einheit}
            min={2}
            beiStart={beiStart}
            aendern={(wandstaerke) => setzeGrundflaeche({ wandstaerke })}
          />
          <Auswahlfeld<'m' | 'cm'>
            label="Maßeinheit"
            wert={einheit}
            moeglichkeiten={[
              { wert: 'm', text: 'Meter' },
              { wert: 'cm', text: 'Zentimeter' },
            ]}
            aendern={(anzeigeEinheit) => setzeEinstellung({ anzeigeEinheit })}
          />
        </div>
      </div>

      {/* ------------------------------------------------------- Planvorlage */}
      {projekt.hintergrund && (
        <div className="gruppe">
          <div className="gruppe-titel">Eingelesener Plan</div>
          <div className="kennzahl">
            <span
              style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              title={projekt.hintergrund.quelle}
            >
              {projekt.hintergrund.quelle}
            </span>
            <span className="kennzahl-wert">1:{projekt.hintergrund.massstab}</span>
          </div>

          <Schalter
            label="Vorlage anzeigen"
            wert={projekt.hintergrund.sichtbar}
            aendern={(sichtbar) => aendereHintergrund({ sichtbar })}
          />

          <FeldRahmen
            label="Deckkraft"
            titel="Blasser stellen, um die eigene Zeichnung besser zu sehen – ganz ausblenden erst, wenn nichts mehr nachzutragen ist."
          >
            <input
              type="range"
              min={5}
              max={100}
              step={5}
              value={Math.round(projekt.hintergrund.deckkraft * 100)}
              onChange={(e) => aendereHintergrund({ deckkraft: Number(e.target.value) / 100 })}
              style={{ width: '100%' }}
            />
          </FeldRahmen>

          <div className="feld-zeile">
            <Massfeld
              label="Versatz X"
              cm={projekt.hintergrund.x}
              einheit={einheit}
              beiStart={beiStart}
              aendern={(x) => aendereHintergrund({ x })}
            />
            <Massfeld
              label="Versatz Y"
              cm={projekt.hintergrund.y}
              einheit={einheit}
              beiStart={beiStart}
              aendern={(y) => aendereHintergrund({ y })}
            />
          </div>

          <button
            className="knopf"
            style={{ width: '100%', marginTop: 6 }}
            onClick={() => setzeHintergrund(undefined)}
            title="Die Vorlage entfernen. Mit Strg+Z kommt sie zurück."
          >
            Vorlage entfernen
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------ Raster */}
      <div className="gruppe">
        <div className="gruppe-titel">Raster &amp; Einrasten</div>
        <div className="feld-zeile">
          <Massfeld
            label="Rasterweite"
            cm={projekt.einstellungen.rasterWeite}
            einheit={einheit}
            min={1}
            aendern={(rasterWeite) => setzeEinstellung({ rasterWeite })}
          />
          <div className="feld">
            <label>&nbsp;</label>
            <Schalter
              label="Raster anzeigen"
              wert={projekt.einstellungen.rasterSichtbar}
              aendern={(rasterSichtbar) => setzeEinstellung({ rasterSichtbar })}
            />
          </div>
        </div>
        <Schalter
          label="Am Raster einrasten"
          wert={projekt.einstellungen.amRasterEinrasten}
          aendern={(amRasterEinrasten) => setzeEinstellung({ amRasterEinrasten })}
        />
        <Schalter
          label="Hilfslinien an Wänden und Nachbarn"
          wert={projekt.einstellungen.hilfslinienAktiv}
          aendern={(hilfslinienAktiv) => setzeEinstellung({ hilfslinienAktiv })}
        />
        <Schalter
          label="Abstände beim Verschieben anzeigen"
          wert={projekt.einstellungen.masseAnzeigen}
          aendern={(masseAnzeigen) => setzeEinstellung({ masseAnzeigen })}
        />
      </div>

      {/* ------------------------------------------------- Beschriftungen */}
      <div className="gruppe">
        <div className="gruppe-titel">Beschriftungen</div>
        <Auswahlfeld
          label="Namen auf dem Plan"
          wert={projekt.einstellungen.beschriftungen ?? 'nachElement'}
          moeglichkeiten={[
            { wert: 'aus', text: 'Aus – nichts beschriften' },
            { wert: 'nachElement', text: 'Je Element – wie einzeln eingestellt' },
            { wert: 'alle', text: 'Alle – auch einzeln abgeschaltete' },
          ]}
          aendern={(beschriftungen) => setzeEinstellung({ beschriftungen })}
        />
        <p className="hinweis" style={{ marginTop: 6 }}>
          Ein eingelesener Plan bringt Dutzende Namen mit, die einzeln
          abgeschaltet sind, damit der Plan lesbar bleibt. Mit „Alle" holt man
          sie alle hervor, ohne die Einstellung an jedem Möbel anfassen zu
          müssen.
        </p>
      </div>

      {/* ------------------------------------------------------------ Ebenen */}
      <div className="gruppe">
        <div className="gruppe-titel">Ebenen</div>
        {projekt.ebenen.map((ebene) => {
          // Auf der Verkaufsflächen-Ebene liegen keine Möbel, sondern die
          // eingezeichneten Teilflächen. Stünde dort stur die Zahl der
          // Elemente, zeigte die Ebene immer eine Null – und sähe leer aus,
          // obwohl etwas darauf liegt.
          const anzahl =
            ebene.id === 'verkaufsflaeche'
              ? projekt.verkaufsflaechen.length
              : projekt.elemente.filter((el) => el.ebeneId === ebene.id).length;
          return (
            <div
              key={ebene.id}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0' }}
            >
              <button
                className="knopf knopf-nur-symbol"
                title={ebene.sichtbar ? 'Ebene ausblenden' : 'Ebene einblenden'}
                onClick={() => setzeEbene(ebene.id, { sichtbar: !ebene.sichtbar })}
              >
                {ebene.sichtbar ? <SymbolAuge /> : <SymbolAugeAus />}
              </button>
              <button
                className={`knopf knopf-nur-symbol${ebene.gesperrt ? ' aktiv' : ''}`}
                title={ebene.gesperrt ? 'Ebene entsperren' : 'Ebene sperren'}
                onClick={() => setzeEbene(ebene.id, { gesperrt: !ebene.gesperrt })}
              >
                <SymbolSchloss />
              </button>
              <span style={{ opacity: ebene.sichtbar ? 1 : 0.5 }}>{ebene.name}</span>
              <span className="kategorie-anzahl" style={{ marginLeft: 'auto' }}>
                {anzahl}
              </span>
            </div>
          );
        })}
      </div>

      {/* ---------------------------------------------------------- Flächen */}
      <div className="gruppe">
        <div className="gruppe-titel">Flächenübersicht</div>
        <div className="kennzahl">
          <span>Gebäude (Außenmaß)</span>
          <span className="kennzahl-wert">{formatiereFlaeche(flaechen.brutto)}</span>
        </div>
        <div className="kennzahl">
          <span>Innenfläche (ohne Außenwand)</span>
          <span className="kennzahl-wert">{formatiereFlaeche(flaechen.netto)}</span>
        </div>
        {flaechen.nebenflaeche > 0 && !flaechen.verkaufsflaecheMarkiert && (
          <div className="kennzahl">
            <span>Nebenflächen (Lager, Kühlung …)</span>
            <span className="kennzahl-wert">− {formatiereFlaeche(flaechen.nebenflaeche)}</span>
          </div>
        )}
        <div className="kennzahl">
          <span>
            <strong>Verkaufsfläche</strong>
            {flaechen.verkaufsflaecheMarkiert && (
              <span className="kategorie-anzahl"> · eingezeichnet</span>
            )}
          </span>
          <span className="kennzahl-wert">{formatiereFlaeche(flaechen.verkaufsflaeche)}</span>
        </div>
        <div className="kennzahl">
          <span>Belegt durch Elemente</span>
          <span className="kennzahl-wert">{formatiereFlaeche(flaechen.belegt)}</span>
        </div>
        {flaechen.verkaufsflaecheMarkiert && flaechen.belegtInVerkauf < flaechen.belegt && (
          <div className="kennzahl">
            <span>Davon auf der Verkaufsfläche</span>
            <span className="kennzahl-wert">{formatiereFlaeche(flaechen.belegtInVerkauf)}</span>
          </div>
        )}
        <div className="kennzahl">
          <span>Freie Verkaufsfläche</span>
          <span className="kennzahl-wert">{formatiereFlaeche(flaechen.frei)}</span>
        </div>
        <div className="kennzahl">
          <span>Regalmeter</span>
          <span className="kennzahl-wert">
            {regalmeter.toLocaleString('de-DE', { maximumFractionDigits: 1 })} lfm
          </span>
        </div>

        {flaechen.verkaufsflaechen.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div className="gruppe-titel">
              {flaechen.verkaufsflaechen.length === 1
                ? 'Eingezeichnete Verkaufsfläche'
                : `Eingezeichnete Teilflächen (${flaechen.verkaufsflaechen.length})`}
            </div>
            {flaechen.verkaufsflaechen.map((teil) => (
              <div className="kennzahl" key={teil.id}>
                <span
                  style={{ cursor: 'pointer' }}
                  onClick={() =>
                    usePlanStore.getState().waehleSonder({ art: 'verkaufsflaeche', id: teil.id })
                  }
                  title="Diese Teilfläche auswählen"
                >
                  {teil.name}
                </span>
                <span className="kennzahl-wert">{formatiereFlaeche(teil.flaeche)}</span>
              </div>
            ))}
            {flaechen.verkaufsflaechen.length > 1 && (
              <p className="hinweis" style={{ marginTop: 6 }}>
                Die Verkaufsfläche oben ist nicht immer die Summe dieser Zeilen: Überlappen sich
                zwei Teilflächen, zählt die Überschneidung dort nur einmal.
              </p>
            )}
          </div>
        )}

        {flaechen.raeume.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div className="gruppe-titel">Räume</div>
            {flaechen.raeume.map((raum) => (
              <div className="kennzahl" key={raum.id}>
                <span
                  style={{ cursor: 'pointer' }}
                  onClick={() => usePlanStore.getState().waehleSonder({ art: 'raum', id: raum.id })}
                  title="Diesen Raum auswählen"
                >
                  {raum.name}
                  {!raum.verkauf && <span className="kategorie-anzahl"> · Nebenfläche</span>}
                </span>
                <span className="kennzahl-wert">{formatiereFlaeche(raum.flaeche)}</span>
              </div>
            ))}
          </div>
        )}

        {flaechen.jeKategorie.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div className="gruppe-titel">Davon je Kategorie</div>
            {flaechen.jeKategorie.map((eintrag) => (
              <div className="kennzahl" key={eintrag.kategorie}>
                <span>
                  {KATEGORIEN.find((k) => k.id === eintrag.kategorie)?.name ?? eintrag.kategorie}
                </span>
                <span className="kennzahl-wert">{formatiereFlaeche(eintrag.flaeche)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="gruppe">
        <p className="hinweis">
          Es ist nichts ausgewählt. Klicke ein Element auf dem Plan an, um seine Eigenschaften zu
          bearbeiten. Das gesamte Gebäude misst {formatiereLaenge(masse.breite, einheit)} ×{' '}
          {formatiereLaenge(masse.laenge, einheit)}.
        </p>
      </div>
    </>
  );
}
