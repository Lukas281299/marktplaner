import { KATEGORIEN } from '../daten/kategorien';
import { WARENGRUPPEN } from '../daten/warengruppen';
import { berechneFlaechen, berechneRegalmeter } from '../logik/flaechen';
import { formatiereFlaeche, formatiereLaenge } from '../logik/masse';
import type { Grundform, KategorieId, PlanElement } from '../typen/modell';
import { usePlanStore, type Ausrichtung } from '../zustand/planStore';
import {
  Auswahlfeld,
  Farbfeld,
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
  const elemente = usePlanStore((s) => s.projekt.elemente);
  const ausgewaehlte = elemente.filter((el) => auswahl.includes(el.id));

  return (
    <aside className="spalte spalte-rechts">
      <div className="spalte-kopf">
        {ausgewaehlte.length === 0
          ? 'Projekt'
          : ausgewaehlte.length === 1
            ? 'Element'
            : `${ausgewaehlte.length} Elemente`}
      </div>
      <div className="spalte-inhalt">
        {ausgewaehlte.length === 0 ? (
          <ProjektEigenschaften />
        ) : (
          <ElementEigenschaften ausgewaehlte={ausgewaehlte} />
        )}
      </div>
    </aside>
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
  const einheit = projekt.einstellungen.anzeigeEinheit;
  const beiStart = () => usePlanStore.getState().schnappschuss();

  const flaechen = berechneFlaechen(projekt);
  const regalmeter = berechneRegalmeter(projekt);

  return (
    <>
      {/* ------------------------------------------------------ Grundfläche */}
      <div className="gruppe">
        <div className="gruppe-titel">Grundfläche des Marktes</div>
        <div className="feld-zeile">
          <Massfeld
            label="Breite"
            cm={projekt.grundflaeche.breite}
            einheit={einheit}
            min={100}
            beiStart={beiStart}
            aendern={(breite) => setzeGrundflaeche({ breite })}
          />
          <Massfeld
            label="Länge"
            cm={projekt.grundflaeche.laenge}
            einheit={einheit}
            min={100}
            beiStart={beiStart}
            aendern={(laenge) => setzeGrundflaeche({ laenge })}
          />
        </div>
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

      {/* ------------------------------------------------------------ Ebenen */}
      <div className="gruppe">
        <div className="gruppe-titel">Ebenen</div>
        {projekt.ebenen.map((ebene) => {
          const anzahl = projekt.elemente.filter((el) => el.ebeneId === ebene.id).length;
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
          <span>Innenfläche</span>
          <span className="kennzahl-wert">{formatiereFlaeche(flaechen.netto)}</span>
        </div>
        <div className="kennzahl">
          <span>Belegt durch Elemente</span>
          <span className="kennzahl-wert">{formatiereFlaeche(flaechen.belegt)}</span>
        </div>
        <div className="kennzahl">
          <span>Freie Fläche</span>
          <span className="kennzahl-wert">{formatiereFlaeche(flaechen.frei)}</span>
        </div>
        <div className="kennzahl">
          <span>Regalmeter</span>
          <span className="kennzahl-wert">
            {regalmeter.toLocaleString('de-DE', { maximumFractionDigits: 1 })} lfm
          </span>
        </div>

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
          bearbeiten. Das gesamte Gebäude misst{' '}
          {formatiereLaenge(projekt.grundflaeche.breite, einheit)} ×{' '}
          {formatiereLaenge(projekt.grundflaeche.laenge, einheit)}.
        </p>
      </div>
    </>
  );
}
