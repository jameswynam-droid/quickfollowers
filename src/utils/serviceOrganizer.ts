export interface OrganizedService {
  id: string;
  name: string;
  originalCategory: string;
  rate: number;
  markedUpRate: number;
  pricePerThousand: string;
  min_order: number;
  max_order: number;
  type: string;
  description?: string;
  provider: string;
}

export interface ServiceCategory {
  category: string;
  services: OrganizedService[];
}

const MARKUP_RATES = {
  standard: 0.10, // 10%
  premium: 0.15, // 15%
};

const isPremiumService = (name: string, category: string): boolean => {
  const premiumKeywords = [
    'nigerian', 'nigeria', '🇳🇬',
    'share', 'shares',
    'save', 'saves',
    'recovery', 'disabled',
    'premium', 'verified', 'bluetick',
    'boost', 'no drop', 'non drop'
  ];
  
  const text = `${name} ${category}`.toLowerCase();
  return premiumKeywords.some(keyword => text.includes(keyword));
};

const calculateMarkup = (rate: number, isPremium: boolean): number => {
  const markup = isPremium ? MARKUP_RATES.premium : MARKUP_RATES.standard;
  return rate * (1 + markup);
};

const getPlatformFromCategory = (category: string, name: string): string => {
  const text = `${category} ${name}`.toLowerCase();
  
  if (text.includes('instagram')) return 'Instagram';
  if (text.includes('tiktok') || text.includes('tik tok')) return 'TikTok';
  if (text.includes('twitter') || text.includes(' x ') || text.includes('(x)')) return 'Twitter / X';
  if (text.includes('youtube')) return 'YouTube';
  if (text.includes('facebook')) return 'Facebook';
  if (text.includes('telegram')) return 'Telegram';
  if (text.includes('spotify')) return 'Spotify';
  if (text.includes('snapchat')) return 'Snapchat';
  if (text.includes('discord')) return 'Discord';
  if (text.includes('whatsapp')) return 'WhatsApp';
  if (text.includes('linkedin')) return 'LinkedIn';
  if (text.includes('threads')) return 'Threads';
  if (text.includes('audiomack')) return 'Audiomack';
  if (text.includes('boomplay')) return 'Boomplay';
  if (text.includes('soundcloud')) return 'SoundCloud';
  if (text.includes('twitch')) return 'Twitch';
  if (text.includes('kick')) return 'Kick';
  if (text.includes('bigo')) return 'Bigo Live';
  
  return 'Other Services';
};

const getSubcategoryFromCategory = (category: string, name: string): string => {
  const text = `${category} ${name}`.toLowerCase();
  
  // Instagram subcategories
  if (text.includes('follower')) {
    if (text.includes('nigeria') || text.includes('🇳🇬')) return 'Followers - Nigerian';
    return 'Followers - Regular';
  }
  if (text.includes('like') && !text.includes('comment')) {
    if (text.includes('auto')) return 'Likes - Auto';
    if (text.includes('nigeria') || text.includes('🇳🇬')) return 'Likes - Nigerian';
    if (text.includes('post')) return 'Likes - Post';
    return 'Likes';
  }
  if (text.includes('view')) {
    if (text.includes('reel')) return 'Views - Reels';
    if (text.includes('video')) return 'Views - Video';
    if (text.includes('story') || text.includes('stories')) return 'Views - Story';
    return 'Views - Posts';
  }
  if (text.includes('save')) return 'Saves';
  if (text.includes('share')) return 'Shares';
  if (text.includes('comment')) {
    if (text.includes('like')) return 'Comment Likes';
    return 'Comments';
  }
  if (text.includes('impression')) return 'Impressions';
  if (text.includes('reach')) return 'Reach';
  if (text.includes('profile') && text.includes('visit')) return 'Profile Visits';
  if (text.includes('story')) return 'Story Views';
  if (text.includes('igtv')) return 'IGTV Views';
  if (text.includes('live')) return 'Live Stream';
  if (text.includes('recovery') || text.includes('disabled')) return 'Account Recovery';
  if (text.includes('verification') || text.includes('verified') || text.includes('bluetick')) return 'Verification';
  
  // TikTok subcategories
  if (text.includes('tiktok') || text.includes('tik tok')) {
    if (text.includes('view')) return 'Views';
    if (text.includes('like')) return 'Likes';
    if (text.includes('share')) return 'Shares';
    if (text.includes('save')) return 'Saves';
    if (text.includes('follower')) return 'Followers';
    if (text.includes('comment')) return 'Comments';
    if (text.includes('live')) return 'Live Stream';
  }
  
  // YouTube subcategories
  if (text.includes('youtube')) {
    if (text.includes('subscriber')) return 'Subscribers';
    if (text.includes('view')) return 'Views';
    if (text.includes('like')) return 'Likes';
    if (text.includes('comment')) return 'Comments';
    if (text.includes('watch') && text.includes('time')) return 'Watch Time';
    if (text.includes('premiere')) return 'Premiere';
    if (text.includes('livestream') || text.includes('live stream')) return 'Live Stream';
    if (text.includes('share')) return 'Shares';
  }
  
  // Twitter/X subcategories
  if (text.includes('twitter') || text.includes(' x ') || text.includes('(x)')) {
    if (text.includes('follower')) return 'Followers';
    if (text.includes('view')) return 'Views';
    if (text.includes('like')) return 'Likes';
    if (text.includes('retweet') || text.includes('repost')) return 'Retweets';
    if (text.includes('comment') || text.includes('reply')) return 'Comments';
    if (text.includes('impression')) return 'Impressions';
  }
  
  // Spotify subcategories
  if (text.includes('spotify')) {
    if (text.includes('play')) return 'Plays';
    if (text.includes('follower')) return 'Followers';
    if (text.includes('save')) return 'Saves';
    if (text.includes('playlist')) return 'Playlist';
  }
  
  return 'Other';
};

