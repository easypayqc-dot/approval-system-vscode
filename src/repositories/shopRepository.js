'use strict';

const { getSupabaseClient } = require('../integrations/supabaseClient');
const { clean } = require('../utils/format');

function normalizeShopName(value) {
  return clean(value).replace(/\s+/g, ' ');
}

function normalizeProvince(value) {
  return clean(value).replace(/\s+/g, ' ');
}

function fromDbShop(row) {
  if (!row) return null;
  return {
    id: row.id,
    row: row.id,
    shop: row.shop || '',
    province: row.province || ''
  };
}

async function listShops() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('shops')
    .select('id, shop, province')
    .order('shop', { ascending: true });

  if (error) throw error;
  return (data || []).map(fromDbShop).filter(Boolean);
}

async function findShop(shopName) {
  const supabase = getSupabaseClient();
  const shop = normalizeShopName(shopName);
  if (!shop) return null;

  const { data, error } = await supabase
    .from('shops')
    .select('id, shop, province')
    .eq('shop', shop)
    .maybeSingle();

  if (error) throw error;
  return fromDbShop(data);
}

async function upsertShop(shopName, province) {
  const supabase = getSupabaseClient();
  const payload = {
    shop: normalizeShopName(shopName),
    province: normalizeProvince(province)
  };

  if (!payload.shop) throw new Error('Missing shop');

  const { data, error } = await supabase
    .from('shops')
    .upsert(payload, { onConflict: 'shop' })
    .select('id, shop, province')
    .single();

  if (error) throw error;
  return fromDbShop(data);
}

async function bulkUpsertShops(shops = []) {
  const supabase = getSupabaseClient();
  const seen = new Set();
  const rows = [];

  for (const item of shops) {
    const shop = normalizeShopName(item.shop || item[0]);
    const province = normalizeProvince(item.province || item[1]);
    const key = shop.toLowerCase();
    if (!shop || seen.has(key)) continue;
    seen.add(key);
    rows.push({ shop, province });
  }

  if (!rows.length) return [];

  const { data, error } = await supabase
    .from('shops')
    .upsert(rows, { onConflict: 'shop' })
    .select('id, shop, province');

  if (error) throw error;
  return (data || []).map(fromDbShop).filter(Boolean);
}

module.exports = {
  listShops,
  findShop,
  upsertShop,
  bulkUpsertShops
};
