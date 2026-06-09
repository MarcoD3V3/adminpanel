"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Plus, Trash2, Save, RefreshCw, Type, Square } from "lucide-react";
import { PageContent } from "@/components/layout/PageContent";
import { fetchAdminCached, readAdminCache, writeAdminCache } from "@/lib/admin-api-cache";

const GAME_UI_CACHE_KEY = "game-ui:legacy";

type Action = "singleplayer" | "multiplayer" | "options" | "mods" | "quit" | "url" | "none";
type AnchorX = "left" | "center" | "right";
type AnchorY = "top" | "center" | "bottom";

type Element = {
  type: "button" | "label";
  text: string;
  anchorX: AnchorX;
  anchorY: AnchorY;
  offsetX: number;
  offsetY: number;
  w: number;
  h: number;
  action: Action;
  url?: string;
  bg?: string;
  bgHover?: string;
  border?: string;
  textColor?: string;
};

// Pantalla de referencia = GUI de Minecraft a 1080p (auto scale 4)
const REF_W = 480;
const REF_H = 270;

const ACTIONS: { value: Action; label: string }[] = [
  { value: "singleplayer", label: "Singleplayer" },
  { value: "multiplayer", label: "Multiplayer" },
  { value: "options", label: "Opciones" },
  { value: "mods", label: "Mods" },
  { value: "quit", label: "Salir" },
  { value: "url", label: "Abrir enlace (URL)" },
  { value: "none", label: "(ninguna)" },
];

function newButton(): Element {
  return {
    type: "button", text: "Nuevo botón",
    anchorX: "center", anchorY: "top", offsetX: 0, offsetY: 120,
    w: 160, h: 20, action: "url", url: "https://",
    bg: "#2b2e33", bgHover: "#3a3e45", border: "#5b5f66", textColor: "#e8eaed",
  };
}
function newLabel(): Element {
  return {
    type: "label", text: "Texto",
    anchorX: "center", anchorY: "top", offsetX: 0, offsetY: 60,
    w: 200, h: 12, action: "none", textColor: "#ffffff",
  };
}

function resolveX(el: Element): number {
  if (el.anchorX === "left") return el.offsetX;
  if (el.anchorX === "right") return REF_W - el.w - el.offsetX;
  return Math.round(REF_W / 2 - el.w / 2 + el.offsetX);
}
function resolveY(el: Element): number {
  if (el.anchorY === "top") return el.offsetY;
  if (el.anchorY === "bottom") return REF_H - el.h - el.offsetY;
  return Math.round(REF_H / 2 - el.h / 2 + el.offsetY);
}
function offsetsFromVisual(el: Element, px: number, py: number): { offsetX: number; offsetY: number } {
  const offsetX =
    el.anchorX === "left" ? Math.round(px)
    : el.anchorX === "right" ? Math.round(REF_W - (px + el.w))
    : Math.round(px + el.w / 2 - REF_W / 2);
  const offsetY =
    el.anchorY === "top" ? Math.round(py)
    : el.anchorY === "bottom" ? Math.round(REF_H - (py + el.h))
    : Math.round(py + el.h / 2 - REF_H / 2);
  return { offsetX, offsetY };
}

// Normaliza esquema antiguo (x/y) → anclas, por si llega del API
function normalize(el: Partial<Element> & { x?: unknown; y?: unknown }): Element {
  if (el.anchorX && el.anchorY) return el as Element;
  const w = Number(el.w) || 160;
  const h = Number(el.h) || 20;
  let anchorX: AnchorX = "center";
  let offsetX = 0;
  if (typeof el.x === "number") { anchorX = "left"; offsetX = el.x; }
  else if (el.x === "left") { anchorX = "left"; offsetX = 8; }
  else if (el.x === "right") { anchorX = "right"; offsetX = 8; }
  let anchorY: AnchorY = "top";
  let offsetY = 40;
  if (typeof el.y === "number") { anchorY = "top"; offsetY = el.y; }
  else if (el.y === "center") { anchorY = "center"; offsetY = 0; }
  return {
    type: (el.type as Element["type"]) || "button",
    text: el.text ?? "",
    anchorX, anchorY, offsetX, offsetY, w, h,
    action: (el.action as Action) ?? "none",
    url: el.url,
    bg: el.bg ?? "#2b2e33",
    bgHover: el.bgHover ?? "#3a3e45",
    border: el.border ?? "#5b5f66",
    textColor: el.textColor ?? "#e8eaed",
  };
}

