import { games } from "../data/browser";
import { timeline } from "../core/reconcile";
import { CatchUpView } from "./CatchUpView";
import { PatchView } from "./PatchView";
import { useHashState } from "./useHashState";

type View = "catchup" | "patch";

export function App() {
  const [params, update] = useHashState();

  if (games.length === 0) {
    return (
      <main className="app">
        <p className="empty">No games found. Add one under data/games — see the README.</p>
      </main>
    );
  }

  const game = games.find((g) => g.info.id === params.get("game")) ?? games[0];
  const view: View = params.get("view") === "patch" ? "patch" : "catchup";
  const versions = timeline(game);
  // Default to "since launch" so a first visit shows the full picture.
  const since = params.get("since") ?? versions[0]?.date ?? new Date().toISOString().slice(0, 10);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden>
            <svg viewBox="0 0 32 32" width="28" height="28">
              <rect width="32" height="32" rx="8" fill="currentColor" />
              <path d="M9 20l5-8 4 5 5-7" stroke="var(--logo-ink)" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div>
            <h1>GameShift</h1>
            <p className="muted">Every change you missed — including the ones nobody told you about.</p>
          </div>
        </div>
        {games.length > 1 && (
          <label className="field game-picker">
            <span>Game</span>
            <select value={game.info.id} onChange={(e) => update({ game: e.target.value, version: undefined, since: undefined })}>
              {games.map((g) => (
                <option key={g.info.id} value={g.info.id}>
                  {g.info.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>

      <div className="game-title">
        <h2>{game.info.name}</h2>
        {game.info.tagline && <p className="muted">{game.info.tagline}</p>}
        {game.info.sample && (
          <p className="notice">
            This is a fictional game bundled as sample data to show what GameShift does. Import a real game's patch notes and
            data snapshots to track it (see the README).
          </p>
        )}
      </div>

      <nav className="tabs" role="tablist">
        <button role="tab" aria-selected={view === "catchup"} className={view === "catchup" ? "tab tab-on" : "tab"} onClick={() => update({ view: "catchup" })}>
          Catch me up
          <span className="tab-sub">Returning player</span>
        </button>
        <button role="tab" aria-selected={view === "patch"} className={view === "patch" ? "tab tab-on" : "tab"} onClick={() => update({ view: "patch" })}>
          Patch deep-dive
          <span className="tab-sub">What a patch really changed</span>
        </button>
      </nav>

      <main>
        {view === "catchup" ? (
          <CatchUpView
            game={game}
            since={since}
            onSince={(d) => update({ since: d })}
            onOpenPatch={(v) => {
              update({ view: "patch", version: v });
              window.scrollTo({ top: 0 });
            }}
          />
        ) : (
          <PatchView game={game} version={params.get("version") ?? undefined} onVersion={(v) => update({ version: v })} />
        )}
      </main>

      <footer className="footer muted">
        GameShift compares game-data snapshots between versions and checks them against the official patch notes.
      </footer>
    </div>
  );
}
