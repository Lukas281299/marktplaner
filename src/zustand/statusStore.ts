import { create } from 'zustand';

/**
 * Ein winziger, eigener Speicher nur für die Statusleiste.
 *
 * Die Mausposition ändert sich sehr oft. Läge sie im großen Speicher, müsste
 * bei jeder Mausbewegung die halbe Oberfläche neu gezeichnet werden. So wird
 * nur die Statusleiste aktualisiert.
 */
interface StatusStore {
  /** Mausposition in Planmaßen (cm) – `null`, wenn die Maus außerhalb ist. */
  maus: { x: number; y: number } | null;
  setzeMaus(punkt: { x: number; y: number } | null): void;
}

export const useStatusStore = create<StatusStore>((set) => ({
  maus: null,
  setzeMaus: (maus) => set({ maus }),
}));
