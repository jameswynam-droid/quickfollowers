import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { Resend } from 'https://esm.sh/resend@4.0.0';

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

interface SyncResult {
  success: boolean;
  count: number;
  deleted: number;
  providerResults: { [key: string]: number };
  warnings: string[];
  errors: string[];
}

// Send email notification for sync issues
async function sendSyncNotification(subject: string, content: string, isError: boolean = false) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const adminEmail = 'admin@quickfollowers.online';
  
  if (!resendApiKey) {
    console.warn('Email notifications not configured - missing RESEND_API_KEY');
    return;
  }
  
  try {
    const resend = new Resend(resendApiKey);
    const timestamp = new Date().toISOString();
    
    await resend.emails.send({
      from: 'QuickFollowers Alerts <no-reply@quickfollowers.online>',
      to: [adminEmail],
      subject: `[QuickFollowers] ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: ${isError ? '#ef4444' : '#f59e0b'}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">${isError ? '⚠️ Sync Error' : '📊 Sync Alert'}</h1>
          </div>
          <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="color: #374151; line-height: 1.6;">${content}</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #6b7280; font-size: 12px;">Timestamp: ${timestamp}</p>
            <p style="color: #6b7280; font-size: 12px;">This is an automated notification from QuickFollowers service sync.</p>
          </div>
        </div>
      `,
    });
    
    console.log(`Email notification sent to ${adminEmail}: ${subject}`);
  } catch (error) {
    console.error('Failed to send email notification:', error);
  }
}

