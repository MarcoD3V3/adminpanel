export const PROFILE_PLANS = [
  { id: "free", label: "Free", premium: false },
  { id: "premium", label: "Premium", premium: true },
  { id: "vip", label: "VIP", premium: true },
  { id: "pro", label: "Pro", premium: true },
  { id: "plus", label: "Plus", premium: true },
  { id: "trial", label: "Trial (7 días)", premium: false },
  { id: "student", label: "Student", premium: false },
  { id: "partner", label: "Partner", premium: true },
  { id: "staff", label: "Staff", premium: true },
  { id: "beta", label: "Beta Tester", premium: true },
  { id: "creator", label: "Creator", premium: true },
  { id: "legacy", label: "Legacy", premium: false },
] as const;

export type ProfilePlanId = (typeof PROFILE_PLANS)[number]["id"];

const PLAN_IDS = new Set<string>(PROFILE_PLANS.map((p) => p.id));

export function isProfilePlanId(value: string): value is ProfilePlanId {
  return PLAN_IDS.has(value);
}

export function normalizeProfilePlan(value?: string | null): ProfilePlanId {
  if (value && isProfilePlanId(value)) return value;
  return "free";
}

export function isPremiumPlan(plan: string): boolean {
  const row = PROFILE_PLANS.find((p) => p.id === plan);
  return row?.premium ?? plan !== "free";
}

export function profilePlanLabel(plan: string): string {
  return PROFILE_PLANS.find((p) => p.id === plan)?.label ?? plan;
}
