import { ArrowUpCircle, Check, Download, ExternalLink, Package, X } from "lucide-react";
import type { CurseForgeModFile, CurseForgeModSummary, ModCatalogTab } from "@craftlauncher/shared";
import { useMemo } from "react";
import { openExternalUrl } from "@/lib/electron-api";
import type { InstalledModRow } from "@/lib/electron-api";
import type { ModPreviewState } from "@/lib/launcher-data-store";
import { resolveModInstallStatus } from "@/lib/mod-install-status";

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function primaryActionLabel(tab: ModCatalogTab, status: ReturnType<typeof resolveModInstallStatus>) {
  if (status.state === "update") return "Actualizar mod";
  if (status.state === "installed") {
    if (tab === "modpacks" || tab === "featured") return "Modpack instalado";
    if (tab === "resourcepacks") return "Texture pack instalado";
    return "Ya instalado";
  }
  if (tab === "modpacks" || tab === "featured") return "Instalar modpack";
  if (tab === "resourcepacks") return "Instalar texture pack";
  return "Instalar mod";
}

function pickPrimaryFile(files: CurseForgeModFile[]) {
  return files[0] ?? null;
}

type MetaItem = { label: string; value: string };

function buildMetaItems(mod: CurseForgeModSummary, primaryFile: CurseForgeModFile | null): MetaItem[] {
  const items: MetaItem[] = [];

  if (mod.slug) items.push({ label: "Proyecto", value: mod.slug });
  if (primaryFile) {
    items.push({ label: "Versión", value: primaryFile.displayName });
    if (primaryFile.gameVersions.length > 0) {
      items.push({ label: "Minecraft", value: primaryFile.gameVersions.slice(0, 3).join(" · ") });
    }
    items.push({ label: "Archivo", value: `${primaryFile.fileName} (${formatBytes(primaryFile.fileLength)})` });
  }
  if (mod.dateModified) {
    const formatted = formatDate(mod.dateModified);
    if (formatted) items.push({ label: "Actualizado", value: formatted });
  }
  items.push({ label: "Descargas", value: mod.downloadCount.toLocaleString() });
  if (mod.id > 0) items.push({ label: "ID", value: String(mod.id) });

  return items;
}

interface ModPreviewPaneProps {
  tab: ModCatalogTab;
  preview: ModPreviewState;
  installing: boolean;
  hasActiveInstance: boolean;
  installBlocked?: boolean;
  installedMods?: InstalledModRow[];
  onClose: () => void;
  onInstall: () => void;
}

