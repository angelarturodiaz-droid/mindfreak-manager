import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El límite propio de Server Actions es 1MB por defecto. La subida de
  // documentos (F17) valida hasta 15MB en la aplicación, así que el límite
  // de Next.js debe ser al menos igual — se deja con margen en 16MB.
  experimental: {
    serverActions: {
      bodySizeLimit: "16mb",
    },
  },
};

export default nextConfig;
