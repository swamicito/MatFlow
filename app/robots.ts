import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mat-flow.net";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/embed/"],
        disallow: [
          "/api/",
          "/admin/",
          "/auth/",
          "/onboarding",
          "/onboarding/",
          "/frontdesk",
          "/frontdesk/",
          "/portal/",
          "/dashboard",
          "/schedule",
          "/leads",
          "/students",
          "/reports",
          "/messages",
          "/billing",
          "/settings",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
