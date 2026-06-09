# CraftLauncher — Admin Panel

Panel de administración web para controlar un launcher de Minecraft premium. Permite gestionar usuarios, controlar launchers remotamente, enviar notificaciones, ejecutar eventos y moderar el chat.

## Inicio rápido

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

## Secciones del panel

| Ruta | Función |
|------|---------|
| `/` | Dashboard con stats y launchers conectados |
| `/users` | Gestión de usuarios (ban, premium, permisos) |
| `/launchers` | Control remoto por instancia (reiniciar, actualizar, cerrar MC) |
| `/notifications` | Enviar notificaciones push a launchers |
| `/events` | Disparar eventos remotos (update, maintenance, broadcast) |
| `/chat` | Moderar chat global y entre amigos |
| `/settings` | Config API, auth Microsoft, seguridad |

## Launcher desktop (Electron)

La app que publicas al mundo está en `packages/launcher/`. Guía: **[LAUNCHER.md](./LAUNCHER.md)**

```bash
npm install
npm run launcher:dev    # ventana Electron + sync con admin
npm run launcher:build  # instalador .exe (NSIS)
```

Solo necesitas **Node.js** — no Rust.

## Stack del launcher (cliente desktop)

### Implementado: **Electron + React** (`packages/launcher`)

| Ventaja | Detalle |
|---------|---------|
| UI moderna | Mismas tecnologías web que este admin panel |
| Ligero | ~5-10 MB vs ~150 MB de Electron |
| Rendimiento | Rust backend, muy rápido |
| Reutilización | Puedes compartir componentes UI con Next.js |

### Alternativa popular: **Electron + React**

- Más documentación y ejemplos (MultiMC, Prism Launcher usan stacks similares)
- Ecosistema enorme
- Más pesado en RAM y disco

### Para look nativo Windows: **C# + WinUI 3**

- UI nativa de Windows 11 (Mica, Acrylic)
- Excelente si solo apuntas a Windows
- Usar con .NET 8+

### NO recomendado para UI moderna: Java puro

- JavaFX se ve dated; Kotlin + Compose Desktop es mejor alternativa JVM

## Arquitectura sugerida

```
┌─────────────────┐     WebSocket/REST     ┌──────────────────┐
│  Admin Panel    │ ◄──────────────────────► │  Backend API     │
│  (Next.js)      │                          │  (Node/Fastify)  │
└─────────────────┘                          └────────┬─────────┘
                                                      │
                                           WebSocket  │
                                                      ▼
                                             ┌──────────────────┐
                                             │  Launcher Client │
                                             │  (Tauri/Electron)│
                                             └──────────────────┘
```

### Backend (crear después)

- **Node.js + Fastify** o **Go** para el servidor API
- **Socket.io** o **ws** para comunicación en tiempo real
- **PostgreSQL** para usuarios, mensajes, eventos
- **Redis** para presencia online y pub/sub del chat

### Comunicación launcher ↔ admin

```typescript
// Eventos que el admin puede enviar al launcher
type RemoteCommand =
  | { type: "notification"; title: string; message: string }
  | { type: "force_update"; version: string }
  | { type: "restart" }
  | { type: "kill_game" }
  | { type: "maintenance"; enabled: boolean }
  | { type: "broadcast_event"; eventName: string; data: unknown }
  | { type: "sync_config"; config: LauncherConfig };

// Eventos que el launcher envía al admin
type LauncherEvent =
  | { type: "heartbeat"; ram: number; cpu: number; status: string }
  | { type: "game_launch"; version: string }
  | { type: "chat_message"; channel: "global" | "friends"; content: string }
  | { type: "login"; userId: string };
```

## Próximos pasos

1. Conectar API routes a una base de datos real (Prisma + PostgreSQL)
2. Implementar WebSocket server para tiempo real
3. Añadir autenticación admin (NextAuth.js)
4. Crear el launcher con Tauri 2 + React
5. Integrar Microsoft OAuth para cuentas premium

## Tech stack del admin panel

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS 4
- Zustand (estado local)
- Lucide React (iconos)
# adminpanel
