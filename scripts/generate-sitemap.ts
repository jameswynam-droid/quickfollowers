// Runs before `vite dev` and `vite build` via predev/prebuild hooks.
// Writes public/sitemap.xml with static routes + all published blog posts.

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config();

const BASE_URL = "https://quickfollowers.online";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

const today = new Date().toISOString().slice(0, 10);

const staticEntries: SitemapEntry[] = [
  { path: "/", lastmod: today, changefreq: "weekly", priority: "1.0" },
  { path: "/terms", lastmod: today, changefreq: "yearly", priority: "0.3" },
  { path: "/privacy", lastmod: today, changefreq: "yearly", priority: "0.3" },
  { path: "/help", lastmod: today, changefreq: "weekly", priority: "0.7" },
  ...["instagram", "tiktok", "youtube", "facebook", "twitter", "telegram", "spotify"].map(
    (p) => ({ path: `/buy/${p}`, lastmod: today, changefreq: "weekly" as const, priority: "0.9" }),
  ),
];

async function fetchBlogPosts(): Promise<SitemapEntry[]> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.warn("[sitemap] Supabase env missing — skipping blog posts.");
    return [];
  }
  try {
    const supabase = createClient(url, key);
    const { data, error } = await supabase
      .from("blog_posts")
      .select("slug, published_at, updated_at")
      .eq("published", true);
    if (error) {
      console.warn(`[sitemap] blog_posts query failed: ${error.message}`);
      return [];
    }
    return (data || []).map((r: any) => ({
      path: `/help/${r.slug}`,
      lastmod: (r.updated_at || r.published_at || today).slice(0, 10),
      changefreq: "monthly" as const,
      priority: "0.6",
    }));
  } catch (e: any) {
    console.warn(`[sitemap] blog fetch failed: ${e?.message || e}`);
    return [];
  }
}

function toXml(entries: SitemapEntry[]) {
  const urls = entries.map((e) =>
    [
      `  <url>`,
      `    <loc>${BASE_URL}${e.path}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ].filter(Boolean).join("\n"),
  );
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
    ``,
  ].join("\n");
}

(async () => {
  const blogEntries = await fetchBlogPosts();
  const entries = [...staticEntries, ...blogEntries];
  writeFileSync(resolve("public/sitemap.xml"), toXml(entries));
  console.log(`[sitemap] wrote ${entries.length} entries (${blogEntries.length} blog posts).`);
})();
