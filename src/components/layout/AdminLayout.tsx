"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { useAdminStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { isAdminRoute, PAGE_REGISTRY } from "@/lib/page-registry";

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { sidebarOpen } = useAdminStore();
  const useRegistry = isAdminRoute(pathname);
  const ActivePage = useRegistry ? PAGE_REGISTRY[pathname] : null;

  return (
    <div
      className="min-h-screen bg-[var(--color-surface)]"
      onContextMenu={(e) => e.preventDefault()}
    >
      <Sidebar />
      <main
        className={cn("min-h-screen", sidebarOpen ? "ml-60" : "ml-[68px]")}
        style={{ transition: "margin-left 200ms ease-out" }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {ActivePage ? (
          <>
            <div className="hidden" aria-hidden>
              {children}
            </div>
            <ActivePage key={pathname} />
          </>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
