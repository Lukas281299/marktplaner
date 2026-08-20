/**
 * Das Datenmodell des Marktplaners.
 *
 * WICHTIG – die interne Maßeinheit:
 * Intern wird ALLES in Zentimetern gerechnet und gespeichert. Ob dir Meter oder
 * Zentimeter angezeigt werden, ist reine Anzeigesache (siehe `anzeigeEinheit`).
 * Das vermeidet Rundungsfehler und passt zur Praxis im Ladenbau
 * (ein Regalfeld ist z. B. 125 cm breit).
 *
 * Positionen (`x`, `y`) beziehen sich immer auf den MITTELPUNKT eines Elements.
 * Gedreht wird ebenfalls um den Mittelpunkt – so bleibt ein Regal beim Drehen
 * an seinem Platz und wandert nicht weg.
 */

/** In welcher Einheit werden Zahlen angezeigt? Gespeichert wird immer in cm. */
export type Massinheit = 'm' | 'cm';

/** Ein Punkt auf dem Plan, in cm ab der linken oberen Ecke. */
export interface Punkt {
  x: number;
  y: number;
}

/** Oberkategorien der Elementbibliothek. */
export type KategorieId =
  | 'regale'
  | 'kuehlung'
  | 'tiefkuehlung'
  | 'bedienung'
  | 'obstgemuese'
  | 'backwaren'
  | 'kassen'
  | 'aktion'
  | 'ausstattung'
  | 'eigene';

/**
 * Grundformen, aus denen ein Element gezeichnet werden kann.
 *
 * Die ersten sechs sind allgemeine Formen. Alles danach sind Symbole
 * bestimmter Möbel, nachgezeichnet aus den Wanzl-Plänen – sie tragen den
 * Namen des Systems, damit erkennbar bleibt, woher sie kommen.
 */
export type Grundform =
  | 'rechteck'
  | 'abgerundet'
  | 'kreis'
  | 'halbkreis'
  | 'linie'
  | 'pfeil'
  | 'bakeoff'
  | 'bakeoffEcke'
  | 'vitable'
  | 'vitableEckInnen'
  | 'vitableEckAussen'
  | 'vitableAbschluss'
  | 'vitableAbschlussRund'
  | 'tkSchrank'
  | 'tkTruhe'
  | 'tkKombi'
  | 'blinkTheke'
  | 'blinkSelf'
  | 'blinkSv'
  | 'kuehlSchrank'
  | 'kuehlOffen'
  | 'kuehlStufen'
  | 'palette'
  | 'drehstaender'
  // Gebäude und Ausstattung. Diese Symbole stehen für nichts, was man kaufen
  // kann – sie sagen, was im Raum steht, und müssen deshalb auf einen Blick
  // lesbar sein. Eine Treppe soll wie eine Treppe aussehen.
  | 'treppe'
  | 'aufzug'
  | 'saeule'
  | 'tuerBlatt'
  | 'fenster'
  | 'stellflaeche'
  | 'schild'
  | 'regal'
  // Kassenzone. `kasse` ist die Einzelstehkasse; die Sitzkasse kommt mit
  // Stuhl, die Doppelkasse mit zwei Bändern und einer Insel dazwischen.
  | 'kasse'
  | 'kasseSitz'
  | 'kasseDoppel'
  | 'sbKasse'
  | 'ausgangsanlage'
  | 'wagenbox'
  | 'automat'
  | 'zugang'
  // Trockensortiment. wire tech 100 baut alles aus dem gleichen Raster:
  // Achsmaß in der Breite, Grundbodentiefe in der Tiefe, dazu hinten
  // immer 70 mm tote Zone.
  | 'wt100'
  | 'wt100Rund'
  | 'wt100Eck'
  // Bau und Technik. Diese Zeichen stehen für nichts, was geliefert wird –
  // sie halten fest, was im Markt schon da ist und die Planung einschränkt.
  | 'einzelsaeule'
  | 'stuetzeEckig'
  | 'unterzug'
  | 'schacht'
  | 'feuerloescher'
  | 'notausgang'
  | 'rauchabzug'
  | 'bodenablauf'
  | 'anschlussStrom'
  | 'anschlussWasser'
  // Ein freier Umriss. Kommt aus einem eingelesenen Plan: Eine T- oder
  // kreuzförmige Stütze lässt sich durch kein Rechteck ersetzen.
  | 'umriss';

