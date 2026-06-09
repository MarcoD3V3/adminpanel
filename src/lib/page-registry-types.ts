export type AdminRoute =
  | "/"
  | "/live-ops"
  | "/analytics"
  | "/users"
  | "/profiles"
  | "/launchers"
  | "/launcher-access"
  | "/notifications"
  | "/events"
  | "/scheduler"
  | "/chat"
  | "/studio"
  | "/hub-builder"
  | "/game-ui"
  | "/modpacks"
  | "/missions"
  | "/automation"
  | "/rewards"
  | "/experiments"
  | "/security"
  | "/integrations"
  | "/versions"
  | "/settings";

export const ADMIN_ROUTES: AdminRoute[] = [
  "/",
  "/live-ops",
  "/analytics",
  "/users",
  "/profiles",
  "/launchers",
  "/launcher-access",
  "/notifications",
  "/events",
  "/scheduler",
  "/chat",
  "/studio",
  "/hub-builder",
  "/game-ui",
  "/modpacks",
  "/missions",
  "/automation",
  "/rewards",
  "/experiments",
  "/security",
  "/integrations",
  "/versions",
  "/settings",
];

const ROUTE_SET = new Set<string>(ADMIN_ROUTES);

export function isAdminRoute(path: string): path is AdminRoute {
  return ROUTE_SET.has(path);
}