export function ModPreviewPane({
  tab,
  preview,
  installing,
  hasActiveInstance,
  installBlocked = false,
  installedMods = [],
  onClose,
  onInstall,
}: ModPreviewPaneProps) {
  const { mod, files, loading, error, filesWarning } = preview;

  const primaryFile = useMemo(() => pickPrimaryFile(files), [files]);

  const installStatus = useMemo(
    () => (mod ? resolveModInstallStatus(mod.id, installedMods, files) : { state: "none" as const }),
    [mod, installedMods, files]
  );

  const metaItems = useMemo(
    () => (mod ? buildMetaItems(mod, primaryFile) : []),
    [mod, primaryFile]
  );

  if (!mod && !loading && !error) {
    return (
      <aside className="mc-preview mc-preview-empty">
        <p>Selecciona un mod del catálogo para ver ficha, descripción y acciones de instalación.</p>
      </aside>
    );
  }

  if (loading) {
    return (
      <aside className="mc-preview">
        <p className="mc-preview-loading">Cargando vista previa…</p>
      </aside>
    );
  }

  if (error) {
    return (
      <aside className="mc-preview">
        <p className="lp-error">{error}</p>
        <button type="button" className="lp-btn-secondary" onClick={onClose}>
          Cerrar
        </button>
      </aside>
    );
  }

  if (!mod) return null;

  const isInstalled = installStatus.state === "installed";
  const hasUpdate = installStatus.state === "update";
  const primaryDisabled =
    installing || !hasActiveInstance || installBlocked || (isInstalled && !hasUpdate);

  return (
    <aside className="mc-preview">
      <div className="mc-preview-head">
        <button type="button" className="mc-preview-close" onClick={onClose} aria-label="Cerrar vista previa">
          <X size={14} />
        </button>
      </div>

      <div className="mc-preview-body">
        <div className="mc-preview-hero">
          {mod.logoUrl ? (
            <img src={mod.logoUrl} alt="" className="mc-preview-logo" />
          ) : (
            <div className="mc-preview-logo mc-preview-logo-fallback">
              <Package size={28} />
            </div>
          )}
          <div className="mc-preview-hero-text">
            <h3 className="mc-preview-title">{mod.name}</h3>
            <p className="mc-preview-authors">{mod.authors.join(", ") || "Autor desconocido"}</p>
          </div>
        </div>

        {(isInstalled || hasUpdate) && (
          <div className="mc-preview-status-row">
            {isInstalled && (
              <span className="mc-preview-status mc-preview-status--ok">
                <Check size={11} aria-hidden />
                Instalado
                {installStatus.row.fileName ? ` · ${installStatus.row.fileName}` : ""}
              </span>
            )}
            {hasUpdate && (
              <span className="mc-preview-status mc-preview-status--update">
                <ArrowUpCircle size={11} aria-hidden />
                Actualización
                {installStatus.row.latestFileName ? ` · ${installStatus.row.latestFileName}` : ""}
              </span>
            )}
          </div>
        )}

        {mod.categories && mod.categories.length > 0 && (
          <div className="mc-preview-tags">
            {mod.categories.slice(0, 6).map((c) => (
              <span key={c} className="mc-tag">
                {c}
              </span>
            ))}
          </div>
        )}

        {mod.summary && <p className="mc-preview-desc">{mod.summary}</p>}

        {metaItems.length > 0 && (
          <dl className="mc-preview-meta">
            {metaItems.map((item) => (
              <div key={item.label} className="mc-preview-meta__row">
                <dt>{item.label}</dt>
                <dd title={item.value}>{item.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {filesWarning && !error && <p className="mc-preview-warn">{filesWarning}</p>}
      </div>

      <div className="mc-preview-actions">
        <button
          type="button"
          className={`lp-btn${isInstalled && !hasUpdate ? " lp-btn-installed" : ""}${hasUpdate ? " lp-btn-update" : ""}`}
          disabled={primaryDisabled}
          onClick={onInstall}
        >
          {hasUpdate ? <ArrowUpCircle size={14} /> : isInstalled ? <Check size={14} /> : <Download size={14} />}{" "}
          {primaryActionLabel(tab, installStatus)}
        </button>
        {mod.websiteUrl && (
          <button
            type="button"
            className="lp-btn-secondary"
            onClick={() => void openExternalUrl(mod.websiteUrl!)}
          >
            <ExternalLink size={14} /> CurseForge
          </button>
        )}
      </div>
    </aside>
  );
}

interface ModCatalogCardProps {
  mod: CurseForgeModSummary;
  selected: boolean;
  badge?: "installed" | "update" | null;
  onSelect: () => void;
}

export function ModCatalogCard({ mod, selected, badge = null, onSelect }: ModCatalogCardProps) {
  return (
    <button type="button" className={`mc-card${selected ? " selected" : ""}`} onClick={onSelect}>
      {mod.logoUrl ? (
        <img src={mod.logoUrl} alt="" className="mc-card-img" loading="lazy" />
      ) : (
        <div className="mc-card-img mc-card-img-fallback">
          <Package size={20} />
        </div>
      )}
      <div className="mc-card-body">
        <strong className="mc-card-name">
          {mod.name}
          {badge === "installed" && <span className="mc-install-badge">Instalado</span>}
          {badge === "update" && <span className="mc-install-badge mc-install-badge-update">Actualizar</span>}
        </strong>
        <p className="mc-card-summary">
          {mod.summary.slice(0, 90)}
          {mod.summary.length > 90 ? "…" : ""}
        </p>
        <small className="mc-card-meta">
          {mod.downloadCount.toLocaleString()} ↓ · {mod.authors[0] ?? "—"}
        </small>
      </div>
    </button>
  );
}