/** Ein Eintrag in der Elementbibliothek (die "Vorlage" links im Fenster). */
export interface BibliothekEintrag {
  /** Eindeutige Kennung der Vorlage, z. B. "regal-trocken". */
  id: string;
  name: string;
  kategorie: KategorieId;
  /** Standardbreite in cm (Ausdehnung in X-Richtung, ungedreht). */
  breite: number;
  /** Standardtiefe in cm (Ausdehnung in Y-Richtung, ungedreht). */
  tiefe: number;
  /** Höhe in cm – nur eine Zusatzinformation, wird im Grundriss nicht gezeichnet. */
  hoehe?: number;
  form: Grundform;
  /** Füllfarbe als Hex-Wert, z. B. "#d8cfc0". */
  farbe: string;
  /** Text, der standardmäßig im Element steht. Leer = Name verwenden. */
  standardBeschriftung?: string;
  /** Kurzer Hinweis für den Mauszeiger-Tooltip. */
  hinweis?: string;
  /**
   * Untergruppe innerhalb der Kategorie, z. B. „Höhe 1800".
   *
   * Sobald eine Abteilung mehr als eine Handvoll Vorlagen hat, ist eine
   * einzige Liste unbrauchbar. Vorlagen mit derselben Gruppe erscheinen in
   * der Bibliothek unter einer eigenen aufklappbaren Überschrift; Vorlagen
   * ohne Gruppe stehen direkt unter der Kategorie.
   */
  gruppe?: string;
  /** Auflagentiefen eines gestuften Möbels – siehe `PlanElement.stufen`. */
  stufen?: number[];
  /** Tiefe des Korpus – siehe `PlanElement.korpustiefe`. */
  korpustiefe?: number;
  /**
   * Achsmaß eines Regalfelds in cm, z. B. 125.
   *
   * Ein Regalzug besteht aus gleich breiten Feldern. Gespeichert wird nur das
   * Maß eines Felds – wie viele es sind, ergibt sich aus der Breite. Wird der
   * Zug länger gezogen, kommen Felder dazu, und genau so wird er bestellt.
   */
  achsmass?: number;

  /** Wird das Möbel von beiden Seiten bestückt? */
  beidseitig?: boolean;
  /** Selbst angelegte Vorlage (nicht mitgeliefert). */
  eigene?: boolean;
}

/** Eine Ebene, z. B. "Regale" oder "Beschriftungen". */
export interface Ebene {
  id: string;
  name: string;
  sichtbar: boolean;
  gesperrt: boolean;
}

