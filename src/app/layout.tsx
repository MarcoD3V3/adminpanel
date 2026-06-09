import type { Metadata } from "next";
import Script from "next/script";
import { AdminShell } from "@/components/layout/AdminShell";
import { BlockNativeContextMenu, BLOCK_CONTEXT_MENU_SCRIPT } from "@/components/BlockNativeContextMenu";
import "./globals.css";

export const metadata: Metadata = {
  title: "CraftLauncher Admin Panel",
  description: "Panel de administración para launcher de Minecraft premium",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Script id="block-native-context-menu" strategy="beforeInteractive">
          {BLOCK_CONTEXT_MENU_SCRIPT}
        </Script>
        <BlockNativeContextMenu>
          <AdminShell>{children}</AdminShell>
        </BlockNativeContextMenu>
      </body>
    </html>
  );
}
