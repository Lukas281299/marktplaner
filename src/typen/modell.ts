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
  | 'blumen'
  | 'getraenke'
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
  // Blumen und Pflanzen. Alle acht teilen eine Bildsprache – runde Löcher im
  // Topfraster –, damit die Abteilung im Plan als eine zu erkennen ist; das
  // Gerüst darum herum unterscheidet sie voneinander.
  | 'blumenregal'
  | 'blumensaeule'
  | 'blumeninsel'
  | 'blumendisplay'
  | 'blumentrog'
  | 'blumentreppe'
  | 'blumenwanne'
  | 'blumenwagen'

  | 'getraenkegestell'
  | 'leergutRuecknahme'
  | 'leergutEinweg'
  | 'dpgBehaelter'
  | 'kastenablage'
  | 'holzblende'
  | 'holzblendeU'
  | 'schiebetueranlage'
  | 'kundenfuehrung'
  | 'egateEinzel'
  | 'egateDoppel'
  | 'foerderband'
  /**
   * Eine Aktions- oder Saisonfläche: eine Zone, kein Möbel.
   *
   * Sie hat keine Einheiten und kein Raster — man zieht sie sich zurecht.
   * Dafür schreibt sie sich selbst voll: ihr Name in der Mitte, ihre
   * Quadratmeter links oben, Länge und Breite rechts oben. Alles drei passt
   * sich der Größe an, damit es beim Ziehen lesbar bleibt.
   */
  | 'aktionsflaeche'
  /**
   * Ein freies Textfeld: eine Anmerkung im Plan, kein Möbel.
   *
   * Gezeichnet wird nur der Text; der Kasten darum ist nur beim Bearbeiten
   * zu sehen. Wie groß der Text steht, sagt die Größe des Kastens — man
   * zieht ihn sich zurecht, wie die Aktionsfläche.
   */
  | 'textfeld'
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
  // Die übrigen Bauteile der ITAB-Kassenzeile. Sie sind eigene Gegenstände
  // und keine anderen Längen: Die Expresskasse hat gar kein Band, die Gondel
  // schließt die Zeile ab, die Packrutsche hängt hinten dran.
  | 'kasseExpress'
  | 'kassengondel'
  | 'packrutsche'
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
   * Tiefe des untersten Bodens in cm.
   *
   * Bei einem Kühlmöbel der Boden, auf dem die schwere Ware steht – das
   * Maß, nach dem man beim Planen als Erstes fragt. Es ist nicht die Tiefe
   * des Möbels und nicht die des Korpus: Der unterste Boden ist tiefer als
   * die Etagen darüber und flacher als das Gehäuse.
   */
  grundboden?: number;
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
  /**
   * Startform eines frei geformten Möbels – siehe `PlanElement.polygon`.
   *
   * Nur bei der Form `umriss`. Eine Ecklösung ist in jedem Markt anders
   * zugeschnitten; die Vorlage gibt einen brauchbaren Anfang vor, die Ecken
   * zieht man danach auf dem Plan zurecht.
   */
  polygon?: Punkt[];
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

/**
 * Was in einem einzelnen Regalfeld steht – je Seite eigene Zeilen.
 *
 * Nur noch für die Umwandlung älterer Planungen da; die Notiz steht heute am
 * Feld selbst, siehe `Regalfeld`.
 */
export interface Feldnotiz {
  oben?: string;
  unten?: string;
}

/**
 * Ein einzelnes Feld einer Regalseite.
 *
 * Bis Fassung 8 teilten sich die beiden Seiten einer Gondel **eine** Liste
 * von Feldbreiten. Das trifft den Normalfall, aber nicht die Wirklichkeit:
 * Man lässt ein Feld auf einer Seite frei, weil dort eine Säule steht, oder
 * baut die Rückseite anders auf als die Vorderseite. Deshalb hat jede Seite
 * jetzt ihre eigene Liste.
 */
export interface Regalfeld {
  /** Achsmaß dieses Felds in cm. */
  breite: number;
  /**
   * Steht hier kein Regal?
   *
   * Der Platz bleibt trotzdem belegt – die Säule steht ja. Gezeichnet wird
   * die Stelle als Lücke, damit man auf dem Plan sieht, dass dort nichts
   * hängt.
   */
  leer?: boolean;
  /**
   * Wie viele Böden dieses Feld trägt.
   *
   * **Eine Zahl und keine Notiz.** Bis hierher stand die Bodenzahl als „5+"
   * in der ersten Zeile von `notiz`, zusammen mit allem anderen, was man sich
   * dort notiert. Das ließ sich lesen, aber nicht rechnen: Für die Meter je
   * Warengruppe muss das Programm wissen, wie viele Auslagen ein Feld hat,
   * und ein Text sagt es ihm nicht.
   *
   * Im Plan ändert sich dadurch nichts – die Zahl erscheint weiter als „5+"
   * in der ersten Zeile des Feldes, nur kommt sie jetzt von hier statt aus
   * dem Text.
   *
   * Gezählt werden die Auslagen, auf denen Ware liegt. Steht unter dem Feld
   * eine Palette oder eine Kiste, zählt die als eine weitere Auslage – die
   * kommt aus `unterbau` und muss hier nicht mitgezählt werden.
   */
  boeden?: number;