/** Ein tatsächlich auf dem Plan platziertes Element. */
export interface PlanElement {
  id: string;
  /** Aus welcher Bibliotheksvorlage stammt das Element? */
  vorlageId: string;
  /** Auf welcher Ebene liegt es? */
  ebeneId: string;
  name: string;
  kategorie: KategorieId;
  /** Mittelpunkt in cm, gemessen ab der linken oberen Ecke der Grundfläche. */
  x: number;
  y: number;
  breite: number;
  tiefe: number;
  /** Nur Information (Möbelhöhe), beeinflusst die Zeichnung nicht. */
  hoehe?: number;
  /** Drehwinkel in Grad, im Uhrzeigersinn, um den Mittelpunkt. */
  drehung: number;
  form: Grundform;
  farbe: string;
  beschriftung: string;
  beschriftungSichtbar: boolean;
  /** Schriftgröße der Beschriftung in Bildschirmpunkten. */
  schriftgroesse: number;
  /** Optionale Zusatzangaben. */
  hersteller?: string;
  warengruppe?: string;
  notiz?: string;
  /** Gesperrte Elemente lassen sich nicht mehr aus Versehen verschieben. */
  gesperrt: boolean;
  /** Zeichenreihenfolge: größere Zahl liegt weiter oben. */
  reihenfolge: number;
  /**
   * Zu welcher Gruppe gehört das Element? Leer = zu keiner.
   *
   * Ein Klick wählt die ganze Gruppe aus, Alt-Klick nur dieses eine Regal.
   */
  gruppeId?: string;
  /**
   * Wird das Regal von beiden Seiten bestückt (Gondel)?
   *
   * Zählt bei den Regalmetern doppelt. Steht am Element und nicht an der
   * Gruppe: Eine Wanzl-Gondel ist **ein** Möbel mit zwei Seiten, während zwei
   * Rücken an Rücken gestellte Wandregale zwei Möbel sind, die schon von
   * selbst zweimal gezählt werden.
   */
  beidseitig?: boolean;
  /**
   * Die Auflagentiefen eines gestuften Möbels, in cm, **tiefste zuerst**.
   *
   * Im Wanzl-Workbook stehen die Varianten genau so: „T 800 + T600 + T400"
   * heißt unterste Auflage 800 tief, darüber 600, oben 400. Von oben gesehen
   * verdeckt jede Auflage die darunter, sichtbar bleiben also Bänder – und
   * genau deren Kanten zeichnet das Symbol.
   *
   * Die Gesamttiefe des Möbels ist die tiefste Auflage. Fehlt die Angabe,
   * wird das Möbel ohne Stufen gezeichnet.
   */
  stufen?: number[];
  /**
   * Tiefe des Korpus in cm – der Teil, der tatsächlich auf dem Boden steht.
   *
   * Bei den Obst- und Gemüsemöbeln kragt die Front über den Korpus hinaus:
   * Ein H1800 / T1200 + T600 hat einen Korpus von 908 mm, nimmt am Boden
   * aber 1317 mm ein. Für den Platzbedarf zählt `tiefe` (die Gesamttiefe),
   * für die Zeichnung zusätzlich diese Kante – erst dahinter beginnt die
   * auskragende Front.
   *
   * Fehlt der Wert, steht das Möbel auf seiner ganzen Tiefe.
   */
  korpustiefe?: number;
  /**
   * Der eigene Umriss des Elements, in cm und relativ zum Mittelpunkt.
   *
   * Nur bei der Form `umriss` gesetzt. Gedacht für Bauteile aus einem
   * eingelesenen Plan: Eine kreuzförmige Stütze hat eine Bounding-Box von
   * 975 × 1400 mm, ist aber nur 300 mm stark. Sie als Rechteck zu setzen
   * wäre um ein Vielfaches zu groß – also wird der Umriss mitgenommen.
   */
  polygon?: Punkt[];
  /**
   * Achsmaß eines Regalfelds in cm – siehe `BibliothekEintrag.achsmass`.
   *
   * Die Zeichnung teilt die Breite in Felder dieses Maßes und setzt in jedes
   * das Achsmaß-Zeichen. Ein 6-m-Zug aus Feldern von 1,25 m bekommt also
   * fünf Diagonalen, nicht eine über die ganze Länge.
   */
  achsmass?: number;
}

/** Wozu mehrere Elemente zusammengefasst sind. */
export type Gruppenart = 'zug' | 'gondel' | 'frei';

/**
 * Eine Gruppe zusammengehörender Elemente.
 *
 * Sie hält nur zusammen, was gemeinsam bewegt werden soll – sie verändert die
 * Elemente nicht. Deshalb steht in ihr auch keine Geometrie: Wo die Regale
 * stehen, wissen die Regale selbst.
 */
export interface Gruppe {
  id: string;
  name: string;
  art: Gruppenart;
}

/**
 * Eine dauerhaft eingezeichnete Maßlinie.
 *
 * Anders als die Abstände, die beim Verschieben kurz aufblitzen, bleibt sie
 * stehen – für alles, was im Plan dokumentiert sein muss: Gangbreiten,
 * Fluchtwege, Abstand zur Wand.
 */
