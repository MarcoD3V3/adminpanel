import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [{ source: "/hub_builder", destination: "/hub-builder", permanent: true }];
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns", "@craftlauncher/shared"],
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
