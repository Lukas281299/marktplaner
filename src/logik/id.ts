/**
 * Erzeugt eindeutige Kennungen (IDs) für Projekte, Elemente und Ebenen.
 * `crypto.randomUUID` ist in allen aktuellen Browsern vorhanden; der zweite Weg
 * ist nur eine Absicherung für sehr alte Umgebungen.
 */
export function neueId(praefix = ''): string {
  const roh =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return praefix ? `${praefix}-${roh}` : roh;
}
