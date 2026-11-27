import type { NextConfig } from "next";

// Cache Components est désactivé : l'application est derrière une connexion et se charge côté navigateur,
// le modèle « tout est dynamique par défaut » est plus simple et plus sûr ici.
// En-têtes de sécurité sur toutes les pages. La CSP ne limite volontairement pas les scripts ni les styles
// (Next.js en injecte en ligne) : elle ferme les portes les plus courantes (page placée dans le cadre d'un autre
// site, <base> détourné, <object>, formulaire envoyé ailleurs). HSTS est posé par Vercel sur le domaine.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Content-Security-Policy", value: "object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
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