export interface Masslinie {
  id: string;
  von: Punkt;
  bis: Punkt;
  /**
   * Eigener Text statt des gemessenen Maßes. Leer = das Maß anzeigen.
   * Gedacht für Fälle wie „min. 1,20 m" – eine Vorgabe statt eines Istwertes.
   */
  text: string;
  /** Abstand der Maßlinie von der gemessenen Strecke, in cm. */
  versatz: number;
  gesperrt: boolean;
}

/**
 * Wozu ein Raum dient.
 *
 * Die Art entscheidet nicht nur über die Farbe, sondern auch darüber, ob der
 * Raum in der Auswertung zur Verkaufsfläche zählt. Im Ladenbau ist das die
 * Trennlinie, auf die es ankommt: Ein Kühlhaus ist Nebenfläche, auch wenn es
 * mitten im Gebäude liegt.
 */
export type Raumart = 'verkauf' | 'lager' | 'kuehlung' | 'sozial' | 'technik' | 'sonstige';

/** Ein Raum bzw. abgetrennter Bereich innerhalb des Marktes. */
export interface Raum {
  id: string;
  name: string;
  /** Umriss als Polygon in cm. Mindestens drei Punkte. */
  umriss: Punkt[];
  art: Raumart;
  /** Stärke der Trennwände in cm. 0 = nur eine farbige Fläche ohne Wand. */
  wandstaerke: number;
  farbe: string;
  beschriftungSichtbar: boolean;
  /** Gesperrte Räume lassen sich nicht aus Versehen verschieben. */
  gesperrt: boolean;
}

/**
 * Eine markierte Teilfläche der Verkaufsfläche.
 *
 * Ohne Markierung rechnet das Programm die Verkaufsfläche aus: Innenfläche
 * minus alles, was als Nebenraum abgetrennt ist. Das trifft es meistens,
 * aber eben nicht immer – die Vorkassenzone gehört nicht dazu, ein
 * Windfang auch nicht, und eine Fläche, die im Mietvertrag steht, folgt
 * ohnehin einer eigenen Linie.
 *
 * Deshalb kann die Verkaufsfläche stattdessen **eingezeichnet** werden, in
 * beliebig vielen Teilflächen und mit beliebigem Umriss. Sobald auch nur
 * eine gezeichnet ist, gilt das Gezeichnete – dann rechnet niemand mehr
 * heimlich etwas anderes aus.
 */
export interface Verkaufsflaeche {
  id: string;
  name: string;
  /** Umriss als Polygon in cm. Mindestens drei Punkte. */
  umriss: Punkt[];
  farbe: string;
  beschriftungSichtbar: boolean;
  /** Gesperrte Flächen lassen sich nicht aus Versehen verschieben. */
  gesperrt: boolean;
}

/** Wozu eine Innenwand dient – bestimmt nur die Darstellung. */
export type Wandart = 'tragend' | 'trennwand' | 'leicht';

/**
 * Eine einzelne Innenwand.
 *
 * Anders als bei Raum und Gebäude ist `von`/`bis` hier die **Achse** der Wand,
 * nicht ihre Außenkante: Eine freistehende Wand hat keine Innen- und
 * Außenseite, sie steht in der Mitte auf ihrer Linie. Beim Bemaßen ist das
 * auch die Linie, die man im Ladenbau angibt.
 */
export interface Wand {
  id: string;
  von: Punkt;
  bis: Punkt;
  staerke: number;
  art: Wandart;
  gesperrt: boolean;
}

/** Welche Art von Durchbruch in einer Wand sitzt. */
export type Oeffnungsart =
  | 'tuer'
  | 'doppeltuer'
  | 'schiebetuer'
  | 'durchgang'
  | 'rolltor'
  | 'fenster';

