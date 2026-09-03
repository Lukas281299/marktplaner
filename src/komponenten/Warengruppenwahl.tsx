import { usePlanStore } from '../zustand/planStore';

/**
 * Ein Auswahlmenü über die geladene Sortimentsliste.
 *
 * Neben dem Eingabefeld für eine Warengruppe. Getippt wird weiter – ein Name,
 * den die Liste nicht kennt, muss sich schreiben lassen, sonst wäre die Liste
 * eine Fessel statt einer Hilfe. Aber wer den Namen nicht auswendig weiß,
 * soll ihn nicht raten müssen.
 *
 * **Geordnet wie die Liste links**, Abteilung für Abteilung, und in jeder
 * Abteilung erst die Warengruppe und darunter eingerückt ihre Sortimente.
 * Beim Planen greift man mal auf der einen Höhe zu und mal auf der anderen;
 * beides muss im selben Menü stehen.
 *
 * Ohne geladene Liste erscheint das Menü nicht. Ein leeres Menü wäre ein
 * Knopf, der nichts tut.
 */
export function Warengruppenwahl({ waehle }: { waehle: (name: string) => void }) {
  const sortiment = usePlanStore((s) => s.sortiment);
  if (sortiment.abteilungen.length === 0) return null;

  return (
    <select
      className="wg-wahl"
      // Immer leer: Das Menü wählt nicht aus, es trägt ein. Stünde der
      // gewählte Name darin, sähe es aus wie eine zweite Wahrheit neben dem
      // Eingabefeld – und wer von Hand tippt, hätte plötzlich zwei Zustände.
      value=""
      title="Aus der Sortimentsliste wählen"
      onChange={(e) => {
        if (e.target.value) waehle(e.target.value);
      }}
    >
      <option value="">▾</option>
      {sortiment.abteilungen.map((abteilung) => (
        <optgroup key={abteilung.name} label={abteilung.name}>
          {abteilung.warengruppen.flatMap((gruppe) => [
            <option key={gruppe.name} value={gruppe.name}>
              {gruppe.name}
            </option>,
            ...gruppe.sortimente.map((name) => (
              <option key={`${gruppe.name} › ${name}`} value={name}>
                {'  · '}
                {name}
              </option>
            )),
          ])}
        </optgroup>
      ))}
    </select>
  );
}
