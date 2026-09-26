import { games } from "../data/browser";
import { timeline } from "../core/reconcile";
import { Banner } from "./Art";
import { CatchUpView } from "./CatchUpView";
import { PatchView } from "./PatchView";
import { useHashState } from "./useHashState";

type View = "catchup" | "patch";

const NAV: { view: View; label: string; icon: React.ReactNode }[] = [
  {
    view: "catchup",
    label: "Catch me up",
    icon: <path d="M12 3a9 9 0 1 0 9 9M12 7v5l3 3M21 3v6h-6" />,
  },
  {
    view: "patch",
    label: "Patch notes",
    icon: <path d="M5 3h10l4 4v14H5zM9 9h6M9 13h6M9 17h4" />,
  },
];

export function App() {
  const [params, update] = useHashState();

  if (games.length === 0) {
    return <p className="empty">No games found. Add one under data/games — see the README.</p>;
  }

  const game = games.find((g) => g.info.id === params.get("game")) ?? games[0];
  const view: View = params.get("view") === "patch" ? "patch" : "catchup";
  const versions = timeline(game);
  const current = versions[versions.length - 1];
  // Default to "since launch" so a first visit shows the full picture.
  const since = params.get("since") ?? versions[0]?.date ?? new Date().toISOString().slice(0, 10);
  const go = (v: View) => update({ view: v });

  return (
    <>
      <header className="masthead">
        <div className="masthead-inner">
          <a className="wordmark" href="#" onClick={(e) => (e.preventDefault(), go("catchup"))}>
            <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden>
              <circle cx="16" cy="16" r="15" fill="#c7d5e0" />
              <path d="M8 20l5-7 4 4 7-8" stroke="#171a21" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            GAMESHIFT
          </a>
          <nav className="topnav">
            {NAV.map((n) => (
              <button key={n.view} className={view === n.view ? "is-on" : ""} onClick={() => go(n.view)}>
                {n.label}
              </button>
            ))}
          </nav>
          {games.length > 1 && (
            <select
              className="gamepicker"
              value={game.info.id}
              onChange={(e) => update({ game: e.target.value, version: undefined, since: undefined })}
              aria-label="Game"
            >
              {games.map((g) => (
                <option key={g.info.id} value={g.info.id}>
                  {g.info.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </header>

      <div className="page">
        <Banner id={game.info.id} title={game.info.name}>
          {current && <span className="nowtag">Now on v{current.version}</span>}
          {game.info.tagline && <p className="banner-sub">{game.info.tagline}</p>}
        </Banner>
        {game.info.sample && (
          <p className="notice">
            <b>Sample data.</b> Ironvale Arena is a fictional game included to show what GameShift detects. Import a real game's patch
            notes and data snapshots to track it — see the README.
          </p>
        )}

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

        <footer className="footer">
          GameShift compares game-data snapshots between versions and fact-checks them against the official patch notes.
        </footer>
      </div>

      <nav className="bottomnav" aria-label="Sections">
        {NAV.map((n) => (
          <button key={n.view} className={view === n.view ? "is-on" : ""} onClick={() => go(n.view)}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {n.icon}
            </svg>
            {n.label}
          </button>
        ))}
      </nav>
    </>
  );
}
