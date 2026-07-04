'use strict';

const { SHEETS, SHOP_HEADERS } = require('../config/constants');
const sheets = require('../integrations/googleSheetsClient');
const { callAppsScript } = require('../integrations/appsScriptClient');
const { clean } = require('../utils/format');

function normalizeShopName(value) {
  return clean(value).replace(/\s+/g, ' ');
}

function normalizeProvince(value) {
  return clean(value).replace(/\s+/g, ' ');
}

async function ensureShopHeaders() {
  const values = await sheets.getValues(SHEETS.SHOPS, 'A1:B1');
  const current = values[0] || [];
  const needsUpdate = SHOP_HEADERS.some((header, index) => clean(current[index]) !== header);
  if (needsUpdate) await sheets.updateValues(SHEETS.SHOPS, 'A1:B1', [SHOP_HEADERS]);
}

async function readShopsFromSheet() {
  const values = await sheets.getValues(SHEETS.SHOPS, 'A:B');
  const rows = values.slice(1);
  const seen = new Set();
  return rows
    .map((row, index) => ({ row: index + 2, shop: normalizeShopName(row[0]), province: normalizeProvince(row[1]) }))
    .filter((item) => {
      const key = item.shop.toLowerCase();
      if (!item.shop || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.shop.localeCompare(b.shop, 'th'));
}

async function seedMasterDataIfPossible() {
  try {
    await callAppsScript('seedMasterData', {});
    return true;
  } catch (_err) {
    // ถ้า Apps Script ยังไม่ได้ deploy action seedMasterData ให้ปล่อยผ่าน แล้วคืนข้อมูลเท่าที่มี
    return false;
  }
}

async function getShops(options = {}) {
  const autoSeed = options.autoSeed !== false;
  await ensureShopHeaders();

  let shops = await readShopsFromSheet();
  if (!shops.length && autoSeed) {
    const seeded = await seedMasterDataIfPossible();
    if (seeded) {
      await ensureShopHeaders();
      shops = await readShopsFromSheet();
    }
  }

  return shops;
}

async function findShopRow(shopName) {
  const target = normalizeShopName(shopName).toLowerCase();
  if (!target) return -1;
  const shops = await getShops({ autoSeed: false });
  const found = shops.find((item) => item.shop.toLowerCase() === target);
  return found ? found.row : -1;
}

async function addShop(data = {}) {
  await ensureShopHeaders();
  const shop = normalizeShopName(data.shop || data.shopName);
  const province = normalizeProvince(data.province);
  if (!shop) throw new Error('กรุณากรอกชื่อร้านค้า');
  if (!province) throw new Error('กรุณากรอกจังหวัด');
  const row = await findShopRow(shop);
  if (row > -1) {
    await sheets.updateValues(SHEETS.SHOPS, `A${row}:B${row}`, [[shop, province]]);
    return { shop, province, row, updated: true };
  }
  const result = await sheets.appendValues(SHEETS.SHOPS, [[shop, province]]);
  return { shop, province, row: result.startRow || null, updated: false };
}

module.exports = { getShops, addShop, findShopRow, ensureShopHeaders };
