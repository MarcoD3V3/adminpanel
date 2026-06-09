# CraftLauncher Desktop (Electron)

App de **escritorio** publicable. Se conecta al **admin panel** (Next.js) y renderiza el hub de `/hub-builder`.

## Arquitectura

```
Admin (Next.js)  ──GET /api/hub-builder──►  Launcher (Electron + React)
                                                    │
                                                    ▼
                                            Node.js main process
                                            (lanzar MC, abrir URLs…)
```

| Capa | Tecnología |
|------|------------|
| Admin | Next.js + React |
| Shared | `packages/shared` — tipos, scripts, API |
| UI | React + Vite |
| Desktop | **Electron** (sin Rust) |

## Requisitos

- **Node.js 20+** — nada más (no Rust, no Visual Studio)

```powershell
npm install
copy packages\launcher\.env.example packages\launcher\.env
```

## Desarrollo

**Terminal 1 — Admin:**

```powershell
npm run dev
```

**Terminal 2 — Launcher:**

```powershell
npm run launcher:dev
```

Abre la ventana de Electron con tu hub.

## Publicar

```powershell
npm run launcher:build
```

Instalador en: `packages/launcher/release/`

## Cómo funciona Electron

1. **`electron/main.mjs`** — ventana nativa, IPC, abrir URLs, lanzar MC.
2. **`electron/preload.mjs`** — expone `window.launcher` de forma segura.
3. **`src/`** — misma UI React; usa `getLauncherApi()` en vez de Tauri `invoke()`.

## Config

`packages/launcher/.env`:

```env
VITE_ADMIN_API_URL=http://localhost:3000
```

Admin (`.env.local` en la raíz del monorepo):

```env
LAUNCHER_ADMIN_SECRET=clave-larga-min-16-chars
LAUNCHER_TOKEN_PEPPER=otro-secreto-distinto
LAUNCHER_AUTH_ENFORCE=true
LAUNCHER_ORIGIN=http://localhost:1420
```

Copia `.env.example` → `.env.local` y cambia los secretos.

## Autenticación del launcher

Gestiona tokens y sesiones en el admin: **Acceso Launcher** (`/launcher-access`) en el sidebar.

1. Entra con `LAUNCHER_ADMIN_SECRET` (cookie HttpOnly en el servidor).
2. Genera un **token de un solo uso** (`clakt_…`) y cópialo al instante.
3. Pégalo en la pantalla de activación del launcher desktop.
4. El launcher guarda la sesión (`clses_…`, 90 días) en cookie + localStorage.
5. Sin sesión válida el launcher queda bloqueado.

Seguridad: hashes con pepper, timing-safe, rate limits, CORS estricto, auditoría, sesión admin HttpOnly.

## Estructura

```
packages/launcher/
  electron/     ← main + preload (Node)
  src/          ← React UI
  dist/         ← build de Vite (producción)
```
