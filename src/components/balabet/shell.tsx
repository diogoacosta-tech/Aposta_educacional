import { useEffect, useState, type ReactNode } from "react";
import { DEFAULT_CANDY, useArt } from "@/lib/balabet/art";
import { phaseLabel, useDispute } from "@/lib/balabet/store";

export type NavTab = "inicio" | "apostar" | "top" | "como-jogar";

const LINKS: { id: NavTab; label: string }[] = [
  { id: "inicio", label: "Início" },
  { id: "apostar", label: "Apostar" },
  { id: "top", label: "TOP" },
  { id: "como-jogar", label: "Como jogar" },
];

export function AppShell({
  activeTab,
  onSelectTab,
  children,
}: {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  children: ReactNode;
}) {
  const phase = useDispute((state) => state.phase);
  const roundIndex = useDispute((state) => state.roundIndex);
  const resetOpen = useDispute((state) => state.resetOpen);
  const requestReset = useDispute((state) => state.requestReset);
  const cancelReset = useDispute((state) => state.cancelReset);
  const confirmReset = useDispute((state) => state.confirmReset);
  const { candy } = useArt();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const pending = useDispute.persist.rehydrate();
    if (pending instanceof Promise) {
      void pending.then(() => setReady(true));
      return;
    }
    setReady(true);
  }, []);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => onSelectTab("inicio")}
              className="flex items-center gap-2.5 text-left transition hover:opacity-90"
            >
              <img
                src={candy || DEFAULT_CANDY}
                alt="Logo BalaBet"
                className="size-9 rounded-full object-cover ring-1 ring-gold/30"
              />
              <span className="text-xl font-bold tracking-tight text-fg">BalaBet</span>
            </button>
            <nav className="flex items-center gap-1 overflow-x-auto" aria-label="Navegação Principal">
              {LINKS.map((link) => (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => onSelectTab(link.id)}
                  className="nav-link whitespace-nowrap cursor-pointer"
                  data-active={activeTab === link.id}
                >
                  {link.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <p className="hidden font-mono text-xs tracking-wide text-gold sm:block" aria-live="polite">
              {ready ? phaseLabel(phase, roundIndex) : "CARREGANDO"}
            </p>
            <button
              type="button"
              className="btn btn-danger"
              data-testid="reset-open"
              onClick={requestReset}
            >
              Resetar todos os dados
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        {ready ? children : <p className="text-muted">Carregando a disputa…</p>}
      </main>

      {resetOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-bg/70 p-4 sm:items-center"
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-title"
            className="panel w-full max-w-md p-6 shadow-2xl"
          >
            <h2 id="reset-title" className="text-lg font-semibold text-fg">
              Apagar a disputa?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Todos os dados desta disputa serão apagados: jogadores, saldos, apostas, vitórias, derrotas,
              empates, ranking, histórico, gráfico e sorteios. As imagens personalizadas permanecem.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button type="button" className="btn btn-ghost" onClick={cancelReset}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-danger"
                data-testid="reset-confirm"
                onClick={confirmReset}
              >
                Apagar disputa
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
