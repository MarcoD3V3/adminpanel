"use client";



import { useTransition } from "react";

import Link from "next/link";

import { usePathname, useRouter } from "next/navigation";

import {

  LayoutDashboard,

  Users,

  Monitor,

  KeyRound,

  Bell,

  Zap,

  MessageSquare,

  Settings,

  ChevronLeft,

  ChevronRight,

  BarChart3,

  Palette,

  LayoutGrid,
  Gamepad2,
  Bot,

  Gift,

  Radio,

  Layers,

  Calendar,

  Package,

  Target,

  FlaskConical,

  Shield,

  Webhook,

  UserCircle,

} from "lucide-react";

import { cn } from "@/lib/utils";

import { useAdminStore } from "@/lib/store";
import { useTesterModeEnabled } from "@/lib/use-tester-mode-enabled";

import { type AdminRoute } from "@/lib/page-registry-types";



const navSections = [

  {

    label: "General",

    items: [

      { href: "/" as AdminRoute, label: "Dashboard", icon: LayoutDashboard },

      { href: "/live-ops" as AdminRoute, label: "Live Ops", icon: Radio },

      { href: "/analytics" as AdminRoute, label: "Analíticas", icon: BarChart3 },

      { href: "/users" as AdminRoute, label: "Usuarios", icon: Users },

      { href: "/profiles" as AdminRoute, label: "Perfiles", icon: UserCircle },

    ],

  },

  {

    label: "Control",

    items: [

      { href: "/launchers" as AdminRoute, label: "Launchers", icon: Monitor },

      { href: "/launcher-access" as AdminRoute, label: "Acceso Launcher", icon: KeyRound },

      { href: "/notifications" as AdminRoute, label: "Notificaciones", icon: Bell },

      { href: "/events" as AdminRoute, label: "Eventos", icon: Zap },

      { href: "/scheduler" as AdminRoute, label: "Programador", icon: Calendar },

      { href: "/chat" as AdminRoute, label: "Chat", icon: MessageSquare },

    ],

  },

  {

    label: "Contenido",

    items: [

      { href: "/studio" as AdminRoute, label: "Studio", icon: Palette },

      { href: "/modpacks" as AdminRoute, label: "Modpacks", icon: Package },

      { href: "/missions" as AdminRoute, label: "Misiones", icon: Target },

      { href: "/rewards" as AdminRoute, label: "Recompensas", icon: Gift },

    ],

  },

  {

    label: "Minecraft",

    items: [

      { href: "/versions" as AdminRoute, label: "Versiones activas", icon: Layers },

      { href: "/hub-builder" as AdminRoute, label: "Editor interfaz", icon: LayoutGrid },

      { href: "/game-ui" as AdminRoute, label: "Menú (legacy)", icon: Gamepad2 },

    ],

  },

  {

    label: "Sistema",

    items: [

      { href: "/experiments" as AdminRoute, label: "Experimentos", icon: FlaskConical },

      { href: "/security" as AdminRoute, label: "Seguridad", icon: Shield },

      { href: "/integrations" as AdminRoute, label: "Integraciones", icon: Webhook },

      { href: "/automation" as AdminRoute, label: "Automatización", icon: Bot },

      { href: "/settings" as AdminRoute, label: "Configuración", icon: Settings },

    ],

  },

];



export function Sidebar() {

  const pathname = usePathname();

  const router = useRouter();

  const { sidebarOpen, toggleSidebar } = useAdminStore();

  const [, startTransition] = useTransition();
  const testerModeEnabled = useTesterModeEnabled();



  const navigate = (href: AdminRoute) => {

    if (href === pathname) return;

    startTransition(() => {

      router.push(href, { scroll: false });

    });

  };



  return (

    <aside

      className={cn(

        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-[var(--color-border-subtle)] bg-[var(--color-surface)]",

        sidebarOpen ? "w-60" : "w-[68px]"

      )}

      style={{ transition: "width 200ms ease-out" }}

    >

      <div className="flex h-16 items-center gap-3 border-b border-[var(--color-border-subtle)] px-4">

        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)]">

          <span className="text-xs font-medium text-[var(--color-accent)]">CL</span>

        </div>

        {sidebarOpen && (

          <div className="overflow-hidden">

            <p className="truncate text-sm font-medium text-[var(--color-text)]">CraftLauncher</p>

            <p className="truncate text-[10px] tracking-wider text-[var(--color-muted)]">Admin</p>

          </div>

        )}

      </div>



      <nav className="flex-1 overflow-y-auto p-3">

        {navSections.map((section) => (

          <div key={section.label} className="mb-4">

            {sidebarOpen && (

              <p className="mb-2 px-3 text-[10px] font-medium uppercase tracking-widest text-[var(--color-muted)]">

                {section.label}

              </p>

            )}

            <div className="space-y-0.5">

              {section.items.map(({ href, label, icon: Icon }) => {

                const isActive = pathname === href;

                return (

                  <Link

                    key={href}

                    href={href}

                    prefetch={false}
                    scroll={false}

                    onClick={(e) => {

                      e.preventDefault();

                      navigate(href);

                    }}

                    title={label}

                    className={cn(

                      "flex items-center gap-3 rounded-xl px-3 py-2 text-[13px]",

                      isActive

                        ? "bg-[var(--color-surface-raised)] text-[var(--color-text)]"

                        : "text-[var(--color-text-soft)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"

                    )}

                  >

                    <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />

                    {sidebarOpen && (
                      <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                        <span className="truncate">{label}</span>
                        {href === "/launcher-access" && testerModeEnabled !== null && (
                          <span
                            className={cn(
                              "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide",
                              testerModeEnabled
                                ? "bg-violet-500/20 text-violet-300"
                                : "bg-[var(--color-surface-hover)] text-[var(--color-muted)]"
                            )}
                            title={
                              testerModeEnabled
                                ? "Modo testeo activo en el launcher"
                                : "Modo testeo desactivado"
                            }
                          >
                            {testerModeEnabled ? "Test" : "Off"}
                          </span>
                        )}
                      </span>
                    )}

                  </Link>

                );

              })}

            </div>

          </div>

        ))}

      </nav>



      <button

        type="button"

        aria-label={sidebarOpen ? "Contraer menú" : "Expandir menú"}

        onClick={toggleSidebar}

        className="flex h-11 items-center justify-center border-t border-[var(--color-border-subtle)] text-[var(--color-muted)] hover:text-[var(--color-text-soft)]"

      >

        {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}

      </button>

    </aside>

  );

}