export const formatPrice = (price: number): string => {
  return price.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

export const organizeServices = (rawServices: any[]): ServiceCategory[] => {
  // Filter valid services
  const validServices = rawServices.filter(service => {
    // Must have positive rate
    if (!service.rate || service.rate <= 0) return false;
    
    // Must have valid name
    if (!service.name || service.name.trim().length === 0) return false;
    
    // Must have valid min/max
    if (!service.min_order || !service.max_order) return false;
    
    return true;
  });

  // Deduplicate by service name + rate (keep first occurrence)
  const seenServices = new Map<string, boolean>();
  const deduplicatedServices = validServices.filter(service => {
    const key = `${service.name.trim().toLowerCase()}-${service.rate}`;
    if (seenServices.has(key)) {
      return false;
    }
    seenServices.set(key, true);
    return true;
  });

  // Transform services with markup
  const organizedServices: OrganizedService[] = deduplicatedServices.map(service => {
    const isPremium = isPremiumService(service.name, service.category);
    const markedUpRate = calculateMarkup(service.rate, isPremium);
    
    return {
      id: service.id,
      name: service.name,
      originalCategory: service.category,
      rate: service.rate,
      markedUpRate,
      pricePerThousand: `₦${formatPrice(markedUpRate)}`,
      min_order: service.min_order,
      max_order: service.max_order,
      type: service.type,
      description: service.description,
      provider: service.provider || 'owlet',
    };
  });

  // Group by original category
  const categoryMap = new Map<string, OrganizedService[]>();

  organizedServices.forEach(service => {
    if (!categoryMap.has(service.originalCategory)) {
      categoryMap.set(service.originalCategory, []);
    }
    categoryMap.get(service.originalCategory)!.push(service);
  });

  // Convert to array and sort
  const result: ServiceCategory[] = Array.from(categoryMap.entries())
    .map(([category, services]) => ({
      category,
      // Sort services: "Free" services first, then by price (lower = more popular), then by name
      services: services.sort((a, b) => {
        const aIsFree = a.name.toLowerCase().includes('free');
        const bIsFree = b.name.toLowerCase().includes('free');
        
        // Services with "Free" in name first
        if (aIsFree && !bIsFree) return -1;
        if (bIsFree && !aIsFree) return 1;
        
        // Then sort by price (lower price = more popular/accessible)
        if (a.markedUpRate !== b.markedUpRate) {
          return a.markedUpRate - b.markedUpRate;
        }
        
        // Finally by name
        return a.name.localeCompare(b.name);
      })
    }))
    // Sort categories: those with "Free" services first, then alphabetically
    .sort((a, b) => {
      const aHasFree = a.services.some(s => s.name.toLowerCase().includes('free'));
      const bHasFree = b.services.some(s => s.name.toLowerCase().includes('free'));
      
      if (aHasFree && !bHasFree) return -1;
      if (bHasFree && !aHasFree) return 1;
      
      return a.category.localeCompare(b.category);
    });

  return result;
};
