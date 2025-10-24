import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OwletService {
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get API credentials from secrets
    const apiKey = Deno.env.get('OWLET_API_KEY');
    if (!apiKey) {
      throw new Error('API key not configured');
    }

    console.log('Fetching services from The Owlet API...');
    
    // Call The Owlet API to get services
    const response = await fetch('https://therealowlet.com/api/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key: apiKey,
        action: 'services',
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const services = await response.json() as OwletService[];
    console.log(`Fetched ${services.length} services`);

    // Transform and upsert services into database
    const servicesData = services.map((service) => {
      // Convert rate - if it's too large, it's likely in kobo (smallest unit)
      // Divide by 100 to convert to Naira
      let rate = parseFloat(service.rate);
      if (rate > 1000000) {
        rate = rate / 100; // Convert from kobo to Naira
      }
      
      return {
        id: service.service,
        name: service.name,
        type: service.type,
        category: service.category,
        rate: rate,
        min_order: parseInt(service.min),
        max_order: parseInt(service.max),
        description: `${service.name} - Min: ${service.min}, Max: ${service.max}`,
      };
    });

    // Upsert services in batches
    const batchSize = 100;
    for (let i = 0; i < servicesData.length; i += batchSize) {
      const batch = servicesData.slice(i, i + batchSize);
      const { error } = await supabaseClient
        .from('services')
        .upsert(batch, { onConflict: 'id' });

      if (error) {
        console.error('Error upserting batch:', error);
        throw error;
      }
    }

    console.log('Services synced successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        count: services.length,
        message: 'Services synced successfully'
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
