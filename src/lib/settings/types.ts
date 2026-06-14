export type OAuthMode = "microsoft" | "offline";

export type SystemSettings = {
  api: {
    apiUrl: string;
    wsUrl: string;
    minLauncherVersion: string;
    latestLauncherVersion: string;
  };
  oauth: {
    mode: OAuthMode;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  };
  security: {
    maintenanceMode: boolean;
    maintenanceMessage: string;
    forceUpdate: boolean;
    verifyHwid: boolean;
    anticheatEnabled: boolean;
    launcherAuthEnforced: boolean;
  };
  features: {
    experimentsEnabled: boolean;
    notificationsEnabled: boolean;
    chatEnabled: boolean;
    integrationsEnabled: boolean;
  };
  branding: {
    serverName: string;
    supportUrl: string;
  };
  updatedAt: string;
};

export type PublicLauncherConfig = {
  apiUrl: string;
  wsUrl: string;
  minLauncherVersion: string;
  latestLauncherVersion: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  forceUpdate: boolean;
  oauthMode: OAuthMode;
  serverName: string;
  supportUrl: string;
  features: SystemSettings["features"];
  testerModeEnabled: boolean;
  launcherAuthEnforced: boolean;
};

export type SettingsDashboard = {
  settings: SystemSettingsPublic;
  overview: {
    dbType: string;
    dbPath: string;
    dbSizeKb: number;
    envAuthEnforced: boolean;
    oauthSecretSet: boolean;
    maintenanceActive: boolean;
    integrationsActive: number;
    experimentsRunning: number;
  };
  links: Array<{ id: string; label: string; href: string; description: string }>;
};

export type SystemSettingsPublic = Omit<SystemSettings, "oauth"> & {
  oauth: Omit<SystemSettings["oauth"], "clientSecret"> & {
    clientSecretMasked: string;
    secretConfigured: boolean;
  };
};

export type SettingsPatch = Partial<{
  api: Partial<SystemSettings["api"]>;
  oauth: Partial<SystemSettings["oauth"]>;
  security: Partial<SystemSettings["security"]>;
  features: Partial<SystemSettings["features"]>;
  branding: Partial<SystemSettings["branding"]>;
}>;