// Generate meaningful and instructional descriptions based on service name and category
function generateDescription(name: string, category: string, min: string, max: string): string {
  const nameLower = name.toLowerCase();
  const categoryLower = category.toLowerCase();
  
  // Check for Traffic/Keyword services - these need detailed instructions
  if ((nameLower.includes('traffic') || categoryLower.includes('traffic')) && 
      (nameLower.includes('keyword') || nameLower.includes('organic') || nameLower.includes('google') || nameLower.includes('search'))) {
    return `💡 Use a bit.ly link to track traffic
💡 Keyword can be added in any language

✅ Organic Keyword Traffic from Search Engines
✅ Add Your Own Custom Keyword (See below how to add it)
✅ 100% Real & Unique Visitors
✅ Google Analytics Supported

⏱ Session Length: 40-60 Seconds per visit
📉 Bounce Rates: Low
⚡ Speed: 10,000 unique visitors per day
⏳ Start Time: 0-12h (we check all links for compliance)

🖥 Desktop Traffic Over 90%
📱 Mobile Traffic Under 10%

⚠️ No Adult, Drug or offensive websites allowed

📝 URL and KEYWORD Format:
Add your URL and keyword in to the link field with a separator. For example:
https://www.domain.com:keyword
or
http://bit.ly/xyz:keyword longtail

1 (ONE) keyword per order. To use multiple keywords create another order for the same URL using a different keyword.`;
  }
  
  // Regular traffic services without keywords
  if (nameLower.includes('traffic') || categoryLower.includes('traffic')) {
    return `✅ Real Website Traffic Visitors
✅ 100% Unique Visitors
✅ Google Analytics Supported

⏱ Session Length: 30-60 Seconds per visit
📉 Bounce Rates: Low
⚡ Speed: Up to 10,000 visitors per day
⏳ Start Time: 0-12 hours

🖥 Desktop Traffic Over 90%
📱 Mobile Traffic Under 10%

⚠️ No Adult, Drug or offensive websites allowed

📝 Enter your website URL in the link field.`;
  }
  
  // Custom comments services
  if (nameLower.includes('custom comment') || (nameLower.includes('comment') && nameLower.includes('custom'))) {
    return `📝 Custom Comments Service

✅ Write your own custom comments
✅ Real-looking engagement
✅ Natural delivery speed

📝 Format:
Enter your comments separated by new lines. Each line = one comment.

Example:
Great post! Love this content 🔥
This is amazing work!
Keep it up! 👏

⚠️ No offensive, spam or inappropriate comments allowed.`;
  }
  
  // Telegram services
  if (nameLower.includes('telegram') || categoryLower.includes('telegram')) {
    if (nameLower.includes('member')) {
      return `📱 Telegram Members Service

✅ Real Telegram Members
✅ Fast Delivery
✅ No Password Required

📝 Format:
Enter your Telegram group/channel link.
Example: https://t.me/yourchannel

⚠️ Make sure your group/channel is public.`;
    }
    if (nameLower.includes('view') || nameLower.includes('post')) {
      return `👁 Telegram Views Service

✅ Real Telegram Views
✅ Fast Delivery
✅ Works on all public posts

📝 Format:
Enter your Telegram post link.
Example: https://t.me/yourchannel/123

⚠️ Post must be public and visible.`;
    }
  }
  
  // DM/Direct Message services
  if (nameLower.includes(' dm ') || nameLower.includes('direct message') || nameLower.includes('dm service')) {
    return `📩 Direct Message (DM) Service

✅ Reach users directly via DM
✅ Custom message content
✅ Targeted audience

📝 Format:
Provide target username/URL and your message.

⚠️ No spam, offensive or promotional content that violates platform terms.`;
  }
  
  // Mention/Tag services
  if (nameLower.includes('mention') || nameLower.includes('tag')) {
    return `🏷 Mention/Tag Service

✅ Get mentioned or tagged in posts
✅ Increase visibility and engagement
✅ Real accounts

📝 Format:
Enter the post URL where you want mentions/tags.

⚠️ Content must be public and comply with platform guidelines.`;
  }
  
  // Poll vote services
  if (nameLower.includes('poll') || nameLower.includes('vote')) {
    return `🗳 Poll Vote Service

✅ Get votes on your polls
✅ Fast delivery
✅ Real engagement

📝 Format:
Enter the poll URL and specify which option to vote for.
Example: https://platform.com/poll/123 | Option 1

⚠️ Poll must be public and accessible.`;
  }
  
  // Review services
  if (nameLower.includes('review')) {
    return `⭐ Review Service

✅ Get authentic-looking reviews
✅ Custom review text (if applicable)
✅ Boost your reputation

📝 Format:
Enter your business/product page URL.

⚠️ Content must comply with platform guidelines. No fake or misleading information.`;
  }
  
  // Live/Stream services
  if (nameLower.includes('live') || nameLower.includes('stream') || nameLower.includes('viewer')) {
    return `🔴 Live Stream Viewers Service

✅ Real-time live viewers
✅ Boost your live stream engagement
✅ Works on most platforms

📝 Format:
Enter your live stream URL when you go live.

⚠️ Stream must be public and active when order is placed.`;
  }
  
  // Story views
  if (nameLower.includes('story') && nameLower.includes('view')) {
    return `👁 Story Views Service

✅ Increase your story visibility
✅ Fast delivery
✅ Real engagement

📝 Format:
Enter your profile URL. Make sure your stories are public.

⚠️ Stories must be visible to everyone.`;
  }
  
  // Default description for other services
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

// Clean service names by removing provider references
function cleanServiceName(name: string): string {
  // Remove provider names from service names
  return name
    .replace(/\bOwlet\b/gi, 'QuickFollowers')
    .replace(/\bFollowspanel\b/gi, 'QuickFollowers')
    .replace(/\bOwlet's\b/gi, "QuickFollowers'")
    .replace(/\bFollowspanel's\b/gi, "QuickFollowers'");
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

    // Fetch services from each provider with retries and delays to avoid rate limiting
    for (const provider of providers) {
      if (!provider.apiKey) {
        console.log(`Skipping ${provider.name} - no API key`);
        providerResults[provider.name] = 0;
        continue;
      }

      console.log(`Fetching services from ${provider.name}...`);
      
      let services: SMMService[] = [];
      let retries = 5; // Increased retries
      let lastError = '';
      
      while (retries > 0) {
        try {
          // Add delay between retries to avoid rate limiting
          if (retries < 5) {
            const delay = (5 - retries) * 2000; // 2s, 4s, 6s, 8s delays
            console.log(`Waiting ${delay}ms before retry...`);
            await new Promise(r => setTimeout(r, delay));
          }

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

          const response = await fetch(provider.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              key: provider.apiKey,
              action: 'services',
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            lastError = `API request failed: ${response.status} ${response.statusText}`;
            console.error(`${provider.name} ${lastError}`);
            retries--;
            continue;
          }

          const responseData = await response.json();
          
          // Check if response is an error object
          if (responseData && typeof responseData === 'object' && 'error' in responseData) {
            lastError = `API returned error: ${responseData.error}`;
            console.error(`${provider.name} ${lastError}`);
            retries--;
            continue;
          }
          
          // Validate that we got an array of services
          if (!Array.isArray(responseData)) {
            lastError = `Unexpected response format: ${typeof responseData}`;
            console.error(`${provider.name} ${lastError}`);
            retries--;
            continue;
          }
          
          // Validate minimum service count to detect incomplete responses
          if (responseData.length < 10) {
            lastError = `Suspiciously low service count: ${responseData.length}`;
            console.warn(`${provider.name} ${lastError}`);
            retries--;
            continue;
          }
          
          services = responseData as SMMService[];
          console.log(`Successfully fetched ${services.length} services from ${provider.name}`);
          break;
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            lastError = 'Request timed out after 30s';
          } else {
            lastError = error instanceof Error ? error.message : 'Unknown error';
          }
          console.error(`Error fetching from ${provider.name}:`, lastError);
          retries--;
        }
      }

      if (services.length === 0 && lastError) {
        console.error(`Failed to fetch from ${provider.name} after all retries. Last error: ${lastError}`);
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
          name: cleanServiceName(service.name),
          type: service.type,
          category: cleanServiceName(service.category),
          rate: rate,
          min_order: parseInt(service.min),
          max_order: parseInt(service.max),
          description: null, // Will be filled in after checking existing descriptions
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

    // Get existing descriptions to preserve custom ones
    const existingDescriptions: { [key: string]: string } = {};
    let descOffset = 0;
    let hasMoreDesc = true;

    while (hasMoreDesc) {
      const { data: existingDesc, error: descError } = await supabaseClient
        .from('services')
        .select('id, description')
        .range(descOffset, descOffset + 999);

      if (descError) {
        console.error('Error fetching existing descriptions:', descError);
      } else if (existingDesc && existingDesc.length > 0) {
        for (const svc of existingDesc) {
          if (svc.description) {
            existingDescriptions[svc.id] = svc.description;
          }
        }
        descOffset += 1000;
        hasMoreDesc = existingDesc.length === 1000;
      } else {
        hasMoreDesc = false;
      }
    }

    console.log(`Fetched ${Object.keys(existingDescriptions).length} existing descriptions`);

    // Helper function to check if description is custom/instructional
    const isCustomDescription = (desc: string): boolean => {
      if (!desc) return false;
      const customIndicators = [
        'Format:', 'URL:', 'URL |', 'Example:', 'Note:', 'Important:',
        'Enter your', 'Provide the', 'Link format:', 'link | keywords',
        'url | keyword', 'URL:keyword', 'Custom Comments'
      ];
      return customIndicators.some(indicator => desc.includes(indicator));
    };

    // Fill in descriptions for all services
    for (const service of allServicesData) {
      const existingDesc = existingDescriptions[service.id];
      
      // Keep existing custom descriptions, otherwise generate new one
      if (existingDesc && isCustomDescription(existingDesc)) {
        service.description = existingDesc;
      } else {
        service.description = generateDescription(service.name, service.category, service.min_order.toString(), service.max_order.toString());
      }
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

    // Check for significant changes and send notification
    const significantChangeThreshold = 50;
    const hasSignificantChanges = deletedCount > significantChangeThreshold || 
      Math.abs(allServicesData.length - existingServiceIds.length) > significantChangeThreshold;
    
    const hasProviderIssues = Object.entries(providerResults).some(([name, count]) => count === 0);
    
    if (hasSignificantChanges || hasProviderIssues) {
      const changes: string[] = [];
      
      if (hasProviderIssues) {
        const failedProviders = Object.entries(providerResults)
          .filter(([_, count]) => count === 0)
          .map(([name]) => name);
        changes.push(`<strong>Provider Issues:</strong> ${failedProviders.join(', ')} returned 0 services`);
      }
      
      if (deletedCount > significantChangeThreshold) {
        changes.push(`<strong>High Deletions:</strong> ${deletedCount} services were deleted`);
      }
      
      const netChange = allServicesData.length - existingServiceIds.length;
      if (Math.abs(netChange) > significantChangeThreshold) {
        changes.push(`<strong>Service Count Change:</strong> ${netChange > 0 ? '+' : ''}${netChange} (${existingServiceIds.length} → ${allServicesData.length})`);
      }
      
      changes.push(`<br><strong>Summary:</strong><br>• Upserted: ${successCount}<br>• Deleted: ${deletedCount}<br>• Owlet: ${providerResults['owlet'] || 0}<br>• FollowsPanel: ${providerResults['followspanel'] || 0}`);
      
      await sendSyncNotification(
        'Significant Sync Changes Detected',
        changes.join('<br><br>'),
        hasProviderIssues
      );
    }

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
    
    // Send error notification
    await sendSyncNotification(
      'Service Sync Failed',
      `<strong>Error:</strong> ${errorMessage}<br><br>The automatic service synchronization has failed. Please check the edge function logs for more details and consider running a manual sync.`,
      true
    );
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
});
