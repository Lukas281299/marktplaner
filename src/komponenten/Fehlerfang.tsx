import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Fängt Fehler beim Zeichnen ab, statt die Seite weiß werden zu lassen.
 *
 * React räumt bei einem Fehler im Aufbau die **ganze** Oberfläche ab. Was
 * übrig bleibt, ist eine leere Seite ohne jeden Hinweis – man weiß nicht,
 * ob das Programm kaputt ist, die Planung, oder ob nur das Netz hakt. Und
 * schlimmer: Man kommt an seine Planungen nicht mehr heran, obwohl sie
 * unversehrt in der Datenbank liegen.
 *
 * Deshalb dieser Fang. Er zeigt, was passiert ist, und bietet zwei Wege
 * zurück, die beide **nichts löschen**:
 *
 *  - noch einmal versuchen (oft genügt das, etwa nach einem Aussetzer)
 *  - mit einer leeren Planung starten – die zuletzt geöffnete wird dabei nur
 *    beiseitegelegt, nicht entfernt, und lässt sich über „Öffnen" zurückholen
 */
interface Props {
  children: ReactNode;
}

interface Zustand {
  fehler: Error | null;
  woher: string;
}

export class Fehlerfang extends Component<Props, Zustand> {
  state: Zustand = { fehler: null, woher: '' };

  static getDerivedStateFromError(fehler: Error): Partial<Zustand> {
    return { fehler };
  }

  componentDidCatch(fehler: Error, info: ErrorInfo) {
    this.setState({ woher: info.componentStack ?? '' });
    // Zusätzlich in die Konsole, damit der vollständige Stapel dort steht.
    console.error('Marktplaner: Fehler beim Aufbau der Oberfläche', fehler, info);
  }

  /**
   * Startet ohne die zuletzt geöffnete Planung neu.
   *
   * Gelöscht wird dabei **nichts**: Es wird nur der Merker entfernt, welche
   * Planung zuletzt offen war. Beim nächsten Start legt das Programm eine
   * leere an, und die alte steht weiter unter „Öffnen".
   */
  private leerStarten = () => {
    const anfrage = indexedDB.open('marktplaner');
    anfrage.onsuccess = () => {
      const db = anfrage.result;
      if (!db.objectStoreNames.contains('einstellungen')) {
        window.location.reload();
        return;
      }
      const t = db.transaction('einstellungen', 'readwrite');
      t.objectStore('einstellungen').delete('zuletztGeoeffnet');
      t.oncomplete = () => window.location.reload();
      t.onerror = () => window.location.reload();
    };
    anfrage.onerror = () => window.location.reload();
  };

  render() {
    const { fehler } = this.state;
    if (!fehler) return this.props.children;

    const bericht = [
      fehler.message,
      '',
      fehler.stack ?? '',
      this.state.woher,
    ].join('\n');

    return (
      <div className="fehlerfang">
        <h1>Der Marktplaner ist stehen geblieben</h1>
        <p>
          Beim Aufbau der Oberfläche ist ein Fehler aufgetreten. <strong>Deine Planungen sind
          davon nicht betroffen</strong> — sie liegen unverändert in der Datenbank dieses
          Browsers.
        </p>

        <div className="fehlerfang-knoepfe">
          <button className="knopf knopf-haupt" onClick={() => window.location.reload()}>
            Noch einmal versuchen
          </button>
          <button className="knopf" onClick={this.leerStarten}>
            Mit leerer Planung starten
          </button>
          <button className="knopf" onClick={() => void navigator.clipboard?.writeText(bericht)}>
            Fehlertext kopieren
          </button>
        </div>

        <p className="fehlerfang-hinweis">
          „Mit leerer Planung starten“ löscht nichts. Es merkt sich nur nicht mehr, welche
          Planung zuletzt offen war — über <strong>Öffnen</strong> ist sie wieder da.
        </p>

        <pre className="fehlerfang-text">{bericht}</pre>
      </div>
    );
  }
}
