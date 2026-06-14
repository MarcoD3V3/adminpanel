import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["better-sqlite3"],
  async redirects() {
    return [{ source: "/hub_builder", destination: "/hub-builder", permanent: true }];
  },
  experimental: {
    // Sin @craftlauncher/shared: el barrel local pierde exports con optimizePackageImports.
    optimizePackageImports: ["lucide-react", "date-fns"],
    staleTimes: {
      dynamic: 60,
      static: 300,
    },
  },
  webpack: (config, { dev }) => {
    // En Windows la caché en disco de webpack suele fallar (EPERM/ENOENT) con rutas con espacios
    if (dev && process.platform === "win32") {
      config.cache = { type: "memory" };
    }
    return config;
  },
};

export default nextConfig;