  /**
   * Was auf diesem Meter statt gewöhnlicher Böden verbaut ist.
   *
   * Steht zwischen der Bodenzahl und der Notiz, und das ist kein Zufall: Die
   * Bodenzahl sagt, **wie viele** Ebenen es sind, die Ausstattung sagt,
   * **was** sie sind, und die Notiz ist alles, was das Programm nichts
   * angeht. Siehe `Feldausstattung`.
   */
  ausstattung?: Feldausstattung;

  /** Bis zu drei Zeilen, die im Feld stehen – siehe `logik/feldnotiz.ts`. */
  notiz?: string;

  /**
   * Was unter den Böden steht.
   *
   * Im Markt üblich: Oben ein, zwei Böden für die Sichtware, darunter der
   * Nachschub. Das kann eine Palette sein, ein Stapel Getränkekisten oder
   * ein Kühlmöbel, das in die Zeile eingebaut ist. Im Plan ist das ein Feld
   * wie jedes andere – nur dass unten etwas drinsteht.
   *
   * Am Feld und nicht am Möbel: In einem Zug aus zehn Feldern steht selten
   * unter allen dasselbe. Wer es überall haben will, stellt es für jedes
   * Feld ein, und das ist derselbe Handgriff wie beim Bödenschreiben.
   */
  unterbau?: Unterbauplatz;
}

/**
 * Wo im Regal etwas sitzt: oben, in der Mitte oder unten.
 *
 * Grober kann man es nicht sagen, und genauer muss man es nicht: Wer im Markt
 * vor einem Regal steht, sagt „die oberen vier sind Körbe" und nicht „Ebene
 * drei bis sechs".
 */
export type Ausstattungslage = 'oben' | 'mitte' | 'unten';

/**
 * Körbe und Hängeware auf einem Regalmeter.
 *
 * Nicht jeder Meter im Trockensortiment trägt Drahtböden. Manche tragen
 * **Körbe** – schwarze Drahtkörbe, in denen die Ware lose liegt –, und
 * manche eine **Blisterrückwand**: eine Lochwand, an der die Ware an Haken
 * hängt, ganz ohne Böden.
 *
 * **Beides ändert nichts an der Bodenzahl.** Sie steht weiter für sich und
 * zählt weiter in den tatsächlichen Metern: Ein Korb ist eine Auslage wie ein
 * Boden, und wie viel Fläche eine Blisterrückwand wert ist, entscheidet der
 * Planer und nicht das Programm. Was sich ändert, ist das Bild — im Plan und
 * im Raum.
 */
export interface Feldausstattung {
  /**
   * Wie viele der Ebenen Körbe sind, und wo sie sitzen.
   *
   * Gezählt aus den Ebenen, die es ohnehin gibt: Von sechs Ebenen können vier
   * Körbe sein, nicht sieben. Der Grundboden bleibt ein Boden — er ist das
   * Sockelblech und kein Korb.
   */
  koerbe?: { anzahl: number; lage: Ausstattungslage };

  /**
   * Wie viel der Regalfläche an Haken hängt, in Prozent, und wo.
   *
   * Dort gibt es keine Böden: Die Zone gehört der Lochwand. Die Böden
   * verteilen sich über den Rest.
   */
  haengeware?: { anteil: number; lage: 'oben' | 'unten' };
}

/**
 * Was unter einem Regalfeld steht.
 *
 * Die Maße stehen in `logik/unterbau.ts` – dort auch, wie viele wie herum in
 * ein Feld passen.
 */
export interface Unterbauplatz {
  art: Unterbauart;
  /**
   * Wie viele nebeneinander.
   *
   * Fehlt die Angabe, passen so viele hinein, wie das Feld hergibt. Das ist
   * der Regelfall: Wer ein 2,50-m-Feld mit Viertelpaletten belegt, will
   * nicht abzählen, wie viele das sind.
   */
  anzahl?: number;

