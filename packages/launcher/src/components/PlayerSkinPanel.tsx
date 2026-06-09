import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2, User, X } from "lucide-react";
import {
  deletePlayerSkin,
  fetchPlayerSkin,
  uploadPlayerSkin,
} from "@craftlauncher/shared";
import { ADMIN_API_URL } from "@/lib/config";
import { useAuthStore } from "@/lib/auth-store";
import { useLauncherDataStore } from "@/lib/launcher-data-store";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function readImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("invalid_image"));
    img.src = dataUrl;
  });
}

const ALLOWED_DIMS = new Set(["64x32", "64x64", "128x64", "128x128"]);

export function PlayerSkinPanel() {
  const close = useLauncherDataStore((s) => s.closePanel);
  const username = useAuthStore((s) => s.username);
  const displayName = useAuthStore((s) => s.displayName);
  const resolveHeaders = useAuthStore((s) => s.resolveHeaders);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [hasSkin, setHasSkin] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requiresAccount, setRequiresAccount] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadSkin = useCallback(async () => {
    setLoading(true);
    setError(null);
    const headers = await resolveHeaders();
    if (!headers) {
      setError("Inicia sesión para gestionar tu skin");
      setLoading(false);
      return;
    }
    const info = await fetchPlayerSkin(ADMIN_API_URL, headers, { includeImage: true });
    if (info.requiresAccount) {
      setRequiresAccount(true);
      setHasSkin(false);
      setPreview(null);
      setError(info.error ?? "Usa inicio de sesión con cuenta, no token de activación");
      setLoading(false);
      return;
    }
    setRequiresAccount(false);
    setHasSkin(info.hasSkin);
    setUpdatedAt(info.updatedAt ?? null);
    setPreview(info.dataUrl ?? null);
    if (info.error) setError(info.error);
    setLoading(false);
  }, [resolveHeaders]);

  useEffect(() => {
    void loadSkin();
  }, [loadSkin]);

  const handlePickFile = async (file: File | null) => {
    if (!file) return;
    const isPng =
      file.type.includes("png") || file.name.toLowerCase().endsWith(".png");
    if (!isPng) {
      setError("Solo se admiten archivos PNG");
      return;
    }
    if (file.size > 512 * 1024) {
      setError("La imagen supera 512 KB");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      const dims = await readImageDimensions(dataUrl);
      const dimKey = `${dims.width}x${dims.height}`;
      if (!ALLOWED_DIMS.has(dimKey)) {
        setError(
          `Dimensiones ${dims.width}×${dims.height}. Usa 64×32, 64×64, 128×64 o 128×128.`
        );
        return;
      }
      const headers = await resolveHeaders();
      if (!headers) {
        setError("Sesión no disponible");
        return;
      }
      const result = await uploadPlayerSkin(ADMIN_API_URL, headers, dataUrl);
      if (!result.success) {
        setError(result.error ?? "No se pudo subir la skin");
        return;
      }
      setPreview(dataUrl);
      setHasSkin(true);
      setUpdatedAt(result.updatedAt ?? new Date().toISOString());
    } catch {
      setError("No se pudo leer el archivo");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    setError(null);
    const headers = await resolveHeaders();
    if (!headers) return;
    const result = await deletePlayerSkin(ADMIN_API_URL, headers);
    if (!result.success) {
      setError(result.error ?? "No se pudo eliminar");
      setSaving(false);
      return;
    }
    setHasSkin(false);
    setPreview(null);
    setUpdatedAt(null);
    setSaving(false);
  };

  return (
    <div className="lp-overlay" role="dialog" aria-modal="true" aria-label="Mi skin">
      <div className="lp-panel player-skin-panel">
        <header className="lp-header">
          <div>
            <h2 className="lp-title">Mi skin</h2>
            <p className="lp-sub">
              Solo visible para jugadores con CraftLauncher y el mod instalado.
            </p>
          </div>
          <button type="button" className="lp-close" title="Cerrar" onClick={() => close()}>
            <X size={16} />
          </button>
        </header>

        <div className="player-skin-body">
          {loading ? (
            <p className="center-msg">Cargando…</p>
          ) : (
            <>
              <div className="player-skin-preview-wrap">
                {preview ? (
                  <img src={preview} alt="Vista previa de skin" className="player-skin-preview" />
                ) : (
                  <div className="player-skin-placeholder">
                    <User size={40} />
                    <span>Sin skin personalizada</span>
                  </div>
                )}
              </div>

              <div className="player-skin-meta">
                <strong>{displayName ?? username ?? "Jugador"}</strong>
                {updatedAt && (
                  <span>Actualizada: {new Date(updatedAt).toLocaleString()}</span>
                )}
              </div>

              {error && <p className="player-skin-error">{error}</p>}

              {!requiresAccount && (
                <div className="player-skin-actions">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png"
                    hidden
                    onChange={(e) => void handlePickFile(e.target.files?.[0] ?? null)}
                  />
                  <button
                    type="button"
                    className="lp-btn"
                    disabled={saving}
                    onClick={() => fileRef.current?.click()}
                  >
                    <ImagePlus size={16} />
                    {hasSkin ? "Cambiar skin" : "Subir skin PNG"}
                  </button>
                  {hasSkin && (
                    <button
                      type="button"
                      className="lp-btn-secondary"
                      disabled={saving}
                      onClick={() => void handleDelete()}
                    >
                      <Trash2 size={16} />
                      Quitar
                    </button>
                  )}
                </div>
              )}

              <p className="player-skin-hint">
                Formatos: 64×32, 64×64, 128×64 o 128×128. Máx. 512 KB. Se aplica al lanzar
                Minecraft con tu sesión activa.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
