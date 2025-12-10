import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SMMService {
  service: number;
  name: string;
  type: string;
  category: string;
  rate: string;
  min: string;
  max: string;
  dripfeed?: boolean;
  refill?: boolean;
  cancel?: boolean;
}

interface Provider {
  name: string;
  url: string;
  apiKey: string;
}

// Generate meaningful descriptions based on service name and category
function generateDescription(name: string, category: string, min: string, max: string): string {
  const nameLower = name.toLowerCase();
  const categoryLower = category.toLowerCase();
  
  let description = '';
  
  // Platform detection
  const platforms: { [key: string]: string } = {
    'instagram': 'Instagram',
    'tiktok': 'TikTok',
    'facebook': 'Facebook',
    'youtube': 'YouTube',
    'twitter': 'Twitter/X',
    'spotify': 'Spotify',
    'telegram': 'Telegram',
    'linkedin': 'LinkedIn',
    'pinterest': 'Pinterest',
    'snapchat': 'Snapchat',
    'twitch': 'Twitch',
    'discord': 'Discord',
    'soundcloud': 'SoundCloud',
    'threads': 'Threads',
  };
  
  let platform = '';
  for (const [key, value] of Object.entries(platforms)) {
    if (nameLower.includes(key) || categoryLower.includes(key)) {
      platform = value;
      break;
    }
  }
  
  // Service type detection
  const serviceTypes: { [key: string]: string } = {
    'followers': 'Increase your follower count with high-quality followers.',
    'likes': 'Boost engagement with authentic likes on your content.',
    'views': 'Increase visibility with real views on your content.',
    'comments': 'Enhance engagement with relevant comments.',
    'shares': 'Expand your reach with shares and reposts.',
    'subscribers': 'Grow your subscriber base organically.',
    'plays': 'Increase play count for your tracks or videos.',
    'saves': 'Boost saves to improve algorithm ranking.',
    'impressions': 'Increase impressions for better visibility.',
    'reach': 'Expand your content reach to new audiences.',
    'members': 'Grow your group or channel membership.',
    'reactions': 'Get more reactions on your posts.',
    'reposts': 'Increase reposts for wider distribution.',
    'story views': 'Boost story engagement with more views.',
    'live viewers': 'Get more live stream viewers.',
    'dm': 'Direct message marketing service.',
    'poll votes': 'Increase votes on your polls.',
    'review': 'Get reviews for your business or product.',
  };
  
  let serviceType = '';
  for (const [key, value] of Object.entries(serviceTypes)) {
    if (nameLower.includes(key)) {
      serviceType = value;
      break;
    }
  }
  
  // Quality indicators
  const qualityIndicators: string[] = [];
  if (nameLower.includes('hq') || nameLower.includes('high quality')) qualityIndicators.push('High Quality');
  if (nameLower.includes('real')) qualityIndicators.push('Real Users');
  if (nameLower.includes('premium')) qualityIndicators.push('Premium');
  if (nameLower.includes('instant')) qualityIndicators.push('Instant Start');
  if (nameLower.includes('fast')) qualityIndicators.push('Fast Delivery');
  if (nameLower.includes('lifetime') || nameLower.includes('non drop')) qualityIndicators.push('Lifetime Guarantee');
  if (nameLower.includes('refill')) qualityIndicators.push('Refill Included');
  if (nameLower.includes('no drop')) qualityIndicators.push('No Drop');
  if (nameLower.includes('organic')) qualityIndicators.push('Organic Growth');
  if (nameLower.includes('active')) qualityIndicators.push('Active Users');
  
  // Country detection
  const countries: { [key: string]: string } = {
    'usa': 'USA',
    'uk': 'UK',
    'nigeria': 'Nigeria',
    'nigerian': 'Nigeria',
    'worldwide': 'Worldwide',
    'global': 'Global',
    'brazil': 'Brazil',
    'india': 'India',
    'arab': 'Arab Region',
    'turkey': 'Turkey',
    'germany': 'Germany',
    'france': 'France',
    'canada': 'Canada',
    'australia': 'Australia',
    'russia': 'Russia',
    'spain': 'Spain',
    'italy': 'Italy',
    'mexico': 'Mexico',
    'indonesia': 'Indonesia',
    'japan': 'Japan',
    'korea': 'Korea',
  };
  
  let country = '';
  for (const [key, value] of Object.entries(countries)) {
    if (nameLower.includes(key)) {
      country = value;
      break;
    }
  }
  
  // Build description
  if (platform && serviceType) {
    description = `${platform} service. ${serviceType}`;
  } else if (serviceType) {
    description = serviceType;
  } else if (platform) {
    description = `${platform} growth service.`;
  } else {
    description = 'Social media marketing service.';
  }
  
  // Add quality indicators
  if (qualityIndicators.length > 0) {
    description += ` ${qualityIndicators.slice(0, 3).join(' • ')}.`;
  }
  
  // Add country targeting
  if (country) {
    description += ` Targeted: ${country}.`;
  }
  
  // Add order limits
  description += ` Order range: ${min} - ${max}.`;
  
  return description;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Define providers
    const providers: Provider[] = [
      {
        name: 'owlet',
        url: 'https://therealowlet.com/api/v2',
        apiKey: Deno.env.get('OWLET_API_KEY') || '',
      },
      {
        name: 'followspanel',
        url: 'https://followspanel.com/api/v2',
        apiKey: Deno.env.get('FOLLOWSPANEL_API_KEY') || '',
      },
    ];

    // Validate API keys
    for (const provider of providers) {
      if (!provider.apiKey) {
        console.error(`${provider.name} API key not configured`);
      }
    }

    let allServicesData: any[] = [];
    const providerResults: { [key: string]: number } = {};

    // Fetch services from each provider with retries
    for (const provider of providers) {
      if (!provider.apiKey) {
        console.log(`Skipping ${provider.name} - no API key`);
        providerResults[provider.name] = 0;
        continue;
      }

      console.log(`Fetching services from ${provider.name}...`);
      
      let services: SMMService[] = [];
      let retries = 3;
      
      while (retries > 0) {
        try {
          const response = await fetch(provider.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              key: provider.apiKey,
              action: 'services',
            }),
          });

          if (!response.ok) {
            console.error(`${provider.name} API request failed: ${response.statusText}`);
            retries--;
            if (retries > 0) {
              console.log(`Retrying ${provider.name}... (${retries} attempts left)`);
              await new Promise(r => setTimeout(r, 1000));
              continue;
            }
            break;
          }

          services = await response.json() as SMMService[];
          console.log(`Fetched ${services.length} services from ${provider.name}`);
          break;
        } catch (error) {
          console.error(`Error fetching from ${provider.name}:`, error);
          retries--;
          if (retries > 0) {
            console.log(`Retrying ${provider.name}... (${retries} attempts left)`);
            await new Promise(r => setTimeout(r, 1000));
          }
        }
      }

      providerResults[provider.name] = services.length;

      // Transform services with provider info
      const providerServicesData = services.map((service) => {
        let rate = parseFloat(service.rate);
        if (rate > 1000000) {
          rate = rate / 100;
        }
        
        return {
          id: `${provider.name}-${service.service}`,
          name: service.name,
          type: service.type,
          category: service.category,
          rate: rate,
          min_order: parseInt(service.min),
          max_order: parseInt(service.max),
          description: generateDescription(service.name, service.category, service.min, service.max),
          provider: provider.name,
        };
      });

      allServicesData = allServicesData.concat(providerServicesData);
    }

    // Don't proceed with deletion if we got significantly fewer services than expected
    if (allServicesData.length === 0) {
      throw new Error('No services fetched from any provider');
    }

    console.log(`Total services fetched: ${allServicesData.length}`);
    console.log(`Provider breakdown:`, providerResults);

    // Create a Set of current service IDs for fast lookup
    const currentServiceIds = new Set(allServicesData.map(s => s.id));

    // Get ALL existing service IDs from database (handle pagination)
    let existingServiceIds: string[] = [];
    let hasMore = true;
    let offset = 0;
    const pageSize = 1000;

    while (hasMore) {
      const { data: existingServices, error: fetchError } = await supabaseClient
        .from('services')
        .select('id')
        .range(offset, offset + pageSize - 1);

      if (fetchError) {
        console.error('Error fetching existing services:', fetchError);
        throw fetchError;
      }

      if (existingServices && existingServices.length > 0) {
        existingServiceIds = existingServiceIds.concat(existingServices.map(s => s.id));
        offset += pageSize;
        hasMore = existingServices.length === pageSize;
      } else {
        hasMore = false;
      }
    }
    
    console.log(`Existing services in database: ${existingServiceIds.length}`);

    // Find services to delete (exist in DB but not in current fetch)
    const servicesToDelete = existingServiceIds.filter(id => !currentServiceIds.has(id));
    console.log(`Services to potentially delete: ${servicesToDelete.length}`);

    // Safety check: Don't delete more than 20% of existing services in one sync
    const maxDeletePercentage = 0.2;
    const maxDeletions = Math.floor(existingServiceIds.length * maxDeletePercentage);
    
    let deletedCount = 0;
    const skippedDeletions: string[] = [];

    if (servicesToDelete.length > maxDeletions && existingServiceIds.length > 100) {
      console.warn(`WARNING: Attempting to delete ${servicesToDelete.length} services (>${maxDeletePercentage * 100}% of ${existingServiceIds.length}). Limiting to ${maxDeletions} deletions for safety.`);
      
      for (const serviceId of servicesToDelete.slice(0, maxDeletions)) {
        const { error: delError } = await supabaseClient
          .from('services')
          .delete()
          .eq('id', serviceId);
        
        if (delError) {
          if (delError.code === '23503') {
            console.log(`Skipping delete for ${serviceId} - referenced by orders`);
            skippedDeletions.push(serviceId);
          } else {
            console.error(`Error deleting service ${serviceId}:`, delError);
          }
        } else {
          deletedCount++;
        }
      }
    } else {
      for (const serviceId of servicesToDelete) {
        const { error: delError } = await supabaseClient
          .from('services')
          .delete()
          .eq('id', serviceId);
        
        if (delError) {
          if (delError.code === '23503') {
            console.log(`Skipping delete for ${serviceId} - referenced by orders`);
            skippedDeletions.push(serviceId);
          } else {
            console.error(`Error deleting service ${serviceId}:`, delError);
          }
        } else {
          deletedCount++;
        }
      }
    }
    
    console.log(`Successfully deleted ${deletedCount} orphaned services`);
    if (skippedDeletions.length > 0) {
      console.log(`Skipped ${skippedDeletions.length} services due to foreign key constraints`);
    }

    // Upsert all current services
    const batchSize = 100;
    let successCount = 0;
    
    for (let i = 0; i < allServicesData.length; i += batchSize) {
      const batch = allServicesData.slice(i, i + batchSize);
      const { error } = await supabaseClient
        .from('services')
        .upsert(batch, { onConflict: 'id' });

      if (error) {
        console.error('Error upserting batch:', error);
        throw error;
      }
      successCount += batch.length;
    }

    console.log(`Services synced successfully. Upserted ${successCount}, deleted ${deletedCount} services.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        count: allServicesData.length,
        deleted: deletedCount,
        skippedDeletions: skippedDeletions.length,
        providerResults,
        message: 'Services synced successfully from all providers'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('Error syncing services:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
});
