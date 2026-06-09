"use client";

import { hubPillSelectClassName, resolveHubBackgroundColor, type PillSelectStyleId } from "@craftlauncher/shared";

export type HubPillOption = { value: string; label: string };

type HubPillSelectProps = {
  value: string;
  options: HubPillOption[];
  disabled?: boolean;
  placeholder?: string;
  styleVariant?: PillSelectStyleId | number;
  backgroundColor?: string;
  onChange: (value: string) => void;
};

export function HubPillSelect({
  value,
  options,
  disabled,
  placeholder = "—",
  styleVariant = 1,
  backgroundColor,
  onChange,
}: HubPillSelectProps) {
  const hasValue = options.some((o) => o.value === value);
  const pillBg = backgroundColor ? resolveHubBackgroundColor(backgroundColor, "transparent") : undefined;

  return (
    <select
      className={[hubPillSelectClassName(styleVariant), "hub-preview-pill-fill"].filter(Boolean).join(" ")}
      style={pillBg ? { backgroundColor: pillBg } : undefined}
      value={hasValue ? value : options[0]?.value ?? ""}
      disabled={disabled || options.length === 0}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.length === 0 ? (
        <option value="">{placeholder}</option>
      ) : (
        options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))
      )}
    </select>
  );
}
