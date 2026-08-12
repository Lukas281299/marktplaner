import { useEffect, type ReactNode } from 'react';

/**
 * Das Grundgerüst aller Dialoge: abgedunkelter Hintergrund, Kopf, Inhalt, Fuß.
 *
 * Mit Escape oder einem Klick daneben lässt sich jeder Dialog schließen.
 */
export function Dialog({
  titel,
  children,
  fuss,
  schliessen,
  breit = false,
}: {
  titel: string;
  children: ReactNode;
  fuss: ReactNode;
  schliessen: () => void;
  /** Für Dialoge mit längeren Erklärungen. */
  breit?: boolean;
}) {
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') schliessen();
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [schliessen]);

  return (
    <div className="dialog-hintergrund" onMouseDown={schliessen}>
      <div className={`dialog${breit ? ' dialog-breit' : ''}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="dialog-kopf">{titel}</div>
        <div className="dialog-inhalt">{children}</div>
        <div className="dialog-fuss">{fuss}</div>
      </div>
    </div>
  );
}