  /**
   * Wie viele **hintereinander** stehen.
   *
   * Getränkekisten stapelt man nicht nur nebeneinander, sondern auch in die
   * Tiefe: zwei Reihen unter einem 80er Boden, drei unter einem 120er. Was
   * hinten steht, ist Nachschub — es zählt deshalb keine zweite Auslage,
   * sondern belegt nur Platz.
   *
   * Ohne Angabe eine Reihe. Ragt die letzte über die Möbeltiefe hinaus,
   * steht sie im Gang, und der Plan zeigt es.
   */
  reihen?: number;
  /** Liegt die lange Seite parallel zur Regalfront? */
  laengs?: boolean;
  /**
   * Breite und Tiefe in cm – nur bei Arten ohne Normmaß.
   *
   * Ein Kühlmöbel gibt es in jeder Länge; eine Palette nicht. Deshalb steht
   * das Maß hier nur dort, wo es wirklich eine Entscheidung ist.
   */
  breite?: number;
  tiefe?: number;
}

/**
 * Was für ein Ding unter den Böden steht.
 *
 * Die vier Paletten sind Ladungsträger, die Kiste ist Ware, das Kühlmöbel
 * ist ein Gerät. Im Plan belegen sie denselben Platz und werden deshalb
 * gleich behandelt – gezeichnet wird jedes anders.
 */
export type Unterbauart =
  | 'euro'
  | 'chep'
  | 'halb'
  | 'viertel'
  | 'kiste'
  | 'kartoffelkiste'
  | 'kuehlmoebel';

/**
 * Eine Warengruppen-Beschriftung auf einer Strecke des Möbels.
 *
 * **Gemessen wird in Zentimetern, nicht in Feldern.** Ein Feld ist eine
 * bauliche Größe – ein Regalboden im Achsmaß des Systems. Ein Sortiment
 * richtet sich nicht danach: Zwei Sortimente teilen sich drei Meter, und die
 * Grenze läuft dann mitten durch ein Feld. Solange beides dieselbe Einheit
 * benutzte, ließ sich das eine nicht ändern, ohne das andere zu verfälschen –
 * wer die Felder umbaute, um beschriften zu können, zeichnete ein Möbel, das
 * es so nicht gibt.
 *
 * `von` und `bis` zählen ab dem **Anfang des Möbels in der gespeicherten
 * Achse**, nicht in Leserichtung des Plans. Gedreht wird erst beim Zeichnen
 * (siehe `logik/warengruppe.ts`); sonst müsste jede Drehung die Daten
 * umschreiben.
 */
/**
 * Wie sich mehrere Sortimente **eine** Strecke teilen – in Prozent.
 *
 * Ohne diese Angabe gilt, was immer galt: Stehen zwei Namen auf einem Meter,
 * wird daraus in der Auswertung **eine** Zeile mit beiden Namen. Das ist der
 * richtige Normalfall – wer zwei Sortimente zusammen hinstellt, will meistens
 * gar nicht auf den Zentimeter sagen, wie sie sich verteilen.
 *
 * Manchmal will man es doch, und dann ist es immer dieselbe Frage: **Wie viel
 * Prozent gehört wem?** Zwei Fälle, eine Rechnung:
 *
 *  - Die Staubsaugerbeutel stehen mit bei den Haushaltsreinigern, links das
 *    eine und rechts das andere: 50 zu 50.
 *  - Die Dessertsoßen stehen auf 1,25 m, belegen davon aber nur zwei
 *    Regalböden, und darunter steht eine Milchpalette: vielleicht 30 zu 70.
 *
 * Beide Male bekommt jeder seinen Prozentsatz der laufenden **und** der
 * tatsächlichen Meter. Ob die beiden nebeneinander oder übereinander liegen,
 * ändert an der Rechnung nichts – es ändert nur die Zahl, die man einträgt,
 * und die kennt der Planer besser als jede Regel.
 *
 * `werte` steht in derselben Reihenfolge wie die Namen in der Beschriftung.
 * Passt die Länge nicht zur Zahl der Namen – jemand hat den Text geändert –,
 * wird die Aufteilung übergangen und es gilt wieder der Normalfall. Lieber
 * eine Zeile zu wenig aufgeteilt als Meter an der falschen Stelle.
 */
export interface Streckenaufteilung {
  /** Der Anteil je Name. Die Summe ist beliebig und wird umgerechnet. */
  werte: number[];
}

/**
 * Ein Stück innerhalb einer Warengruppenstrecke.
 *
 * Unter dem Möbel steht „Trockenobst" über drei Meter – aber auf dem ersten
 * liegt die Eigenmarke, auf dem zweiten die Marke, auf dem dritten Bio. Diese
 * Aufteilung gehört zur Planung, aber nicht in den Plan: Gedruckt machte sie
 * ihn unlesbar, gerechnet ergäbe sie die Meter doppelt.
 *
 * **Gemessen in derselben Achse wie die Strecke darüber** – Zentimeter ab dem
 * Anfang des Möbels. Damit lässt sich dieselbe Ordnungsregel anwenden, und
 * niemand muss zwei Koordinatensysteme im Kopf halten. Ein Teil, das beim
 * Kürzen aus seiner Strecke fällt, wird mit ihr beschnitten.
 */