/**
 * Eine Öffnung in einer Wand: Tür, Durchgang, Rolltor.
 *
 * Sie hängt bewusst **nicht** an einer bestimmten Wand, sondern liegt frei auf
 * dem Plan und unterbricht optisch, was unter ihr liegt. Der Grund ist
 * praktisch: Eine Tür sitzt oft genau dort, wo eine Raumwand auf die Außenwand
 * trifft. Müsste sie sich für eine der beiden entscheiden, ginge sie beim
 * Verschieben der anderen kaputt.
 *
 * Beim Setzen wird sie trotzdem automatisch an der Wand darunter ausgerichtet –
 * siehe `logik/waende.ts`.
 */
export interface Oeffnung {
  id: string;
  art: Oeffnungsart;
  /** Mittelpunkt der Öffnung in cm. */
  x: number;
  y: number;
  /** Lichte Breite in cm. */
  breite: number;
  /** Stärke der Wand, die durchbrochen wird. */
  tiefe: number;
  /** Drehung in Grad. 0 = die Wand verläuft waagerecht. */
  drehung: number;
  /** Anschlagseite: Auf welche Seite schlägt die Tür auf? */
  gespiegelt: boolean;
  beschriftung: string;
  gesperrt: boolean;
}

/**
 * Die Grundfläche des Gebäudes.
 *
 * Der Umriss ist ein Polygon, kein Rechteck: Ein Markt ist selten ein
 * sauberer Kasten – es kommen Anbauten dazu, Ecken werden ausgespart, und
 * gelegentlich ist die Fläche schlicht schief. Ein Rechteck ist davon nur der
 * einfachste Fall.
 *
 * Der Umriss hat kein Loch. Wäre mitten in der Fläche etwas ausgespart, wäre
 * das in der Praxis ein Raum (Technikzentrale, Innenhof) – und dafür gibt es
 * `Raum`.
 */
export interface Grundflaeche {
  /** Die Eckpunkte im Uhrzeigersinn, in cm. */
  umriss: Punkt[];
  /** Stärke der Außenwand in cm. */
  wandstaerke: number;
  /**
   * Wandkörper aus einem eingelesenen Plan, in cm.
   *
   * Ein CAD-Plan zeichnet Wände nicht als Linie mit Stärke, sondern als
   * gefüllte Polygone – mit jedem Vorsprung, jeder Nische, jeder Schräge.
   * Genau so werden sie hier abgelegt und gezeichnet.
   *
   * Der Umriss daneben bleibt der Rahmen, mit dem die Flächenrechnung
   * arbeitet. Diese Polygone sind die Wirklichkeit darin.
   */
  wandkoerper?: Punkt[][];
}

/** Einstellungen, die das Zeichnen und die Anzeige betreffen. */
export interface Einstellungen {
  anzeigeEinheit: Massinheit;
  rasterSichtbar: boolean;
  /** Abstand der Rasterlinien in cm. */
  rasterWeite: number;
  amRasterEinrasten: boolean;
  /** Automatische Hilfslinien und Einrasten an anderen Elementen. */
  hilfslinienAktiv: boolean;
  /** Abstandsmaße beim Verschieben anzeigen. */
  masseAnzeigen: boolean;
  /**
   * Ob die Beschriftungen der Möbel auf dem Plan stehen.
   *
   * Drei Zustände, weil zwei nicht reichen: Jedes Element bringt eine eigene
   * Beschriftung mit, und ein eingelesener Plan bringt Dutzende auf einmal.
   * Ein bloßes Ein und Aus würde entweder die einzeln getroffene Wahl
   * überschreiben oder nach einem Import nichts zeigen, obwohl die Namen
   * alle da sind.
   *
   *   aus          – keine Beschriftung, der Plan bleibt frei
   *   nachElement  – jedes Element entscheidet selbst (der Normalfall)
   *   alle         – alles beschriften, auch was einzeln abgeschaltet ist
   *
   * Fehlt der Wert in einer älteren Planung, gilt `nachElement` – so
   * ändert sich beim Öffnen nichts.
   */
  beschriftungen?: Beschriftungsanzeige;
}

