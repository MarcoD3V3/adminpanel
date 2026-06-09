import { HubBuilderFonts } from "@/components/layout/HubBuilderFonts";

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <HubBuilderFonts />
      {children}
    </>
  );
}