export interface Teilsortiment {
  /** Anfang in cm, ab dem Anfang des Möbels. */
  von: number;
  /** Ende in cm. */
  bis: number;
  text: string;
}

export interface Warengruppenabschnitt {
  /** Anfang in cm, ab dem Anfang des Möbels. */
  von: number;
  /** Ende in cm. Immer größer als `von`. */
  bis: number;
  text: string;
  /**
   * Wohin diese Strecke in der Sortimentsliste gehört – der volle Pfad.
   *
   * `Lebensmittel › Feinbackwaren › Kuchen`, also Abteilung, Warengruppe und
   * Sortiment mit demselben Trennzeichen wie `Projekt.sortimentsstand`.
   *
   * **Der Name allein reicht nicht.** „Kuchen" steht in der Liste zweimal:
   * einmal unter Backwaren, einmal unter Lebensmittel › Feinbackwaren. Wer
   * nur den Namen speichert, wirft beim Auswerten zusammen, was im Markt an
   * zwei Enden liegt.
   *
   * **Und er trennt Anzeige von Zuordnung.** Im Plan steht, was `text` sagt –
   * „Marmorkuchen Aktion", wenn es das treffender beschreibt. Wohin die Meter
   * zählen, sagt der Pfad. Beides zu haben ist der Normalfall beim Planen:
   * Man schreibt hin, was dort liegt, und ordnet es einem Sortiment zu.
   *
   * Fehlt der Pfad, gilt der Name – so wie in jeder Planung, die vor dieser
   * Fassung entstanden ist, und so wie bei jedem frei getippten Namen.
   */
  pfad?: string;

  /**
   * Schrifthöhe in cm, falls sie von Hand eingestellt wurde.
   *
   * Ohne Angabe nimmt der Plan seine übliche Größe. Zu breit wird die
   * Beschriftung dadurch nie: Sie bricht um und verkleinert sich, bis sie in
   * ihre Strecke passt – siehe `logik/warengruppe.ts`.
   */
  schrift?: number;

  /**
   * Die Teilsortimente dieser Strecke, Meter für Meter.
   *
   * „Drei Meter Trockenobst" ist die Warengruppe; welcher Meter Eigenmarke
   * ist und welcher Bio, steht hier. **Nicht im Plan und in keiner
   * Meterzahl** – siehe `Teilsortiment`.
   */
  teile?: Teilsortiment[];

  /**
   * Eine freie Notiz zur ganzen Strecke.
   *
   * Für alles, was sich nicht auf einen bestimmten Meter bezieht. Steht
   * ebenfalls nicht im Plan und zählt in keiner Meterzahl mit – aber die
   * Suche findet es.
   */
  notiz?: string;

  /**
   * Wie sich mehrere Namen auf dieser Strecke die Meter teilen.
   *
   * Ohne Angabe bilden sie eine gemeinsame Zeile – siehe
   * `Streckenaufteilung`.
   */
  aufteilung?: Streckenaufteilung;

  /**
   * Diese Strecke ist eine **Sonder- oder Aktionsplatzierung**.
   *
   * Der Meter trägt Werbeware und kein reguläres Sortiment. Er ist trotzdem
   * Fläche der Warengruppe – laufend wie tatsächlich –, und genau so zählt
   * er: unter seiner Warengruppe, aber in einer eigenen Zeile. **Ohne** dass
   * dafür in jedem Sortiment eine Warengruppe „Aktion" angelegt werden muss,
   * und ohne dass ein Sortiment dadurch als untergebracht gilt.
   */
  aktion?: boolean;
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
  /**
   * Der Verlauf eines Förderbands – ein **offener** Zug, in Zentimetern
   * relativ zum Mittelpunkt des Elements, genau wie `polygon`.
   *
   * Ein Band läuft nicht als Rechteck durch den Markt, sondern in einem Zug
   * mit Ecken: von der Rücknahme quer durchs Lager bis zum Kompaktor. Wo es
   * langgeht, entscheidet der Platz vor Ort – deshalb ein Punktzug und keine
   * Länge mit Drehung.
   *
   * `breite` und `tiefe` bleiben der umschließende Kasten, damit alles
   * Übrige – Auswählen, Verschieben, Flächenrechnung – arbeitet wie bei
   * jedem anderen Möbel.
   */
  verlauf?: Punkt[];

  /** Breite des Förderbands quer zum Verlauf, in Zentimetern. */
  bandbreite?: number;

  /**
   * Radius, mit dem die Knicke eines Förderbands abgerundet werden, in cm.
   *
   * Eine Rollenbahn biegt nicht scharf ab: In der Ecke sitzt ein
   * Kurvenmodul, und das hat einen Radius. `0` zeichnet die Ecke scharf –
   * für den Fall, dass zwei gerade Bahnen dort nur aneinanderstoßen.
   */
  eckradius?: number;

