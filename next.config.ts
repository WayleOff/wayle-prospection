import type { NextConfig } from "next";

// Cache Components est désactivé : l'application est derrière une connexion et se charge côté navigateur,
// le modèle « tout est dynamique par défaut » est plus simple et plus sûr ici.
const nextConfig: NextConfig = {
  cacheComponents: false,
  partialPrefetching: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
