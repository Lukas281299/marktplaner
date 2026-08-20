/**
 * Kleine Symbole für Schaltflächen.
 *
 * Alle Symbole sind einfache Strichzeichnungen im 24×24-Raster und nehmen die
 * Textfarbe der Schaltfläche an. Ein neues Symbol ergänzt man, indem man unten
 * eine weitere Zeile nach demselben Muster einfügt.
 */
import type { ReactNode } from 'react';

function Zeichnung({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const SymbolNeu = () => (
  <Zeichnung>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M12 11v6M9 14h6" />
  </Zeichnung>
);

export const SymbolOeffnen = () => (
  <Zeichnung>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </Zeichnung>
);

export const SymbolSpeichern = () => (
  <Zeichnung>
    <path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
    <path d="M8 3v6h7M8 14h8v7H8z" />
  </Zeichnung>
);

export const SymbolImport = () => (
  <Zeichnung>
    <path d="M12 3v11m0 0 4-4m-4 4-4-4" />
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </Zeichnung>
);

export const SymbolExport = () => (
  <Zeichnung>
    <path d="M12 15V4m0 0L8 8m4-4 4 4" />
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </Zeichnung>
);

export const SymbolBild = () => (
  <Zeichnung>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="8.5" cy="9.5" r="1.5" />
    <path d="m4 17 5-5 4 4 3-3 4 4" />
  </Zeichnung>
);

export const SymbolRueckgaengig = () => (
  <Zeichnung>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h9a6 6 0 0 1 0 12h-3" />
  </Zeichnung>
);

export const SymbolWiederholen = () => (
  <Zeichnung>
    <path d="m15 14 5-5-5-5" />
    <path d="M20 9h-9a6 6 0 0 0 0 12h3" />
  </Zeichnung>
);

export const SymbolZeiger = () => (
  <Zeichnung>
    <path d="M5 3l5.5 16 2.4-6.6 6.6-2.4z" />
  </Zeichnung>
);

export const SymbolUmriss = () => (
  <Zeichnung>
    <path d="M4 4h9v7h7v9H4z" />
    <rect x="2.4" y="2.4" width="3.2" height="3.2" />
    <rect x="18.4" y="18.4" width="3.2" height="3.2" />
    <rect x="11.4" y="9.4" width="3.2" height="3.2" />
  </Zeichnung>
);

export const SymbolFlaechePlus = () => (
  <Zeichnung>
    <path d="M3 3h10v10H3z" />
    <path d="M17 12v10M12 17h10" />
  </Zeichnung>
);

export const SymbolFlaecheMinus = () => (
  <Zeichnung>
    <path d="M3 3h10v10H3z" />
    <path d="M12 17h10" />
  </Zeichnung>
);

export const SymbolRaum = () => (
  <Zeichnung>
    <rect x="3" y="4" width="18" height="16" rx="1" />
    <path d="M13 4v16M13 10h8" />
  </Zeichnung>
);

export const SymbolMassband = () => (
  <Zeichnung>
    <path d="M3 9h18v6H3z" />
    <path d="M7 9v3M11 9v3M15 9v3M19 9v3" />
  </Zeichnung>
);

export const SymbolGruppieren = () => (
  <Zeichnung>
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <path d="M3 14v7h7M21 10V3h-7" />
  </Zeichnung>
);

export const SymbolGruppeAufheben = () => (
  <Zeichnung>
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
  </Zeichnung>
);

export const SymbolAneinander = () => (
  <Zeichnung>
    <rect x="2" y="7" width="6" height="10" />
    <rect x="8" y="7" width="6" height="10" />
    <rect x="14" y="7" width="6" height="10" />
  </Zeichnung>
);

export const SymbolWand = () => (
  <Zeichnung>
    <path d="M3 8h18M3 12h18" />
    <path d="M3 8v4M21 8v4" />
  </Zeichnung>
);

export const SymbolTuer = () => (
  <Zeichnung>
    <path d="M3 20h4M17 20h4" />
    <path d="M7 20V6" />
    <path d="M7 6a14 14 0 0 1 10 14" />
  </Zeichnung>
);

export const SymbolAbgleich = () => (
  <Zeichnung>
    <path d="M4 12a8 8 0 0 1 13.7-5.7L20 8.6" />
    <path d="M20 4v4.6h-4.6" />
    <path d="M20 12a8 8 0 0 1-13.7 5.7L4 15.4" />
    <path d="M4 20v-4.6h4.6" />
  </Zeichnung>
);

export const SymbolKopieren = () => (
  <Zeichnung>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
  </Zeichnung>
);

export const SymbolEinfuegen = () => (
  <Zeichnung>
    <path d="M9 4H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-3" />
    <rect x="8" y="2" width="7" height="4" rx="1" />
    <rect x="12" y="10" width="9" height="9" rx="1.5" />
  </Zeichnung>
);

export const SymbolDuplizieren = () => (
  <Zeichnung>
    <rect x="3" y="3" width="12" height="12" rx="2" />
    <path d="M9 21h10a2 2 0 0 0 2-2V9" />
  </Zeichnung>
);

export const SymbolLoeschen = () => (
  <Zeichnung>
    <path d="M4 7h16M10 4h4M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
    <path d="M10 11v7M14 11v7" />
  </Zeichnung>
);

export const SymbolDrehenLinks = () => (
  <Zeichnung>
    <path d="M4 6v5h5" />
    <path d="M4.5 11a8 8 0 1 1 1.5 6" />
  </Zeichnung>
);

export const SymbolDrehenRechts = () => (
  <Zeichnung>
    <path d="M20 6v5h-5" />
    <path d="M19.5 11a8 8 0 1 0-1.5 6" />
  </Zeichnung>
);

export const SymbolRaster = () => (
  <Zeichnung>
    <rect x="3" y="3" width="18" height="18" rx="1.5" />
    <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
  </Zeichnung>
);

export const SymbolMagnet = () => (
  <Zeichnung>
    <path d="M6 4v8a6 6 0 0 0 12 0V4h-4v8a2 2 0 0 1-4 0V4z" />
    <path d="M6 8h4M14 8h4" />
  </Zeichnung>
);

export const SymbolZoomPlus = () => (
  <Zeichnung>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5M8 11h6M11 8v6" />
  </Zeichnung>
);

export const SymbolZoomMinus = () => (
  <Zeichnung>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5M8 11h6" />
  </Zeichnung>
);

export const SymbolEinpassen = () => (
  <Zeichnung>
    <path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4" />
  </Zeichnung>
);

export const SymbolSuche = () => (
  <Zeichnung>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Zeichnung>
);

export const SymbolSchloss = () => (
  <Zeichnung>
    <rect x="4" y="10" width="16" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </Zeichnung>
);

export const SymbolAuge = () => (
  <Zeichnung>
    <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" />
    <circle cx="12" cy="12" r="2.5" />
  </Zeichnung>
);

export const SymbolAugeAus = () => (
  <Zeichnung>
    <path d="M4 4l16 16" />
    <path d="M9.6 5.7A9.9 9.9 0 0 1 12 5.5c6.5 0 10 6.5 10 6.5a17 17 0 0 1-3.3 4.1M6.2 7.9A17 17 0 0 0 2 12s3.5 6.5 10 6.5c1 0 1.9-.1 2.7-.4" />
  </Zeichnung>
);

export const SymbolNachVorne = () => (
  <Zeichnung>
    <rect x="3" y="3" width="12" height="12" rx="1.5" />
    <path d="M9 21h10a2 2 0 0 0 2-2V9" strokeDasharray="3 2" />
  </Zeichnung>
);

export const SymbolNachHinten = () => (
  <Zeichnung>
    <rect x="9" y="9" width="12" height="12" rx="1.5" />
    <path d="M15 3H5a2 2 0 0 0-2 2v10" strokeDasharray="3 2" />
  </Zeichnung>
);

export const SymbolGebaeude = () => (
  <Zeichnung>
    <rect x="3" y="4" width="18" height="17" rx="1.5" />
    <path d="M3 9h18M9 9v12" />
  </Zeichnung>
);

export const SymbolPfeilAuf = () => (
  <Zeichnung>
    <path d="m6 15 6-6 6 6" />
  </Zeichnung>
);

export const SymbolPfeilAb = () => (
  <Zeichnung>
    <path d="m6 9 6 6 6-6" />
  </Zeichnung>
);

/** Ausrichten – die Kennung gibt an, welche Kante bündig wird. */
export const SymbolAusrichten = ({ art }: { art: string }) => {
  const linien: Record<string, ReactNode> = {
    links: (
      <>
        <path d="M3 3v18" />
        <rect x="6" y="6" width="13" height="4" rx="1" />
        <rect x="6" y="14" width="8" height="4" rx="1" />
      </>
    ),
    mitteWaagerecht: (
      <>
        <path d="M12 3v18" />
        <rect x="5" y="6" width="14" height="4" rx="1" />
        <rect x="8" y="14" width="8" height="4" rx="1" />
      </>
    ),
    rechts: (
      <>
        <path d="M21 3v18" />
        <rect x="5" y="6" width="13" height="4" rx="1" />
        <rect x="10" y="14" width="8" height="4" rx="1" />
      </>
    ),
    oben: (
      <>
        <path d="M3 3h18" />
        <rect x="6" y="6" width="4" height="13" rx="1" />
        <rect x="14" y="6" width="4" height="8" rx="1" />
      </>
    ),
    mitteSenkrecht: (
      <>
        <path d="M3 12h18" />
        <rect x="6" y="5" width="4" height="14" rx="1" />
        <rect x="14" y="8" width="4" height="8" rx="1" />
      </>
    ),
    unten: (
      <>
        <path d="M3 21h18" />
        <rect x="6" y="5" width="4" height="13" rx="1" />
        <rect x="14" y="10" width="4" height="8" rx="1" />
      </>
    ),
    verteilenWaagerecht: (
      <>
        <path d="M3 3v18M21 3v18" />
        <rect x="10" y="7" width="4" height="10" rx="1" />
      </>
    ),
    verteilenSenkrecht: (
      <>
        <path d="M3 3h18M3 21h18" />
        <rect x="7" y="10" width="10" height="4" rx="1" />
      </>
    ),
  };
  return <Zeichnung>{linien[art]}</Zeichnung>;
};

/**
 * Der Stern der Favoriten.
 *
 * `gefuellt` unterscheidet die beiden Zustände: Ein leerer Stern ist ein
 * Angebot, ein gelber eine Auszeichnung. Beide brauchen dieselbe Kontur,
 * sonst springt die Zeile beim Anklicken.
 */
export const SymbolStern = ({ gefuellt = false }: { gefuellt?: boolean }) => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <path
      d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z"
      fill={gefuellt ? '#f2b90c' : 'none'}
      stroke={gefuellt ? '#c8960a' : 'currentColor'}
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  </svg>
);