  /**
   * Folgt die Beschriftung noch den Maßen des Möbels?
   *
   * Beim Einsetzen steht dort die Bezeichnung aus der Bibliothek –
   * „Wandregal A1000 · T700 · H2200“. Baut der Planer das Regal auf 1,25 m
   * um, soll sie mitziehen; sonst stünde im Plan eine Angabe, die man beim
   * Bestellen abschreibt und die falsch ist.
   *
   * Schreibt er einen eigenen Text hin, ist das seine Entscheidung: Dann
   * steht hier `false` und die Bezeichnung bleibt, wie sie ist.
   */
  beschriftungAutomatisch?: boolean;

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
  /**
   * Die einzelnen Felder eines Zugs, von links nach rechts, in cm.
   *
   * Ein Regalzug muss nicht aus lauter gleichen Feldern bestehen: Ein
   * 6,25-m-Zug ist fünf Felder A1000 und eines A1250 – ein Feld von 6,25 m
   * gibt es nicht. Zulässig sind nur die vier Achsmaße des Systems, siehe
   * `logik/feldaufteilung.ts`.
   *
   * Ist nichts gesetzt, gilt weiter das alte Bild: gleichmäßige Teilung nach
   * `achsmass`. Das ist die richtige Deutung für ältere Planungen, denn genau
   * so wurden sie gezeichnet. `achsmass` bleibt daneben stehen und sagt, mit
   * welchem Maß ein neues Feld angelegt wird.
   *
   * Die Summe der Felder ist die Breite. Wer eines ändert, ändert die Breite
   * mit – anders herum ergäbe es keinen Sinn, weil ein Zug nicht mehr Platz
   * hat als seine Felder.
   */
  felder?: number[];
  /**
   * Kopfgondeln an den beiden Enden eines Zugs.
   *
   * Gespeichert werden die Kennungen der Elemente, die als Kopf davorstehen –
   * nicht ein bloßes Ja/Nein. Eine Kopfgondel ist ein eigenes Möbel: Sie
   * zählt in den Regalmetern mit, hat eine Warengruppe und lässt sich einzeln
   * anfassen. Ein gezeichnetes Anhängsel wäre nichts davon.
   *
   * `anfang` ist das Ende in Richtung des Zugbeginns (links im ungedrehten
   * Zustand), `ende` das andere.
   */
  kopfgondeln?: { anfang?: string; ende?: string };
  /**
   * Zu welchem Zug dieses Element als Kopfgondel gehört.
   *
   * Die Gegenrichtung zu `kopfgondeln`. Beides zu führen ist Absicht: Die
   * Rückrichtung erlaubt es, beim Verschieben eines Kopfes sofort zu sehen,
   * dass er an einem Zug hängt – ohne alle Elemente danach zu durchsuchen.
   */
  kopfVon?: string;
  /**
   * Ist das Bauteil seitenverkehrt eingebaut?
   *
   * Gebraucht bei den Eckstücken: Ein 45-Grad-Eck gibt es als linke und als
   * rechte Ausführung, und für eine 90-Grad-Ecke braucht man je eines von
   * beiden. Über die Drehung geht das nicht – eine Drehung um 180 Grad
   * vertauscht zwar links und rechts, dreht aber auch vorn und hinten, und
   * dann schaut die Front zur Wand statt in den Gang.
   */
  gespiegelt?: boolean;
  /**
   * Führungsrohr vor dem untersten Boden.
   *
   * Die Anschlagschiene, an der ein Einkaufswagen entlangfährt, ohne ins
   * Regal zu stoßen. Sie sitzt unten vor dem Grundboden und steht ein Stück
   * vor – siehe `ROHR_ABSTAND` und `ROHR_DURCHMESSER`.
   *
   * Bei einer Gondel läuft sie auf beiden Seiten, sonst nur vorn.
   */
  fuehrungsrohr?: boolean;
  /**
   * Notizen in den einzelnen Feldern – eine je Feld, von links nach rechts.
   *
   * Was im Plan an einem Regalfeld steht: wie viele Böden es hat, ob Körbe
   * darin sind, was sonst noch wichtig ist. Im Markt liest man das am Regal
   * ab, und im Plan soll es genauso dastehen.
   *
   * Bei einer Gondel hat jedes Feld **zwei** Seiten, und die werden getrennt
   * bestückt – fünf Böden auf der einen Seite können sechs auf der anderen
   * gegenüberstehen. `oben` und `unten` beziehen sich auf das ungedrehte
   * Element. Bei einem einseitigen Regal wird nur `unten` benutzt.
   *
   * Zeilenumbrüche trennen die Zeilen; mehr als drei werden nicht gezeichnet
   * – dann steht es sich im Feld gegenseitig im Weg.
   */
  feldnotizen?: Feldnotiz[];
  /**
   * Die Felder der **vorderen** Seite – beim einseitigen Regal das ganze Regal.
   *
   * „Vorn" ist im ungedrehten Element unten, also die Seite, die vom
   * Grundboden weg zeigt. Bei einem einseitigen wire-tech-Regal liegt die
   * tote Zone oben, das Regal selbst unten.
   */
  felderUnten?: Regalfeld[];
  /**
   * Die Felder der **hinteren** Seite einer Gondel.
   *
   * Fehlt bei einseitigen Möbeln. Die beiden Seiten sind unabhängig: Sie
   * dürfen verschieden viele Felder haben, verschieden breite, und auf jeder
   * Seite können einzelne Felder leer bleiben.
   *
   * Die Breite des Möbels ist die **längere** der beiden Seiten – die kürzere
   * endet dann früher, und man sieht die Stufe im Plan.
   */
  felderOben?: Regalfeld[];

