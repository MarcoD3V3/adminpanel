"use client";

import type { CSSProperties } from "react";
import type { LauncherInstance } from "@craftlauncher/shared";
import { instanceAvatarInitial, resolveInstanceIconColor } from "@craftlauncher/shared";

function joinClasses(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

type InstanceAvatarProps = {
  instance: Pick<LauncherInstance, "name" | "iconColor" | "iconUrl">;
  size?: number | "fill";
  selected?: boolean;
  className?: string;
  onClick?: () => void;
  title?: string;
  disabled?: boolean;
};

function avatarStyle(size: number | "fill" | undefined): CSSProperties {
  if (size === "fill") {
    return {
      width: "min(100%, 100%)",
      height: "auto",
      maxWidth: "100%",
      maxHeight: "100%",
      aspectRatio: "1",
    };
  }
  if (size && size > 0) {
    return {
      width: size,
      height: size,
      borderRadius: "50%",
      ["--ih-avatar-size" as string]: `${size}px`,
    };
  }
  return { borderRadius: "50%" };
}

export function InstanceAvatar({
  instance,
  size,
  selected,
  className,
  onClick,
  title,
  disabled,
}: InstanceAvatarProps) {
  const initial = instanceAvatarInitial(instance.name);
  const bg = resolveInstanceIconColor(instance);
  const style = avatarStyle(size);
  const label = title ?? instance.name;

  const content = instance.iconUrl ? (
    <img src={instance.iconUrl} alt="" className="ih-instance-avatar-img" draggable={false} />
  ) : (
    <span className="ih-instance-avatar-letter">{initial}</span>
  );

  const classes = joinClasses(
    "ih-instance-avatar",
    selected && "selected",
    onClick && "clickable",
    !instance.iconUrl && "ih-instance-avatar--letter",
    size === "fill" && "ih-instance-avatar--fill",
    size === undefined && "ih-instance-avatar--fluid",
    className
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={classes}
        style={{ ...style, ...( !instance.iconUrl ? { background: bg } : {}) }}
        onClick={onClick}
        title={label}
        aria-label={label}
        disabled={disabled}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className={classes}
      style={{ ...style, ...( !instance.iconUrl ? { background: bg } : {}) }}
      title={label}
      aria-label={label}
    >
      {content}
    </div>
  );
}
