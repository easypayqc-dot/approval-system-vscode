'use strict';

function ok(message, data = {}) {
  return { success: true, message: message || 'สำเร็จ', ...data };
}

function fail(error) {
  return { success: false, message: error?.message || String(error) };
}

function failMessage(message) {
  return { success: false, message };
}

module.exports = { ok, fail, failMessage };
