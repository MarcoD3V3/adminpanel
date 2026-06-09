import { Search } from "lucide-react";
import { useEffect } from "react";
import { useModSearchInput } from "@/hooks/use-mod-search-input";
import { ensureModsBootstrapped } from "./mods-hub-bootstrap";

export function ModsSearchHub() {
  const { modQuery, modTab, placeholder, setQuery, submitSearch } = useModSearchInput();

  useEffect(() => {
    ensureModsBootstrapped();
  }, []);

  if (modTab === "featured") return null;

  return (
    <form
      className="lp-search"
      onSubmit={(e) => {
        e.preventDefault();
        submitSearch();
      }}
    >
      <div className="lp-search-field">
        <Search size={14} className="lp-search-icon" aria-hidden />
        <input
          className="lp-input lp-search-input"
          placeholder={placeholder}
          value={modQuery}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
    </form>
  );
}