export default function GameUiEditor() {
  const [elements, setElements] = useState<Element[]>(() => {
    const cached = readAdminCache<{ elements?: Element[] }>(GAME_UI_CACHE_KEY)?.data;
    return Array.isArray(cached?.elements) ? cached.elements.map(normalize) : [];
  });
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(() => !readAdminCache(GAME_UI_CACHE_KEY));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [dispW, setDispW] = useState(720);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<
    | null
    | { i: number; mode: "move" | "resize"; mx: number; my: number; px: number; py: number; w: number; h: number }
  >(null);

  const SCALE = dispW / REF_W;
  const DISP_H = REF_H * SCALE;

  // Canvas responsive (ocupa el ancho disponible)
  useLayoutEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 720;
      setDispW(Math.max(360, Math.min(960, Math.round(w))));
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const load = useCallback(async () => {
    if (!readAdminCache(GAME_UI_CACHE_KEY)) setLoading(true);
    try {
      const data = await fetchAdminCached({
        key: GAME_UI_CACHE_KEY,
        url: "/api/game-ui",
        maxAgeMs: 5 * 60 * 1000,
        parse: (r) => r.json(),
        onUpdate: (payload) => {
          const els = Array.isArray(payload?.elements) ? payload.elements.map(normalize) : [];
          setElements(els);
        },
      });
      const els = Array.isArray(data?.elements) ? data.elements.map(normalize) : [];
      setElements(els);
    } catch {
      setStatus("No se pudo cargar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const update = useCallback((i: number, patch: Partial<Element>) => {
    setElements((els) => els.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }, []);

  function remove(i: number) {
    setElements((els) => els.filter((_, idx) => idx !== i));
    setSelected(null);
  }
  function add(kind: "button" | "label") {
    setElements((els) => {
      setSelected(els.length);
      return [...els, kind === "label" ? newLabel() : newButton()];
    });
  }

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const d = drag.current;
      if (!d) return;
      const dx = (e.clientX - d.mx) / SCALE;
      const dy = (e.clientY - d.my) / SCALE;
      setElements((els) =>
        els.map((el, idx) => {
          if (idx !== d.i) return el;
          if (d.mode === "move") {
            const px = Math.max(0, Math.min(REF_W - el.w, d.px + dx));
            const py = Math.max(0, Math.min(REF_H - el.h, d.py + dy));
            return { ...el, ...offsetsFromVisual(el, px, py) };
          }
          const nw = Math.max(20, Math.round(d.w + dx));
          const nh = Math.max(8, Math.round(d.h + dy));
          const next = { ...el, w: nw, h: nh };
          return { ...next, ...offsetsFromVisual(next, d.px, d.py) }; // mantiene esquina sup-izq
        })
      );
    }
    function onUp() {
      drag.current = null;
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [SCALE]);

  function startMove(e: React.MouseEvent, i: number) {
    e.preventDefault();
    e.stopPropagation();
    setSelected(i);
    const el = elements[i];
    drag.current = { i, mode: "move", mx: e.clientX, my: e.clientY, px: resolveX(el), py: resolveY(el), w: el.w, h: el.h };
  }
  function startResize(e: React.MouseEvent, i: number) {
    e.preventDefault();
    e.stopPropagation();
    setSelected(i);
    const el = elements[i];
    drag.current = { i, mode: "resize", mx: e.clientX, my: e.clientY, px: resolveX(el), py: resolveY(el), w: el.w, h: el.h };
  }

  async function apply() {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/game-ui", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schema: 2, elements }),
      });
      if (res.ok) {
        writeAdminCache(GAME_UI_CACHE_KEY, { schema: 2, elements });
        setStatus("Aplicado · el juego se actualiza en unos segundos");
      } else {
        setStatus("Error al aplicar");
      }
    } catch {
      setStatus("Error de red al aplicar");
    } finally {
      setSaving(false);
    }
  }

  const sel = selected !== null ? elements[selected] : null;

  return (
    <PageContent className="max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Menú del juego</h1>
          <p className="text-sm text-neutral-400">
            Previsualización fiel y responsive (anclas). Lo que coloques se acomoda en pantalla completa.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void load()} className="flex items-center gap-2 rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-800">
            <RefreshCw size={16} /> Recargar
          </button>
          <button onClick={() => void apply()} disabled={saving} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60">
            <Save size={16} /> {saving ? "Aplicando…" : "Aplicar"}
          </button>
        </div>
      </div>

      {status && (
        <div className="rounded-lg border border-neutral-700 bg-neutral-900/60 px-4 py-2 text-sm text-neutral-200">{status}</div>
      )}

      <div className="flex flex-col gap-6 xl:flex-row">
        {/* Canvas */}
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <button onClick={() => add("button")} className="flex items-center gap-2 rounded-lg border border-dashed border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-900">
              <Square size={15} /> Botón
            </button>
            <button onClick={() => add("label")} className="flex items-center gap-2 rounded-lg border border-dashed border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-900">
              <Type size={15} /> Texto
            </button>
            <span className="text-xs text-neutral-500">Pantalla completa · {REF_W}×{REF_H}</span>
          </div>

          <div ref={wrapRef} className="w-full">
            <div
              onMouseDown={() => setSelected(null)}
              className="relative overflow-hidden rounded-xl border border-neutral-700 shadow-inner"
              style={{
                width: dispW,
                height: DISP_H,
                background: "radial-gradient(120% 120% at 50% 0%, #1f2024 0%, #141518 60%, #0e0f12 100%)",
              }}
            >
              {/* logo placeholder (referencia visual) */}
              <div
                className="pointer-events-none absolute left-1/2 -translate-x-1/2 select-none font-bold tracking-widest text-neutral-200/80"
                style={{ top: 24 * SCALE, fontSize: 26 * SCALE }}
              >
                MINECRAFT
              </div>

              {loading && <div className="p-4 text-sm text-neutral-400">Cargando…</div>}

              {elements.map((el, i) => {
                const lw = Math.max(12, el.w);
                const lh = Math.max(8, el.h);
                const x = resolveX({ ...el, w: lw }) * SCALE;
                const y = resolveY({ ...el, h: lh }) * SCALE;
                const isSel = selected === i;
                const isLabel = el.type === "label";
                return (
                  <div
                    key={i}
                    onMouseDown={(e) => startMove(e, i)}
                    className={`absolute flex cursor-move select-none items-center justify-center text-center ${isSel ? "z-10 ring-2 ring-emerald-400" : ""}`}
                    style={{
                      left: x,
                      top: y,
                      width: lw * SCALE,
                      height: lh * SCALE,
                      background: isLabel ? "transparent" : el.bg,
                      border: isLabel ? "none" : `1px solid ${el.border}`,
                      color: el.textColor,
                      fontFamily: '"VT323","Pixelify Sans",ui-monospace,monospace',
                      fontSize: Math.max(9, Math.min(20, lh * 0.7 * SCALE)),
                      textShadow: "1px 1px 0 rgba(0,0,0,0.6)",
                      lineHeight: 1,
                    }}
                    title={el.text}
                  >
                    <span className="truncate px-1">{el.text}</span>
                    {isSel && (
                      <span
                        onMouseDown={(e) => startResize(e, i)}
                        className="absolute -bottom-1 -right-1 h-3 w-3 cursor-se-resize rounded-sm border border-white bg-emerald-400"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <p className="text-xs text-neutral-500">
            Arrastra para mover · esquina verde para redimensionar. El <b>ancla</b> (en propiedades) decide cómo se acomoda al cambiar el tamaño del juego.
          </p>
        </div>

        {/* Propiedades */}
        <div className="w-full space-y-4 xl:w-80">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Propiedades</h2>
          {sel && selected !== null ? (
            <div className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
              <Field label="Texto">
                <input value={sel.text} onChange={(e) => update(selected, { text: e.target.value })} className={inputCls} />
              </Field>

              {sel.type === "button" && (
                <>
                  <Field label="Acción">
                    <select value={sel.action} onChange={(e) => update(selected, { action: e.target.value as Action })} className={inputCls}>
                      {ACTIONS.filter((a) => a.value !== "none").map((a) => (
                        <option key={a.value} value={a.value}>{a.label}</option>
                      ))}
                    </select>
                  </Field>
                  {sel.action === "url" && (
                    <Field label="URL">
                      <input value={sel.url ?? ""} onChange={(e) => update(selected, { url: e.target.value })} placeholder="https://…" className={inputCls} />
                    </Field>
                  )}
                </>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Field label="Ancla horizontal">
                  <Seg value={sel.anchorX} options={["left", "center", "right"]} onChange={(v) => update(selected, { anchorX: v as AnchorX })} />
                </Field>
                <Field label="Ancla vertical">
                  <Seg value={sel.anchorY} options={["top", "center", "bottom"]} onChange={(v) => update(selected, { anchorY: v as AnchorY })} />
                </Field>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <Field label="Off X"><input type="number" value={sel.offsetX} onChange={(e) => update(selected, { offsetX: Math.round(Number(e.target.value) || 0) })} className={inputCls} /></Field>
                <Field label="Off Y"><input type="number" value={sel.offsetY} onChange={(e) => update(selected, { offsetY: Math.round(Number(e.target.value) || 0) })} className={inputCls} /></Field>
                <Field label="Ancho"><input type="number" value={sel.w} onChange={(e) => update(selected, { w: Math.max(0, Math.round(Number(e.target.value) || 0)) })} className={inputCls} /></Field>
                <Field label="Alto"><input type="number" value={sel.h} onChange={(e) => update(selected, { h: Math.max(0, Math.round(Number(e.target.value) || 0)) })} className={inputCls} /></Field>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <ColorField label="Texto" value={sel.textColor ?? "#ffffff"} onChange={(v) => update(selected, { textColor: v })} />
                {sel.type === "button" && (
                  <>
                    <ColorField label="Fondo" value={sel.bg ?? "#2b2e33"} onChange={(v) => update(selected, { bg: v })} />
                    <ColorField label="Fondo hover" value={sel.bgHover ?? "#3a3e45"} onChange={(v) => update(selected, { bgHover: v })} />
                    <ColorField label="Borde" value={sel.border ?? "#5b5f66"} onChange={(v) => update(selected, { border: v })} />
                  </>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={() => update(selected, { anchorX: "center", offsetX: 0 })} className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800">Centrar X</button>
                <button onClick={() => remove(selected)} className="flex items-center gap-2 rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-red-400 hover:border-red-500"><Trash2 size={14} /> Eliminar</button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-neutral-800 p-6 text-sm text-neutral-500">Selecciona un elemento del lienzo.</div>
          )}

          <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Elementos ({elements.length})</h3>
            <div className="space-y-1">
              {elements.map((el, i) => (
                <button key={i} onClick={() => setSelected(i)} className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm ${selected === i ? "bg-emerald-600/20 text-white" : "text-neutral-300 hover:bg-neutral-800"}`}>
                  <span className="truncate">{el.text || "(sin texto)"}</span>
                  <span className="text-xs text-neutral-500">{el.type === "label" ? "texto" : el.action}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageContent>
  );
}

const inputCls = "w-full rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-white";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-neutral-400">{label}</span>
      {children}
    </label>
  );
}

function Seg({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="flex overflow-hidden rounded-md border border-neutral-700">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`flex-1 px-1 py-1.5 text-[11px] capitalize ${value === o ? "bg-emerald-600/30 text-white" : "text-neutral-400 hover:bg-neutral-800"}`}
        >
          {o === "left" ? "Izq" : o === "right" ? "Der" : o === "center" ? "Centro" : o === "top" ? "Arriba" : o === "bottom" ? "Abajo" : o}
        </button>
      ))}
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-neutral-400">{label}</span>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-neutral-700 bg-neutral-950" />
        <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-white" />
      </div>
    </label>
  );
}
