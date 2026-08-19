import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MARKUP_RATES = { standard: 0.10, premium: 0.15 };

const isPremiumService = (name: string, category: string): boolean => {
  const premiumKeywords = [
    'nigerian', 'nigeria', '🇳🇬',
    'share', 'shares', 'save', 'saves',
    'recovery', 'disabled',
    'premium', 'verified', 'bluetick',
    'boost', 'no drop', 'non drop',
  ];
  const text = `${name} ${category}`.toLowerCase();
  return premiumKeywords.some((k) => text.includes(k));
};

const providerEndpoint = (provider: string): { url: string; key?: string } | null => {
  if (provider === 'owlet') return { url: 'https://therealowlet.com/api/v2', key: Deno.env.get('OWLET_API_KEY') };
  if (provider === 'smmfollows') return { url: 'https://smmfollows.com/api/v2', key: Deno.env.get('SMMFOLLOWS_API_KEY') };
  if (provider === 'followspanel') return { url: 'https://followspanel.com/api/v2', key: Deno.env.get('FOLLOWSPANEL_API_KEY') };
  return null;
};

async function apiStatus(url: string, key: string, orderId: string) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, action: 'status', order: parseInt(orderId) }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  if (!json || typeof json !== 'object' || 'error' in json) return null;
  return json as Record<string, any>;
}

function mapApiStatus(apiStatus: string | undefined): string {
  const s = (apiStatus || '').toLowerCase();
  if (s === 'completed') return 'completed';
  if (s === 'canceled' || s === 'cancelled' || s === 'refunded') return 'cancelled';
  if (s === 'partial') return 'partial';
  if (s === 'in progress' || s === 'inprogress' || s === 'in_progress') return 'in_progress';
  if (s === 'processing') return 'processing';
  if (s === 'pending') return 'pending';
  if (s === 'failed' || s === 'error') return 'failed';
  if (s === 'expired') return 'completed';
  return 'processing';
}