  /**
   * Die Warengruppen der Vorderseite, als Strecken in Zentimetern.
   *
   * Getrennt von den Feldern, weil es verschiedene Dinge sind: Die Felder
   * sagen, wie das Möbel **gebaut** ist, die Abschnitte, was **darauf steht**.
   * Deshalb darf eine Grenze zwischen zwei Sortimenten mitten durch ein Feld
   * laufen.
   */
  warengruppenUnten?: Warengruppenabschnitt[];

  /** Dasselbe für die Rückseite. Nur bei beidseitigen Möbeln. */
  warengruppenOben?: Warengruppenabschnitt[];

  /**
   * Die Auslagen eines Obst- und Gemüsemöbels.
   *
   * Wie viele Böden das Möbel trägt. Bei Regalen steht das von Hand in der
   * Notiz – dort ist es eine Entscheidung. Ein Vitable-Tisch dagegen bringt
   * seine Auslagen mit; sie hängen am Modul und nicht am Planer, und deshalb
   * ist es eine Zahl und keine Notiz.
   */
  auslagen?: number;

  /**
   * Wie viele laufende Meter diese **Fläche** zählt, in Zentimetern.
   *
   * Nur für freie Flächen. Streusalz im Winter, Grillkohle im Sommer,
   * Aktionspaletten in der Molkerei – das sind Meter des Sortiments, aber
   * kein Regal. Die gezeichnete Fläche sagt, **wo** sie liegen; wie viele es
   * sind, sagt diese Zahl, denn die Breite eines Rechtecks hängt daran, wie
   * herum man es gezogen hat.
   *
   * **Ohne diese Zahl zählt eine Fläche gar nicht** – so wie bisher. Erst
   * wer sie einträgt, sagt: Das hier sind so viele Meter. Die Warengruppen
   * darauf teilen sie sich in demselben Verhältnis wie auf jedem Möbel.
   */
  meterVorgabe?: number;

  /**
   * Wie viele grüne Kisten auf dieses Möbel gehen.
   *
   * Die zweite Kennzahl der Obstabteilung, und die, um die es beim Bestellen
   * geht: Was hier steht, summiert die Flächenübersicht über die ganze
   * Abteilung. Ein Möbel weiß, wie viele Kisten daraufpassen – der Planer
   * trägt es einmal ein und liest die Summe danach ab.
   */
  ifkoKisten?: number;

  /**
   * Sind `auslagen` und `ifkoKisten` an **diesem** Stück von Hand gesetzt?
   *
   * Die Zahlen gehören sonst zum Möbel**typ**: Ein Vitable-Tisch A1250 fasst
   * immer dasselbe, und wer es einmal einträgt, trägt es für alle ein. Das
   * ist der Regelfall und spart die Arbeit.
   *
   * Manchmal stimmt es aber nicht: ein halbrundes Kopfstück, ein frei
   * gezogenes Möbel, eine Ecke, in der zwei Kisten weniger stehen. Dann wird
   * die Zahl an diesem Stück geändert, und **diese Marke schützt sie**: Wer
   * danach die Typvorgabe ändert, überschreibt alle anderen, aber nicht
   * dieses. Ohne die Marke hätte jede Änderung am Typ die Handarbeit still
   * weggewischt.
   */
  kennzahlEigen?: boolean;