/** Siehe `Einstellungen.beschriftungen`. */
export type Beschriftungsanzeige = 'aus' | 'nachElement' | 'alle';

/** Ein komplettes Marktprojekt – das ist genau das, was gespeichert wird. */
/**
 * Ein eingelesener Plan, der unter der Zeichnung liegt.
 *
 * Er bleibt auch nach einem Import liegen. Das ist Absicht: Was die
 * Erkennung übersehen hat, sieht man nur, wenn die Vorlage noch da ist.
 * Deshalb lässt sich die Deckkraft regeln, statt den Plan nur ein- und
 * auszuschalten.
 *
 * Das Bild steht als data:-URL im Projekt und wird mit abgeglichen. Es ist
 * damit Teil der Planung und nicht bloß eine Datei auf einem Rechner – wer
 * die Planung öffnet, sieht dieselbe Vorlage.
 */
export interface Hintergrund {
  /** Das gerenderte Blatt als data:-URL. */
  bild: string;
  /** Breite und Höhe im Planmaß, also in Zentimetern. */
  breite: number;
  hoehe: number;
  /** Lage der linken oberen Ecke im Planmaß. */
  x: number;
  y: number;
  /** 0 bis 1. */
  deckkraft: number;
  sichtbar: boolean;
  /** Gegen versehentliches Verschieben. Standardmäßig an. */
  gesperrt: boolean;
  /** Dateiname der Vorlage, für die Anzeige. */
  quelle: string;
  /** Der Nenner des erkannten Maßstabs, z. B. 100 für 1:100. */
  massstab: number;
}

export interface Projekt {
  id: string;
  name: string;
  /** Schemaversion, damit spätere Versionen alte Dateien umwandeln können. */
  version: number;
  erstelltAm: number;
  geaendertAm: number;
  grundflaeche: Grundflaeche;
  einstellungen: Einstellungen;
  ebenen: Ebene[];
  raeume: Raum[];
  /** Eingezeichnete Verkaufsfläche – leer heißt: aus den Räumen gerechnet. */
  verkaufsflaechen: Verkaufsflaeche[];
  /** Freistehende Innenwände, die keinen ganzen Raum abtrennen. */
  waende: Wand[];
  /** Türen, Durchgänge und Tore. */
  oeffnungen: Oeffnung[];
  elemente: PlanElement[];
  /** Zusammengefasste Regale – Züge und Gondeln. */
  gruppen: Gruppe[];
  /** Dauerhaft eingezeichnete Maße. */
  masslinien: Masslinie[];
  /** Ein eingelesener Plan als Vorlage – siehe `Hintergrund`. */
  hintergrund?: Hintergrund;
}

/**
 * Aktuelle Schemaversion. Bei Änderungen am Modell hochzählen – und in
 * `speicher/wandlung.ts` einen Schritt ergänzen, der ältere Planungen
 * nachzieht.
 *
 *   1 – erste Fassung, Grundfläche als Rechteck (Breite × Länge)
 *   2 – Grundfläche und Räume als Polygon, Räume mit Art
 *   3 – einzelne Innenwände und Öffnungen (Türen, Durchgänge)
 *   4 – Gruppen, beidseitige Regale, dauerhafte Maßlinien
 *   5 – Achsmaß am Element, Hintergrundbild aus einem Plan-PDF
 *   6 – eingezeichnete Verkaufsflächen
 *
 * Fassung 5 braucht keinen Umwandlungsschritt: Beide Felder sind wahlfrei.
 * Eine ältere Planung hat kein Achsmaß und keinen Hintergrund, und genau das
 * ist auch die richtige Bedeutung von „nicht gesetzt".
 *
 * Fassung 6 füllt `verkaufsflaechen` mit einer leeren Liste. Das ist die
 * richtige Bedeutung: In einer älteren Planung ist nichts eingezeichnet, also
 * bleibt es bei der gerechneten Verkaufsfläche – die Kennzahl ändert sich
 * durch das Öffnen nicht.
 */
export const SCHEMA_VERSION = 6;
