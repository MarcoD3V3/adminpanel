import { parseMessageLinks } from "@craftlauncher/shared";
import { openExternalUrl } from "@/lib/electron-api";

export function MessageLinkText({ text, className }: { text: string; className?: string }) {
  const segments = parseMessageLinks(text);
  return (
    <span className={className}>
      {segments.map((seg, i) =>
        seg.type === "link" ? (
          <a
            key={`${seg.href}-${i}`}
            href={seg.href}
            className="hub-chat-link"
            onClick={(e) => {
              e.preventDefault();
              void openExternalUrl(seg.href);
            }}
          >
            {seg.value}
          </a>
        ) : (
          <span key={`t-${i}`}>{seg.value}</span>
        )
      )}
    </span>
  );
}