  /**
   * Die Kisten vor einem Getränkegestell.
   *
   * Die Getränkeabteilung besteht nicht aus Regalen, sondern aus schmalen
   * Gestellen für die Preisschilder – den Platz brauchen die Kisten davor.
   * Deshalb gibt hier nicht das Möbel seine Tiefe vor, sondern die Kisten
   * geben sie ihm: Wer eine Reihe anhängt, macht die Gasse schmaler.
   *
   * Wie viele Kisten nebeneinander stehen, wird **gerechnet** und nicht
   * gespeichert – siehe `logik/getraenkekisten.ts`. Eine Zahl, die man
   * eintippen kann, wäre eine Zahl, die falsch sein kann.
   */
  kisten?: {
    /** Liegt die lange Seite der Kiste parallel zum Gestell oder quer dazu? */
    lage: 'laengs' | 'quer';
    /** Wie viele Reihen hintereinander. */
    reihen: number;
    /** Nur eine Seite bestücken – so steht ein Gestell an der Wand. */
    einseitig?: boolean;
    /**
     * Die Rückseite, wenn sie anders bestückt ist als die Vorderseite.
     *
     * Der Regelfall ist, dass beide Seiten gleich aussehen – dann fehlt die
     * Angabe und `lage`/`reihen` gelten für beide. Gleich sind sie aber
     * nicht immer: Zur Gasse hin stehen drei Reihen quer, zur Wand hin zwei
     * längs, weil dort weniger Platz ist. Wer das plant, plant genau das.
     */
    rueckseite?: {
      lage: 'laengs' | 'quer';
      reihen: number;
    };
  };
  /**
   * Dürfen die beiden Seiten verschieden eingeteilt sein?
   *
   * Normalerweise nicht: Wer einen Zug verlängert, verlängert das Möbel und
   * nicht eine Seite davon. Beide Seiten laufen deshalb im Gleichschritt, bis
   * das hier ausdrücklich gelöst wird.
   *
   * Was in den Feldern steht – Notizen, Warengruppen, leere Felder – ist
   * davon unberührt und gehört immer der einzelnen Seite.
   *
   * Ohne Angabe entscheidet der Zustand: Ein Zug, dessen Seiten schon
   * verschieden sind, behält seine Freiheit.
   */
  seitenGetrennt?: boolean;
  /**
   * Tiefe des untersten Bodens in cm.
   *
   * Bei einem Kühlmöbel der Boden, auf dem die schwere Ware steht – das
   * Maß, nach dem man beim Planen als Erstes fragt. Es ist nicht die Tiefe
   * des Möbels und nicht die des Korpus: Der unterste Boden ist tiefer als
   * die Etagen darüber und flacher als das Gehäuse.
   */
  grundboden?: number;
}

/**
 * Ein einzelnes Feld eines Möbels – ein Meter im Plan.
 *
 * Nicht das Möbel: Eine Gondel ist **ein** Element mit sechs Feldern, und die
 * sechs Meter darin tragen verschiedene Warengruppen.
 */
export interface Feldbezug {
  element: string;
  seite: 'oben' | 'unten';
  /** Die Nummer in der Feldliste dieser Seite. */
  feld: number;
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
  /**
   * Der Umriss einer als **Fläche** gezeichneten Wand.
   *
   * Eine Wand aus Achse und Stärke ist überall gleich dick. Das reicht für
   * neun von zehn Wänden und für keine einzige abgeschrägte Ecke: Wo zwei
   * Wände in einem stumpfen Winkel zusammenlaufen, ist der Zwickel dazwischen
   * ein Trapez, und ein Trapez hat keine Stärke, sondern zwei.
   *
   * Deshalb darf eine Wand stattdessen ihren Umriss mitbringen – Ecke für
   * Ecke gesetzt wie bei einem Raum. `von`/`bis` und `staerke` bleiben
   * trotzdem gefüllt: Sie sind dann die **abgeleitete** Achse und die
   * mittlere Dicke, damit Türen, Bemaßung und Einrasten weiter rechnen
   * können, ohne von der Fläche zu wissen.
   */
  umriss?: Punkt[];
}

