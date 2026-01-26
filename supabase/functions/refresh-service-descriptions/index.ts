import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type PlatformKey =
  | 'instagram'
  | 'tiktok'
  | 'facebook'
  | 'youtube'
  | 'twitter'
  | 'spotify'
  | 'telegram'
  | 'linkedin'
  | 'pinterest'
  | 'snapchat'
  | 'twitch'
  | 'discord'
  | 'soundcloud'
  | 'threads'
  | 'whatsapp'
  | 'boomplay'
  | 'audiomack';

const platforms: Record<PlatformKey, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  youtube: 'YouTube',
  twitter: 'Twitter/X',
  spotify: 'Spotify',
  telegram: 'Telegram',
  linkedin: 'LinkedIn',
  pinterest: 'Pinterest',
  snapchat: 'Snapchat',
  twitch: 'Twitch',
  discord: 'Discord',
  soundcloud: 'SoundCloud',
  threads: 'Threads',
  whatsapp: 'WhatsApp',
  boomplay: 'Boomplay',
  audiomack: 'Audiomack',
};

const platformValues = new Set(Object.values(platforms));

function getMatchingPlatforms(text: string): string[] {
  const lower = text.toLowerCase();
  const matches: string[] = [];
  for (const [key, value] of Object.entries(platforms)) {
    const wholeWord = new RegExp(`\\b${key}\\b`, 'i');
    if (wholeWord.test(lower) || lower.includes(key)) matches.push(value);
  }
  return Array.from(new Set(matches));
}

function generateFallbackDescription(params: {
  name: string;
  category: string;
  min: number;
  max: number;
}): string {
  const nameLower = params.name.toLowerCase();
  const categoryLower = params.category.toLowerCase();

  // Platform detection: prioritize service name; categories can include multiple platforms.
  const platformFromName = getMatchingPlatforms(nameLower)[0] || '';
  const categoryPlatforms = getMatchingPlatforms(categoryLower);
  const platformFromCategory = categoryPlatforms.length === 1 ? categoryPlatforms[0] : '';
  const platform = platformFromName || platformFromCategory;

  // Service type detection
  const serviceTypes: { key: string; value: string }[] = [
    { key: 'followers', value: 'Increase your follower count with high-quality followers.' },
    { key: 'likes', value: 'Boost engagement with authentic likes on your content.' },
    { key: 'views', value: 'Increase visibility with real views on your content.' },
    { key: 'comments', value: 'Enhance engagement with relevant comments.' },
    { key: 'shares', value: 'Expand your reach with shares and reposts.' },
    { key: 'subscribers', value: 'Grow your subscriber base organically.' },
    { key: 'plays', value: 'Increase play count for your tracks or videos.' },
    { key: 'saves', value: 'Boost saves to improve algorithm ranking.' },
    { key: 'impressions', value: 'Increase impressions for better visibility.' },
    { key: 'reach', value: 'Expand your content reach to new audiences.' },
    { key: 'members', value: 'Grow your group or channel membership.' },
    { key: 'reactions', value: 'Get more reactions on your posts.' },
    { key: 'reposts', value: 'Increase reposts for wider distribution.' },
    { key: 'favorites', value: 'Get more favorites on your content.' },
  ];

  const serviceType = serviceTypes.find((t) => nameLower.includes(t.key))?.value ?? '';

  let description = '';
  if (platform && serviceType) {
    description = `${platform} service. ${serviceType}`;
  } else if (serviceType) {
    description = serviceType;
  } else if (platform) {
    description = `${platform} growth service.`;
  } else {
    description = 'Social media marketing service.';
  }

  // Quality indicators (targeted fixes: refill + instant)
  const qualityIndicators: string[] = [];
  if (nameLower.includes('hq') || nameLower.includes('high quality')) qualityIndicators.push('High Quality');
  if (nameLower.includes('real')) qualityIndicators.push('Real Users');
  if (nameLower.includes('premium')) qualityIndicators.push('Premium');
  if (nameLower.includes('instant')) qualityIndicators.push('Instant Start');
  if (nameLower.includes('fast')) qualityIndicators.push('Fast Delivery');
  if (nameLower.includes('lifetime') || nameLower.includes('non drop')) qualityIndicators.push('Lifetime Guarantee');

  if (nameLower.includes('refill: no') || nameLower.includes('no refill')) {
    qualityIndicators.push('No Refill');
  } else if (nameLower.includes('refill')) {
    qualityIndicators.push('Refill Included');
  }

  if (qualityIndicators.length > 0) {
    description += ` ${qualityIndicators.slice(0, 3).join(' • ')}.`;
  }

  description += ` Order range: ${params.min} - ${params.max}.`;
  return description;
}

function shouldRegenerate(description: string | null): boolean {
  if (!description) return false;

  // Only touch short, auto-generated "<Platform> service... Order range: ..." descriptions.
  // Avoid overwriting curated/provider multi-line instructions.
  const firstWord = description.split(' ')[0]?.replace('.', '') ?? '';
  if (!platformValues.has(firstWord)) return false;
  if (!description.includes('Order range:')) return false;
  if (description.includes('\n')) return false;
  return true;
}

function platformMismatch(name: string, description: string): boolean {
  const namePlatforms = getMatchingPlatforms(name.toLowerCase());
  if (namePlatforms.length === 0) return false;
  const describedPlatform = description.split(' ')[0]?.replace('.', '') ?? '';
  // If description platform isn't one of the name platforms, it's wrong.
  return !namePlatforms.includes(describedPlatform);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Server not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const authed = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: userData, error: userError } = await authed.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: isAdmin, error: roleError } = await authed.rpc('has_role', {
      _user_id: userData.user.id,
      _role: 'admin',
    });

    if (roleError || !isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    let scanned = 0;
    let updated = 0;
    const pageSize = 1000;

    for (let page = 0; page < 25; page++) {
      const from = page * pageSize;
      const to = from + pageSize - 1;

      const { data: rows, error } = await admin
        .from('services')
        .select('id, name, category, min_order, max_order, description')
        .order('id', { ascending: true })
        .range(from, to);

      if (error) throw error;
      if (!rows || rows.length === 0) break;

      scanned += rows.length;

      for (const row of rows) {
        if (!shouldRegenerate(row.description)) continue;
        if (!platformMismatch(row.name, row.description!)) continue;

        const newDesc = generateFallbackDescription({
          name: row.name,
          category: row.category,
          min: row.min_order,
          max: row.max_order,
        });

        if (newDesc === row.description) continue;

        const { error: updateError } = await admin
          .from('services')
          .update({ description: newDesc })
          .eq('id', row.id);

        if (updateError) throw updateError;
        updated++;
      }
    }

    return new Response(JSON.stringify({ success: true, scanned, updated }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('refresh-service-descriptions error:', e);
    return new Response(JSON.stringify({ error: 'Failed to refresh descriptions' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