const TERMINAL_PARENT = ['completed', 'cancelled', 'failed'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  let billed = 0;
  let childrenCreated = 0;
  let closed = 0;

  try {
    // ---------- 1. Subscriptions ----------
    const { data: reservations } = await admin
      .from('subscription_reservations')
      .select('*')
      .eq('status', 'active');

    for (const res of reservations || []) {
      if (!res.order_id) continue;
      const { data: parent } = await admin
        .from('orders')
        .select('id, user_id, service_id, link, api_order_id, status')
        .eq('id', res.order_id)
        .maybeSingle();
      if (!parent) continue;

      const { data: service } = await admin
        .from('services')
        .select('name, category, provider')
        .eq('id', parent.service_id)
        .maybeSingle();
      if (!service) continue;

      const ep = providerEndpoint(service.provider);
      if (!ep?.key) continue;

      const parentStatus = await apiStatus(ep.url, ep.key, parent.api_order_id);
      if (!parentStatus) continue;

      const childIds: string[] = [
        ...(Array.isArray(parentStatus.orders) ? parentStatus.orders : []),
        ...(Array.isArray(parentStatus.old_orders) ? parentStatus.old_orders : []),
      ].map((v: any) => String(v));

      const markup = 1 + (isPremiumService(service.name, service.category) ? MARKUP_RATES.premium : MARKUP_RATES.standard);

      const r = await syncChildren(admin, {
        parent,
        service,
        ep,
        childIds,
        markup,
        reservation: res,
      });
      billed += r.billed;
      childrenCreated += r.created;

      // Update parent order status
      const mapped = mapApiStatus(parentStatus.status);
      if (mapped !== parent.status) {
        await admin.from('orders').update({ status: mapped, updated_at: new Date().toISOString() }).eq('id', parent.id);
      }

      // Close the reservation when the provider is done with it
      if (TERMINAL_PARENT.includes(mapped)) {
        const { data: fresh } = await admin
          .from('subscription_reservations')
          .select('estimated_max, charged_so_far, released, status')
          .eq('id', res.id)
          .maybeSingle();
        if (fresh && fresh.status === 'active') {
          const held = Number(fresh.estimated_max) - Number(fresh.released || 0);
          if (held > 0) await releaseReserved(admin, parent.user_id, held);
          await admin
            .from('subscription_reservations')
            .update({
              status: 'completed',
              released: Number(fresh.estimated_max),
              completed_at: new Date().toISOString(),
            })
            .eq('id', res.id);
          closed++;
        }
      }
    }

    // ---------- 2. Drip feed parents ----------
    const { data: dripParents } = await admin
      .from('orders')
      .select('id, user_id, service_id, link, api_order_id, status, runs')
      .gt('runs', 1)
      .is('parent_order_id', null)
      .in('status', ['pending', 'processing', 'in_progress', 'partial']);

    for (const parent of dripParents || []) {
      const { data: service } = await admin
        .from('services')
        .select('name, category, provider')
        .eq('id', parent.service_id)
        .maybeSingle();
      if (!service) continue;
      const ep = providerEndpoint(service.provider);
      if (!ep?.key || !parent.api_order_id) continue;

      const parentStatus = await apiStatus(ep.url, ep.key, parent.api_order_id);
      if (!parentStatus) continue;
      const childIds: string[] = (Array.isArray(parentStatus.orders) ? parentStatus.orders : []).map((v: any) => String(v));
      const markup = 1 + (isPremiumService(service.name, service.category) ? MARKUP_RATES.premium : MARKUP_RATES.standard);

      // Drip feed is already paid up front, so children are recorded but not billed again.
      const r = await syncChildren(admin, {
        parent,
        service,
        ep,
        childIds,
        markup,
        reservation: null,
      });
      childrenCreated += r.created;

      const mapped = mapApiStatus(parentStatus.status);
      if (mapped !== parent.status) {
        await admin.from('orders').update({ status: mapped, updated_at: new Date().toISOString() }).eq('id', parent.id);
      }
    }

    return new Response(
      JSON.stringify({ success: true, billed, children: childrenCreated, closed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch (error) {
    console.error('sync-subscriptions failed:', error);
    return new Response(JSON.stringify({ error: 'Sync failed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

async function releaseReserved(admin: any, userId: string, amount: number) {
  const { data: p } = await admin.from('profiles').select('reserved_balance').eq('id', userId).maybeSingle();
  if (!p) return;
  const next = Math.max(0, Number(p.reserved_balance || 0) - amount);
  await admin.from('profiles').update({ reserved_balance: next }).eq('id', userId);
}

async function syncChildren(
  admin: any,
  opts: { parent: any; service: any; ep: { url: string; key?: string }; childIds: string[]; markup: number; reservation: any | null },
) {
  const { parent, service, ep, childIds, markup, reservation } = opts;
  let billed = 0;
  let created = 0;

  for (const childId of childIds) {
    const childStatus = await apiStatus(ep.url, ep.key!, childId);
    if (!childStatus) continue;

    const providerCharge = parseFloat(childStatus.charge ?? '0');
    const userCharge = reservation ? parseFloat((providerCharge * markup).toFixed(2)) : 0;
    const mapped = mapApiStatus(childStatus.status);
    const startCount = childStatus.start_count ? parseInt(childStatus.start_count) : null;
    const remains = childStatus.remains !== undefined && childStatus.remains !== '' ? parseInt(childStatus.remains) : null;

    const { data: existing } = await admin
      .from('orders')
      .select('id, status, charge')
      .eq('provider_child_id', childId)
      .maybeSingle();

    if (existing) {
      await admin
        .from('orders')
        .update({
          status: mapped,
          start_count: Number.isFinite(startCount as number) ? startCount : null,
          remains: Number.isFinite(remains as number) ? remains : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      continue;
    }

    // Quantity is not exposed for children, so derive it from start count and remains when possible.
    const quantity = Number.isFinite(remains as number) && (remains as number) > 0 ? (remains as number) : 0;

    const { data: inserted, error: insertError } = await admin
      .from('orders')
      .insert({
        user_id: parent.user_id,
        service_id: parent.service_id,
        link: parent.link,
        quantity,
        charge: userCharge,
        status: mapped,
        api_order_id: childId,
        provider_child_id: childId,
        parent_order_id: parent.id,
        start_count: Number.isFinite(startCount as number) ? startCount : null,
        remains: Number.isFinite(remains as number) ? remains : null,
      })
      .select('id')
      .single();

    if (insertError || !inserted) continue;
    created++;

    if (!reservation || userCharge <= 0) continue;

    // Bill the customer for this delivery and release the matching hold.
    const { data: profile } = await admin
      .from('profiles')
      .select('balance, reserved_balance')
      .eq('id', parent.user_id)
      .maybeSingle();
    if (!profile) continue;

    const newBalance = parseFloat((Number(profile.balance) - userCharge).toFixed(2));
    const newReserved = Math.max(0, parseFloat((Number(profile.reserved_balance || 0) - userCharge).toFixed(2)));

    await admin.from('profiles').update({ balance: newBalance, reserved_balance: newReserved }).eq('id', parent.user_id);

    await admin.from('transactions').insert({
      user_id: parent.user_id,
      amount: -userCharge,
      type: 'order',
      reference_id: childId,
      description: `Subscription delivery: ${service.name}`,
      balance_after: newBalance,
    });

    const { data: fresh } = await admin
      .from('subscription_reservations')
      .select('charged_so_far, released')
      .eq('id', reservation.id)
      .maybeSingle();

    await admin
      .from('subscription_reservations')
      .update({
        charged_so_far: parseFloat((Number(fresh?.charged_so_far || 0) + userCharge).toFixed(2)),
        released: parseFloat((Number(fresh?.released || 0) + userCharge).toFixed(2)),
      })
      .eq('id', reservation.id);

    billed++;
  }

  return { billed, created };
}
