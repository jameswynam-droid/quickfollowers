const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check Owlet
    const owletRes = await fetch('https://therealowlet.com/api/v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: Deno.env.get('OWLET_API_KEY'), action: 'services' }),
    });
    const owletData = await owletRes.json();
    const owletSample = Array.isArray(owletData) ? owletData.slice(0, 2) : owletData;

    // Check SmmFollows
    const smmRes = await fetch('https://smmfollows.com/api/v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: Deno.env.get('SMMFOLLOWS_API_KEY'), action: 'services' }),
    });
    const smmData = await smmRes.json();
    const smmSample = Array.isArray(smmData) ? smmData.slice(0, 2) : smmData;

    return new Response(JSON.stringify({
      owlet: { fields: owletSample.length > 0 ? Object.keys(owletSample[0]) : [], sample: owletSample },
      smmfollows: { fields: smmSample.length > 0 ? Object.keys(smmSample[0]) : [], sample: smmSample },
    }, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
