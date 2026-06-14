export type ExperimentVariant = "A" | "B";

/** Clases CSS que el launcher aplica según variantes activas. */
export function experimentShellClasses(variants: Record<string, ExperimentVariant>): string {
  const classes: string[] = [];
  if (variants.new_ui_v2 === "B") classes.push("experiment-ui-v2");
  if (variants.big_play_btn === "B") classes.push("experiment-big-play");
  return classes.join(" ");
}

export function isExperimentVariant(
  variants: Record<string, ExperimentVariant>,
  key: string,
  variant: ExperimentVariant
): boolean {
  return variants[key] === variant;
}