/** Welche Art von Durchbruch in einer Wand sitzt. */
export type Oeffnungsart =
  | 'tuer'
  | 'doppeltuer'
  | 'schiebetuer'
  | 'schiebetuerDoppel'
  | 'durchgang'
  | 'rolltor'
  | 'sektionaltor'
  | 'fenster'
  | 'schaufenster'
  | 'notausgang';

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
  /**
   * Der Ordner, in dem diese Planung liegt – oder nichts.
   *
   * Eine Ebene, kein Baum: Ein Markt bekommt einen Ordner, und darin liegen
   * seine Planungen – Bestand, Umbau, Variante. Verschachtelte Ordner würden
   * das Suchen nicht kürzer machen, sondern nur das Anlegen länger.
   *
   * Fehlt der Ordner, steht die Planung unter „Ohne Ordner". Das ist keine
   * Notlösung, sondern der Normalfall für alles, was man schnell anlegt.
   */
  ordner?: string;
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
  /**
   * Welche Warengruppen in diesem Markt abgehakt sind.
   *
   * Der Schlüssel ist der Pfad in der Sortimentsliste – `Abteilung`,
   * `Abteilung › Warengruppe` oder `Abteilung › Warengruppe › Sortiment`.
   * Was nicht darinsteht, ist **offen**.
   *
   * Gehört zur Planung und nicht zur Liste: Die Liste sagt, was es gibt, der
   * Haken sagt, was in **diesem** Markt daraus geworden ist. Ein zweiter
   * Markt fängt wieder bei null an.
   */
  sortimentsstand?: Record<string, 'gruen' | 'grau'>;

  /**
   * Welche Warengruppe für die Rechnung zu welcher anderen zählt.
   *
   * Wer vier Meter „Kuchen" einzeichnet, obwohl dort auch Waffeln liegen,
   * ordnet Waffeln dem Kuchen zu. Die Meter laufen dann über Kuchen, und in
   * der Auswertung sieht es nicht so aus, als sei Waffeln vergessen worden.
   *
   * Der Schlüssel ist der Name in Kleinschreibung, der Wert der Zielname,
   * wie er geschrieben wird. Verglichen wird über den Namen und nicht über
   * den Pfad: Im Plan steht ein Name und keine Abteilung davor.
   *
   * **Einer Kette wird nicht gefolgt.** Eine Zuordnung ist eine Aussage über
   * zwei Namen, keine Vererbung – und eine versehentliche Ringzuordnung
   * liefe sonst endlos.
   *
   * Gehört wie der Haken zur Planung und nicht zur Liste: Im Nachbarmarkt
   * liegen die Waffeln vielleicht bei den Keksen.
   */
  zuordnungen?: Record<string, string>;
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
 *   7 – eigene Ebene für die Verkaufsfläche
 *   8 – ein Grauton für das ganze Trockensortiment
 *   9 – jede Gondelseite mit eigener Feldeinteilung
 *  10 – „Aktionsfläche" steht in der Fläche
 *  11 – Kopfgondeln schauen in den Gang
 *  12 – Aktionsflächen sind eine eigene Grundform
 *  13 – abgehakte Warengruppen je Markt
 *  14 – Warengruppen als Band unter einer Auswahl (wieder aufgegeben)
 *  15 – Warengruppen messen in Zentimetern statt in Feldern
 *
 * Fassung 5 braucht keinen Umwandlungsschritt: Beide Felder sind wahlfrei.
 * Eine ältere Planung hat kein Achsmaß und keinen Hintergrund, und genau das
 * ist auch die richtige Bedeutung von „nicht gesetzt".
 *
 * Fassung 6 füllt `verkaufsflaechen` mit einer leeren Liste. Das ist die
 * richtige Bedeutung: In einer älteren Planung ist nichts eingezeichnet, also
 * bleibt es bei der gerechneten Verkaufsfläche – die Kennzahl ändert sich
 * durch das Öffnen nicht.
 *
 * Fassung 7 trägt fehlende Standardebenen nach. Ohne diesen Schritt hätte
 * eine ältere Planung die Ebene „Verkaufsfläche" nicht, und was auf ihr
 * liegt, wäre unsichtbar – ohne Schalter, mit dem man es zurückholt.
 */
/**
 * Fassung 8 zieht die Farbe nach. Wandregal, Gondel und Kopfgondel hatten drei
 * Grautöne; jetzt ist es einer. Bestehende Planungen bekommen ihn beim Öffnen,
 * aber nur dort, wo noch einer der alten Töne steht – wer ein Regal von Hand
 * eingefärbt hat, behält seine Farbe.
 */
/**
 * Fassung 9 gibt jeder Gondelseite ihre eigene Feldliste. Bis dahin teilten
 * sich beide Seiten eine – die Umwandlung schreibt die vorhandene Einteilung
 * einfach auf beide Seiten, samt der Notizen, die dort schon standen. Am Bild
 * ändert sich dadurch nichts.
 */
/**
 * Fassung 10 schreibt „Aktionsfläche" in die Aktionsflächen. Bis dahin stand
 * dort der Name der Vorlage samt Maßen, und der wurde in der Fläche
 * abgeschnitten.
 */
/**
 * Fassung 11 dreht jede Kopfgondel so, dass sie mit dem Rücken am Zug steht.
 * Bis dahin zeigte ihre Front zum Zug – sichtbar wurde das erst, als Notiz
 * und Warengruppe an der Front erschienen.
 */
/**
 * Fassung 12 macht aus den Aktionsflächen eine eigene Grundform. Vorher waren
 * es Rechtecke wie jedes andere und trugen deshalb weder ihre Quadratmeter
 * noch ihre Maße.
 */
/**
 * Fassung 13 merkt sich, welche Warengruppen in diesem Markt abgehakt sind.
 * Ein neues Feld ohne Umwandlung: Was nicht dasteht, ist offen.
 */
/**
 * Fassung 14 legt die Warengruppen-Beschriftung als **Band** unter eine
 * Auswahl von Möbeln, statt sie an ein einzelnes Feld zu hängen. Ein neues
 * Feld ohne Umwandlung: Was nicht dasteht, gibt es nicht.
 */
export const SCHEMA_VERSION = 21;
