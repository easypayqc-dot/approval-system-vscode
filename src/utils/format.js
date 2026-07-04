'use strict';

const dayjs = require('dayjs');

function clean(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const text = String(value).trim().split(',')[0].trim();
  const parts = text.split(/[/-]/);
  if (parts.length !== 3) return null;
  let d, m, y;
  if (parts[0].length === 4) {
    y = Number(parts[0]); m = Number(parts[1]); d = Number(parts[2]);
  } else {
    d = Number(parts[0]); m = Number(parts[1]); y = Number(parts[2]);
    if (y > 2400) y -= 543;
  }
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateKey(value = new Date()) {
  const d = parseDate(value) || value;
  return dayjs(d).format('YYYY-MM-DD');
}

function monthKey(value = new Date()) {
  const d = parseDate(value) || value;
  return dayjs(d).format('YYYY-MM');
}

function thaiDate(value) {
  const d = parseDate(value);
  return d ? dayjs(d).format('DD/MM/YYYY') : '';
}

function dateTime(value = new Date()) {
  return dayjs(value).format('DD/MM/YYYY HH:mm:ss');
}

module.exports = { clean, parseDate, dateKey, monthKey, thaiDate, dateTime };
