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

    // Fetch services from each provider
    for (const provider of providers) {
      if (!provider.apiKey) {
        console.log(`Skipping ${provider.name} - no API key`);
        continue;
      }

      console.log(`Fetching services from ${provider.name}...`);
      
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
          continue;
        }

        const services = await response.json() as SMMService[];
        console.log(`Fetched ${services.length} services from ${provider.name}`);

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
            description: `${service.name} - Min: ${service.min}, Max: ${service.max}`,
            provider: provider.name,
          };
        });

        allServicesData = allServicesData.concat(providerServicesData);
      } catch (error) {
        console.error(`Error fetching from ${provider.name}:`, error);
      }
    }

    if (allServicesData.length === 0) {
      throw new Error('No services fetched from any provider');
    }

    console.log(`Total services to upsert: ${allServicesData.length}`);

    // First, delete all existing services to ensure clean sync
    const { error: deleteError } = await supabaseClient
      .from('services')
      .delete()
      .neq('id', '');  // Delete all services

    if (deleteError) {
      console.error('Error deleting old services:', deleteError);
      throw deleteError;
    }

    console.log('Deleted old services, now inserting fresh data...');

    // Insert services in batches
    const batchSize = 100;
    for (let i = 0; i < allServicesData.length; i += batchSize) {
      const batch = allServicesData.slice(i, i + batchSize);
      const { error } = await supabaseClient
        .from('services')
        .insert(batch);

      if (error) {
        console.error('Error inserting batch:', error);
        throw error;
      }
    }

    console.log('Services synced successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        count: allServicesData.length,
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
