import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Upload de planilha passa por Server Action, que por padrão aceita só 1 MB.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};

export default nextConfig;
