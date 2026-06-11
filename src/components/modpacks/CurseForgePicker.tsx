"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Package, Plus, Puzzle, Search, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  formatDownloads,
  searchCurseForgeCatalog,
  type CurseForgeBrowseKind,
  type CurseForgeSearchHit,
} from "@/lib/curseforge-admin";
import { reportAppError } from "@/lib/app-errors-store";

type Props = {
  /** Solo guarda en el catálogo del admin — no descarga archivos */
  onAdd: (hit: CurseForgeSearchHit, kind: CurseForgeBrowseKind) => void;
  existingIds?: number[];
};

const DEFAULT_QUERY: Record<CurseForgeBrowseKind, string> = {
  modpacks: "all the mods",
  mods: "jei",
};

const SEARCH_INPUT_ID = "curseforge-catalog-search";

export function CurseForgePicker({ onAdd, existingIds = [] }: Props) {
  const [kind, setKind] = useState<CurseForgeBrowseKind>("modpacks");
  const [query, setQuery] = useState("");
  const [activeTerm, setActiveTerm] = useState("");
  const [results, setResults] = useState<CurseForgeSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipDebounceRef = useRef(false);

  const runSearch = useCallback(async (browseKind: CurseForgeBrowseKind, term: string) => {
    setLoading(true);
    setSearched(true);
    setActiveTerm(term);
    try {
      const list = await searchCurseForgeCatalog(browseKind, term);
      setResults(list);
      if (!list.length) {
        reportAppError(`Sin resultados para «${term}». Prueba otro nombre.`);
      }
    } catch (err) {
      reportAppError(err instanceof Error ? err.message : "Error CurseForge");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    skipDebounceRef.current = true;
    setQuery("");
    setActiveTerm("");
    setResults([]);
    setHighlightId(null);
    setSearched(false);
    void runSearch(kind, DEFAULT_QUERY[kind]);
  }, [kind, runSearch]);

  useEffect(() => {
    if (skipDebounceRef.current) {
      skipDebounceRef.current = false;
      return;
    }
    const trimmed = query.trim();
    if (!trimmed) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runSearch(kind, trimmed);
    }, 420);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, kind, runSearch]);

  const submitSearch = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    void runSearch(kind, trimmed || DEFAULT_QUERY[kind]);
  };

  const addHit = async (hit: CurseForgeSearchHit) => {
    if (existingIds.includes(hit.id)) {
      reportAppError(`«${hit.name}» ya está en el catálogo.`);
      return;
    }
    setAddingId(hit.id);
    try {
      onAdd(hit, kind);
      setHighlightId(null);
    } catch (err) {
      reportAppError(err instanceof Error ? err.message : "No se pudo añadir");
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-hover)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-[var(--color-text)]">Resultados de CurseForge</p>
          <p className="text-[11px] text-[var(--color-muted)]">
            Escribe el nombre y la lista se actualiza sola. Solo añades al catálogo —{" "}
            <strong>no se descarga ningún archivo</strong>.
          </p>
        </div>
        <div className="flex rounded-lg border border-[var(--color-border-subtle)] p-0.5">
          <button
            type="button"
            className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] ${
              kind === "modpacks"
                ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                : "text-[var(--color-muted)]"
            }`}
            onClick={() => setKind("modpacks")}
          >
            <Package size={12} /> Modpacks
          </button>
          <button
            type="button"
            className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] ${
              kind === "mods"
                ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                : "text-[var(--color-muted)]"
            }`}
            onClick={() => setKind("mods")}
          >
            <Puzzle size={12} /> Mods
          </button>
        </div>
      </div>

      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault();
          submitSearch();
        }}
      >
        <div className="min-w-[220px] flex-1">
          <Input
            id={SEARCH_INPUT_ID}
            label="Nombre en CurseForge"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={kind === "modpacks" ? "All the Mods, RLCraft…" : "Sodium, Create, JEI…"}
            type="search"
            name="curseforge-catalog-q"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
            data-1p-ignore="true"
            data-bwignore
            data-form-type="other"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitSearch();
              }
            }}
          />
        </div>
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          Buscar
        </Button>
      </form>

      {loading && (
        <p className="mt-3 flex items-center gap-2 text-[11px] text-[var(--color-muted)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Buscando en CurseForge…
        </p>
      )}

      {!loading && results.length > 0 && (
        <p className="mt-2 text-[10px] text-[var(--color-muted)]">
          {results.length} resultados
          {activeTerm ? (
            <>
              {" "}
              para <strong>«{activeTerm}»</strong>
            </>
          ) : null}{" "}
          — pulsa <strong>Añadir</strong> en el que quieras guardar.
        </p>
      )}

      <div className="mt-3 grid max-h-[420px] gap-2 overflow-y-auto sm:grid-cols-2">
        {results.map((hit) => {
          const added = existingIds.includes(hit.id);
          const busy = addingId === hit.id;
          const highlighted = highlightId === hit.id;
          return (
            <div
              key={`${kind}-${hit.id}`}
              role="button"
              tabIndex={0}
              onClick={() => setHighlightId(hit.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setHighlightId(hit.id);
                }
              }}
              className={`flex gap-3 rounded-lg border p-2.5 text-left transition-colors ${
                added
                  ? "cursor-default border-[var(--color-border-subtle)] opacity-60"
                  : highlighted
                    ? "border-[var(--color-accent-muted)] bg-[var(--color-accent-soft)]/50"
                    : "border-[var(--color-border-subtle)] hover:border-[var(--color-accent-muted)] hover:bg-[var(--color-accent-soft)]/25"
              }`}
            >
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-[var(--color-surface)]">
                {hit.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={hit.logoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[var(--color-muted)]">
                    {kind === "modpacks" ? <Package size={18} /> : <Puzzle size={18} />}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium text-[var(--color-text)]">{hit.name}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-[var(--color-muted)]">
                  <span className="inline-flex items-center gap-0.5">
                    <TrendingUp size={10} />
                    {formatDownloads(hit.downloadCount)} en CF
                  </span>
                  <span>ID {hit.id}</span>
                  {added && <span className="text-[var(--color-accent)]">Ya añadido</span>}
                </p>
                <p className="mt-1 line-clamp-2 text-[10px] text-[var(--color-text-soft)]">{hit.summary}</p>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={added || busy}
                className="shrink-0 self-center"
                onClick={(e) => {
                  e.stopPropagation();
                  void addHit(hit);
                }}
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" />
                    {added ? "Añadido" : "Añadir"}
                  </>
                )}
              </Button>
            </div>
          );
        })}
      </div>

      {!loading && searched && results.length === 0 && (
        <p className="mt-3 text-center text-[11px] text-[var(--color-muted)]">
          No hay resultados para esta búsqueda.
        </p>
      )}
    </div>
  );
}
