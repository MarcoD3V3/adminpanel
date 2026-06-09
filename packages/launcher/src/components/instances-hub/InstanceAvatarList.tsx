"use client";

import type { CSSProperties } from "react";
import type { HubElement, LauncherInstance } from "@craftlauncher/shared";
import {
  instanceAvatarClusterStyle,
  instanceAvatarGroupsWrapStyle,
  instanceAvatarShellStyle,
  resolveInstanceAvatarBuckets,
  resolveInstanceAvatarRenderSize,
  resolveInstanceAvatarUi,
} from "@craftlauncher/shared";
import { InstanceAvatar } from "./InstanceAvatar";

type InstanceAvatarListProps = {
  element: HubElement;
  instances: LauncherInstance[];
  activeId?: string | null;
  loading?: boolean;
  onSelect?: (id: string) => void;
};

function avatarSizeProp(element: HubElement, layout: ReturnType<typeof resolveInstanceAvatarUi>["layout"]): number {
  return resolveInstanceAvatarRenderSize(element, layout);
}

function PreviewAvatarCell({
  instance,
  size,
  selected,
  disabled,
  onClick,
}: {
  instance: Pick<LauncherInstance, "name" | "iconColor" | "iconUrl">;
  size: number;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <div className="ih-instance-avatar-grid-cell">
      <InstanceAvatar
        instance={instance}
        size={size}
        selected={selected}
        disabled={disabled}
        onClick={onClick}
        title={instance.name}
      />
    </div>
  );
}

export function InstanceAvatarList({
  element,
  instances,
  activeId,
  loading,
  onSelect,
}: InstanceAvatarListProps) {
  const { ui, layout } = resolveInstanceAvatarUi(element);
  const buckets = resolveInstanceAvatarBuckets(instances, element);
  const clusterStyle = instanceAvatarClusterStyle(layout, ui, element);
  const size = avatarSizeProp(element, layout);
  const multiGroup = buckets.length > 1;

  const renderCluster = (group: LauncherInstance[]) => (
    <div className="ih-instance-avatar-grid-inner" style={clusterStyle as CSSProperties}>
      {group.map((inst) => (
        <PreviewAvatarCell
          key={inst.id}
          instance={inst}
          size={size}
          selected={inst.id === activeId}
          disabled={loading}
          onClick={onSelect ? () => onSelect(inst.id) : undefined}
        />
      ))}
    </div>
  );

  return (
    <div className="ih-instance-avatar-grid" style={instanceAvatarShellStyle(element) as CSSProperties}>
      {multiGroup ? (
        <div className="ih-instance-avatar-groups" style={instanceAvatarGroupsWrapStyle(layout) as CSSProperties}>
          {buckets.map((group, i) => (
            <div key={`group-${i}`} className="ih-instance-avatar-group">
              {renderCluster(group)}
            </div>
          ))}
        </div>
      ) : (
        renderCluster(buckets[0] ?? [])
      )}
    </div>
  );
}

export function InstanceAvatarSingle({
  element,
  instance,
}: {
  element: HubElement;
  instance: Pick<LauncherInstance, "name" | "iconColor" | "iconUrl"> | null;
}) {
  const { layout } = resolveInstanceAvatarUi(element);
  const size = resolveInstanceAvatarRenderSize(element, layout);

  if (!instance) {
    return (
      <div className="ih-instance-avatar-single-wrap">
        <div
          className="ih-instance-avatar ih-instance-avatar--empty"
          style={{ width: size, height: size, borderRadius: "50%" }}
          aria-label="Sin perfil"
        >
          ?
        </div>
      </div>
    );
  }

  return (
    <div className="ih-instance-avatar-single-wrap">
      <InstanceAvatar instance={instance} size={size} title={instance.name} />
    </div>
  );
}
