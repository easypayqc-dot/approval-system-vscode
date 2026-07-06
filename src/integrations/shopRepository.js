'use strict';

const { getSupabaseClient } = require('../integrations/supabaseClient');

function clean(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

async function upsertShop(shop, province) {
  const supabase = getSupabaseClient();

  const payload = {
    shop: clean(shop),
    province: clean(province)
  };

  if (!payload.shop) throw new Error('Missing shop');

  const { data, error } = await supabase
    .from('shops')
    .upsert(payload, { onConflict: 'shop' })
    .select()
    .single();

  if (error) throw error;

  return data;
}

async function listShops() {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('shops')
    .select('shop, province')
    .order('shop', { ascending: true });

  if (error) throw error;

  return data || [];
}

module.exports = {
  upsertShop,
  listShops
};