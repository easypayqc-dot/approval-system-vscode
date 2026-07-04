'use strict';

const DEFAULT_TIMEOUT_MS = 30000;

function webAppUrl() {
  const url = process.env.APPS_SCRIPT_WEBAPP_URL || process.env.GOOGLE_SHEETS_WEBHOOK_URL || '';
  if (!url) {
    throw new Error('Missing APPS_SCRIPT_WEBAPP_URL in .env');
  }
  return url;
}

function webAppToken() {
  return process.env.APPS_SCRIPT_WEBAPP_TOKEN || process.env.GOOGLE_SHEETS_WEBHOOK_TOKEN || '';
}

function timeoutMs() {
  const value = Number(process.env.APPS_SCRIPT_WEBAPP_TIMEOUT_MS || process.env.GOOGLE_SHEETS_WEBHOOK_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TIMEOUT_MS;
}

async function callAppsScript(action, data = {}) {
  if (!action) throw new Error('Missing Apps Script action');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());

  try {
    const response = await fetch(webAppUrl(), {
      method: 'POST',
      headers: {
        // ใช้ text/plain เหมือนโปรเจกต์เก่า เพื่อให้ Apps Script รับง่ายและเลี่ยง preflight
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({
        token: webAppToken(),
        action,
        data,
        sent_at: new Date().toISOString()
      }),
      signal: controller.signal
    });

    const text = await response.text();
    let result;
    try {
      result = text ? JSON.parse(text) : {};
    } catch (_error) {
      throw new Error(`Apps Script response is not JSON: ${text.slice(0, 400)}`);
    }

    if (!response.ok) {
      throw new Error(result.message || result.error || `Apps Script HTTP ${response.status}`);
    }

    if (result.ok === false || result.success === false) {
      throw new Error(result.message || result.error || 'Apps Script returned ok:false');
    }

    return result.data !== undefined ? result.data : result;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Apps Script timeout after ${timeoutMs()} ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  callAppsScript,
  webAppUrl,
  webAppToken,
  timeoutMs
};
