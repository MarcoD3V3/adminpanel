import { HubBuilderFonts } from "@/components/layout/HubBuilderFonts";

export default function GameUiLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <HubBuilderFonts />
      {children}
    </>
  );
}
