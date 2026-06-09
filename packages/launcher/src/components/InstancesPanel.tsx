import { FolderOpen, Layers, Package, Plus, Trash2, User, X } from "lucide-react";
import { useEffect, useState } from "react";
import { FORGE_VERSIONS } from "@craftlauncher/shared";
import { useLauncherDataStore } from "@/lib/launcher-data-store";

type InstanceTab = "profile" | "all";

export function InstancesPanel() {
  const close = useLauncherDataStore((s) => s.closePanel);
  const instances = useLauncherDataStore((s) => s.instances);
  const activeInstance = useLauncherDataStore((s) => s.activeInstance);
  const instanceStats = useLauncherDataStore((s) => s.instanceStats);
  const settings = useLauncherDataStore((s) => s.settings);
  const loading = useLauncherDataStore((s) => s.loading);

  const [section, setSection] = useState<InstanceTab>("profile");
  const [name, setName] = useState("");
  const [mcVersion, setMcVersion] = useState("1.20.1");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    void useLauncherDataStore.getState().bootstrap();
  }, []);

  return (
    <div className="lp-overlay" role="dialog" aria-modal="true">
      <div className="lp-panel lp-panel-wide">
        <header className="lp-header">
          <div>
            <h2 className="lp-title">Perfiles</h2>
            <p className="lp-sub">Cada perfil tiene mods, texturas y carpeta de juego separados</p>
          </div>
          <button type="button" className="lp-close" onClick={close} aria-label="Cerrar">
            <X size={16} />
          </button>
        </header>

        <div className="lp-tabs">
          <button
            type="button"
            className={section === "profile" ? "lp-tab active" : "lp-tab"}
            onClick={() => setSection("profile")}
          >
            <User size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
            Mi perfil
          </button>
          <button
            type="button"
            className={section === "all" ? "lp-tab active" : "lp-tab"}
            onClick={() => setSection("all")}
          >
            <Layers size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
            Todos ({instances.length})
          </button>
        </div>

        {section === "profile" && (
          <>
            {activeInstance ? (
              <div className="profile-hero">
                <div className="profile-hero-main">
                  <span
                    className="profile-hero-dot"
                    style={{ background: activeInstance.iconColor ?? "#496f4f" }}
                  />
                  <div>
                    <p className="profile-hero-label">Perfil activo</p>
                    <h3 className="profile-hero-name">{activeInstance.name}</h3>
                    <p className="profile-hero-meta">
                      Minecraft {activeInstance.mcVersion} · {activeInstance.loader}
                      {activeInstance.forgeVersion ? ` · Forge ${activeInstance.forgeVersion}` : ""}
                    </p>
                  </div>
                  <span className="lp-badge profile-hero-badge">En uso</span>
                </div>

                <div className="profile-stats">
                  <div className="profile-stat">
                    <Package size={16} />
                    <span>{instanceStats?.modCount ?? 0}</span>
                    <small>Mods</small>
                  </div>
                  <div className="profile-stat">
                    <Layers size={16} />
                    <span>{instanceStats?.resourcePackCount ?? 0}</span>
                    <small>Texturas</small>
                  </div>
                </div>

                {settings?.dataDir && (
                  <p className="profile-path">
                    <FolderOpen size={12} />
                    <span title={settings.dataDir}>{settings.dataDir}</span>
                  </p>
                )}

                <div className="profile-actions">
                  <button
                    type="button"
                    className="lp-btn-secondary"
                    onClick={() => useLauncherDataStore.getState().openPanel("mods")}
                  >
                    Abrir catálogo
                  </button>
                  <button type="button" className="lp-btn-secondary" onClick={() => setSection("all")}>
                    Cambiar perfil
                  </button>
                </div>
              </div>
            ) : (
              <p className="lp-empty">No hay perfil activo. Crea uno en la pestaña Todos.</p>
            )}
          </>
        )}

        {section === "all" && (
          <>
            <div className="lp-toolbar">
              <button type="button" className="lp-btn" onClick={() => setShowForm(!showForm)}>
                <Plus size={14} /> Nuevo perfil
              </button>
            </div>

            {showForm && (
              <form
                className="lp-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void useLauncherDataStore
                    .getState()
                    .createInstance({ name, mcVersion, loader: "forge" })
                    .then(() => {
                      setShowForm(false);
                      setName("");
                      setSection("profile");
                    });
                }}
              >
                <input
                  className="lp-input"
                  placeholder="Nombre (opcional — si lo dejas vacío se usa la versión)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <select className="lp-input" value={mcVersion} onChange={(e) => setMcVersion(e.target.value)}>
                  {FORGE_VERSIONS.map((v) => (
                    <option key={v.id} value={v.mcVersion}>
                      {v.label}
                    </option>
                  ))}
                </select>
                <button type="submit" className="lp-btn" disabled={loading}>
                  Crear
                </button>
              </form>
            )}

            <ul className="lp-instance-list">
              {instances.map((inst) => {
                const active = inst.id === activeInstance?.id;
                return (
                  <li key={inst.id} className={`lp-instance${active ? " active" : ""}`}>
                    <button
                      type="button"
                      className="lp-instance-main"
                      onClick={() => {
                        void useLauncherDataStore.getState().selectInstance(inst.id);
                        setSection("profile");
                      }}
                    >
                      <span className="lp-instance-dot" style={{ background: inst.iconColor ?? "#496f4f" }} />
                      <span className="lp-instance-text">
                        <strong>{inst.name}</strong>
                        <small>
                          {inst.mcVersion} · {inst.loader}
                          {inst.forgeVersion ? ` · Forge ${inst.forgeVersion}` : ""}
                        </small>
                      </span>
                      {active && <span className="lp-badge">Activo</span>}
                    </button>
                    {instances.length > 1 && (
                      <button
                        type="button"
                        className="lp-icon-btn danger"
                        onClick={() => void useLauncherDataStore.getState().deleteInstance(inst.id)}
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {loading && <p className="lp-status">Cargando perfiles…</p>}
      </div>
    </div>
  );
}
