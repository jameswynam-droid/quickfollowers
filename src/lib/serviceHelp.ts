// Maps a service to a help-center article slug based on name/category keywords.
// Only returns a slug for topics where a matching /help article exists.
export interface HelpMatch { slug: string; label: string; }

const RULES: Array<{ match: RegExp; slug: string; label: string }> = [
  // Auto services
  { match: /tiktok.*auto\s*(like|view|follower)|auto\s*(like|view|follower).*tiktok/i, slug: "tiktok-auto-services-explained", label: "How TikTok auto services work" },
  { match: /instagram.*auto\s*(like|view|follower)|auto\s*(like|view|follower).*instagram/i, slug: "instagram-auto-services-explained", label: "How Instagram auto services work" },
  // Drip-feed
  { match: /drip[-\s]?feed/i, slug: "what-is-drip-feed", label: "What is drip-feed?" },
  // Platform link guides (also matched by category)
  { match: /instagram/i, slug: "how-to-find-instagram-link", label: "How to find your Instagram link" },
  { match: /tiktok/i, slug: "how-to-find-tiktok-link", label: "How to find your TikTok link" },
  { match: /youtube/i, slug: "how-to-find-youtube-link", label: "How to find your YouTube link" },
  { match: /telegram/i, slug: "how-telegram-services-work", label: "How Telegram services work" },
  { match: /twitter|^x\s|\sx\s/i, slug: "how-to-find-x-twitter-link", label: "How to find your X (Twitter) link" },
];

export function getServiceHelp(service: { name?: string | null; category?: string | null; description?: string | null }): HelpMatch | null {
  const blob = `${service.category || ""} ${service.name || ""}`;
  for (const r of RULES) {
    if (r.match.test(blob)) return { slug: r.slug, label: r.label };
  }
  return null;
}
