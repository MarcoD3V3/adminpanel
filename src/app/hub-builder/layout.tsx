import { HubBuilderFonts } from "@/components/layout/HubBuilderFonts";

export default function HubBuilderLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <HubBuilderFonts />
      {children}
    </>
  );
}
