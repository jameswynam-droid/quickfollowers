export interface PlatformLandingData {
  slug: string;
  platform: string;        // "Instagram"
  brandColor: string;      // hex used for accent background
  tagline: string;         // hero subline
  metaTitle: string;       // <title>
  metaDescription: string; // <meta description>
  keywords: string[];
  services: string[];      // bullet list
  benefits: { title: string; body: string }[];
  faqs: { q: string; a: string }[];
}

export const PLATFORM_LANDINGS: Record<string, PlatformLandingData> = {
  instagram: {
    slug: "instagram",
    platform: "Instagram",
    brandColor: "#E1306C",
    tagline: "Cheap Instagram followers, likes, views and reels promotion, delivered fast.",
    metaTitle: "Buy Instagram Followers, Likes & Views, Cheapest SMM Panel",
    metaDescription:
      "QuickFollowers SMM panel: buy real-looking Instagram followers, likes, views, story views and reels promotion at the lowest prices. Instant start, secure checkout.",
    keywords: ["buy instagram followers", "cheap instagram likes", "instagram smm panel", "reels views", "instagram growth panel"],
    services: [
      "Instagram followers (instant & gradual)",
      "Instagram likes, photos & reels",
      "Reels views and impressions",
      "Story views and reach",
      "Comments and saves",
    ],
    benefits: [
      { title: "Lowest market rates", body: "We aggregate top-tier providers so you always pay the cheapest verified price." },
      { title: "Fast delivery", body: "Most Instagram orders start within minutes of payment confirmation." },
      { title: "Drip-feed available", body: "Spread followers over hours or days for a natural growth pattern." },
    ],
    faqs: [
      { q: "Are these followers safe for my Instagram account?", a: "Yes, we use service providers that send accounts that match Instagram's normal traffic patterns. We do not request your password." },
      { q: "How do I order?", a: "Sign up, add funds, pick the Instagram service, paste your profile or post link, choose a quantity and submit." },
      { q: "What if some drop?", a: "Some Instagram services include a refill period. If your order drops below the start count within that window, we apply an automatic refund proportional to the loss." },
    ],
  },
  tiktok: {
    slug: "tiktok",
    platform: "TikTok",
    brandColor: "#010101",
    tagline: "TikTok followers, likes, views and shares, built for creators going viral.",
    metaTitle: "Buy TikTok Followers, Likes & Views, Cheap SMM Panel",
    metaDescription:
      "Boost your TikTok with cheap followers, likes, video views and shares. QuickFollowers SMM panel, instant delivery, global coverage, secure payments.",
    keywords: ["buy tiktok followers", "tiktok likes cheap", "tiktok views smm panel", "tiktok growth", "tiktok promotion"],
    services: [
      "TikTok followers",
      "Video likes",
      "Video views (10K, 100K, 1M+)",
      "Shares and saves",
      "Live stream viewers",
    ],
    benefits: [
      { title: "Built for the algorithm", body: "Views and likes start fast to push your video into the For You page rotation." },
      { title: "Bulk pricing", body: "Order millions of TikTok views at fractions of a cent each." },
      { title: "Works on any link", body: "Just paste the video URL, no login required." },
    ],
    faqs: [
      { q: "Will buying TikTok views ban my account?", a: "No. Views are processed via established providers and look like normal traffic." },
      { q: "How long does delivery take?", a: "Standard TikTok view orders begin within 0-60 minutes." },
      { q: "Do you support TikTok live viewers?", a: "Yes, order live viewers shortly before going live for best results." },
    ],
  },
  youtube: {
    slug: "youtube",
    platform: "YouTube",
    brandColor: "#FF0000",
    tagline: "YouTube views, subscribers, likes and watch time at panel prices.",
    metaTitle: "Buy YouTube Views, Subscribers & Watch Time, SMM Panel",
    metaDescription:
      "Grow your YouTube channel with cheap views, subscribers, likes and watch hours. AdSense-safe traffic from QuickFollowers, the trusted SMM panel.",
    keywords: ["buy youtube views", "youtube subscribers cheap", "youtube watch time", "youtube smm panel", "monetization watch hours"],
    services: [
      "YouTube views (high-retention available)",
      "Subscribers",
      "Likes and dislikes",
      "Watch hours for monetization",
      "Live stream views and concurrents",
    ],
    benefits: [
      { title: "Monetization-friendly", body: "We offer watch-hour packages designed to help you reach the 4,000-hour partner threshold." },
      { title: "High retention", body: "Choose retention-grade views for stronger algorithmic ranking." },
      { title: "Drip delivery", body: "Spread subscribers and views over days for a natural growth curve." },
    ],
    faqs: [
      { q: "Will my video get demonetized?", a: "We use providers known for AdSense-safe traffic. Choose the high-retention services for the safest result." },
      { q: "Can I order before publishing?", a: "Order right after publishing. The link must be public and unlisted-only links are not supported." },
      { q: "What's the minimum order?", a: "Most services start at 100 views or 50 subscribers." },
    ],
  },
  facebook: {
    slug: "facebook",
    platform: "Facebook",
    brandColor: "#1877F2",
    tagline: "Facebook page likes, post engagement and video views, all in one panel.",
    metaTitle: "Buy Facebook Page Likes, Followers & Video Views, SMM Panel",
    metaDescription:
      "Grow your Facebook page with cheap likes, followers, post reactions and video views. QuickFollowers SMM panel, instant delivery, global reach.",
    keywords: ["buy facebook page likes", "facebook followers", "facebook video views", "facebook smm panel", "facebook post reactions"],
    services: [
      "Page likes and follows",
      "Post likes and reactions",
      "Video views",
      "Comments and shares",
      "Live stream viewers",
    ],
    benefits: [
      { title: "Global delivery", body: "Order from any country, we route to the right regional providers." },
      { title: "Page or post", body: "Boost your entire page or a single viral post." },
      { title: "Mixed reactions", body: "Add love, wow and haha reactions for natural-looking engagement." },
    ],
    faqs: [
      { q: "Do you support Facebook Reels?", a: "Yes, Reels views and likes are listed under our Facebook category." },
      { q: "Can I boost a private group?", a: "No, the link must be a public page, post or video." },
      { q: "How fast is delivery?", a: "Most Facebook orders begin within 30 minutes." },
    ],
  },
  twitter: {
    slug: "twitter",
    platform: "Twitter / X",
    brandColor: "#000000",
    tagline: "X (Twitter) followers, likes, retweets and impressions at panel prices.",
    metaTitle: "Buy Twitter / X Followers, Likes & Retweets, SMM Panel",
    metaDescription:
      "Grow your X (Twitter) account with cheap followers, likes, retweets and tweet impressions. QuickFollowers SMM panel, fast and reliable.",
    keywords: ["buy twitter followers", "x followers cheap", "twitter likes panel", "tweet impressions", "twitter smm panel"],
    services: [
      "X (Twitter) followers",
      "Tweet likes",
      "Retweets and quote retweets",
      "Tweet impressions and bookmarks",
      "Spaces listeners",
    ],
    benefits: [
      { title: "Real-feel followers", body: "Profiles with bios, avatars and tweet history available." },
      { title: "Tweet boosting", body: "Push a single tweet with combined likes, retweets and impressions." },
      { title: "Fast and cheap", body: "Among the lowest X (Twitter) panel prices anywhere." },
    ],
    faqs: [
      { q: "Will my account get suspended?", a: "We use established providers that mimic normal X engagement patterns. We never need your password." },
      { q: "How do I order tweet impressions?", a: "Paste the tweet URL, not your profile, and choose a quantity." },
      { q: "Are blue check followers available?", a: "We offer mixed-quality followers; some include verified-style profiles depending on the package." },
    ],
  },
  telegram: {
    slug: "telegram",
    platform: "Telegram",
    brandColor: "#229ED9",
    tagline: "Telegram channel members, post views and reactions, instant delivery.",
    metaTitle: "Buy Telegram Members, Post Views & Reactions, SMM Panel",
    metaDescription:
      "Grow your Telegram channel or group with cheap members, post views and reactions. QuickFollowers SMM panel, instant start, no login required.",
    keywords: ["buy telegram members", "telegram channel members", "telegram post views", "telegram smm panel", "telegram subscribers"],
    services: [
      "Channel and group members",
      "Post views (last 5/10/20 posts)",
      "Reactions (👍 ❤️ 🔥 etc.)",
      "Poll votes",
      "Auto-views for new posts",
    ],
    benefits: [
      { title: "Channel or group", body: "Works for both public channels and groups." },
      { title: "Auto post views", body: "Subscribe new posts to automatic view boosts." },
      { title: "Cheap reactions", body: "Add reactions in any emoji combination." },
    ],
    faqs: [
      { q: "Do members leave?", a: "Telegram natural drop is around 5-15%. We offer refill packages on most member services." },
      { q: "Can I order for a private channel?", a: "The channel must be public or have a join link we can subscribe to." },
      { q: "How fast?", a: "Members start within minutes; views are usually instant." },
    ],
  },
  spotify: {
    slug: "spotify",
    platform: "Spotify",
    brandColor: "#1DB954",
    tagline: "Spotify plays, monthly listeners, followers and saves for artists & playlists.",
    metaTitle: "Buy Spotify Plays, Followers & Monthly Listeners, SMM Panel",
    metaDescription:
      "Grow as a Spotify artist with cheap plays, monthly listeners, followers and playlist saves. Royalty-eligible streams from QuickFollowers SMM panel.",
    keywords: ["buy spotify plays", "spotify monthly listeners", "spotify followers", "spotify smm panel", "playlist promotion"],
    services: [
      "Track plays (royalty-eligible)",
      "Monthly listeners",
      "Artist and playlist followers",
      "Track and album saves",
      "Playlist placement",
    ],
    benefits: [
      { title: "Royalty-eligible plays", body: "Plays are streamed for the minimum required duration so they count toward royalties." },
      { title: "Geo-targeted listeners", body: "Pick US, UK, EU or worldwide depending on the package." },
      { title: "For artists & curators", body: "Boost a single track, an entire album or your own playlists." },
    ],
    faqs: [
      { q: "Is this allowed by Spotify?", a: "We use long-running, established providers. Buying plays is at your own risk; choose the slow drip packages for maximum safety." },
      { q: "How long until plays show?", a: "Spotify counters update every 24 hours, so plays appear in your dashboard the next day." },
      { q: "Do you support podcasts?", a: "Yes, podcast plays and follows are available under the Spotify category." },
    ],
  },
};

export const PLATFORM_SLUGS = Object.keys(PLATFORM_LANDINGS);
