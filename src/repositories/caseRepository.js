'use strict';

const { getSupabaseClient } = require('../integrations/supabaseClient');
const { clean, parseDate, thaiDate } = require('../utils/format');

function toNumber(value) {
  const number = Number(String(value || 0).replace(/,/g, ''));
  return Number.isFinite(number) ? number : 0;
}

function getSystem(contractNo) {
  const text = clean(contractNo).toUpperCase();
  if (text.startsWith('CSR')) return 'CSR';
  if (text.startsWith('ECR')) return 'ECR';
  if (text.startsWith('MV')) return 'MV';
  if (text.startsWith('BN')) return 'BN';
  if (text.startsWith('KK')) return 'KK';
  return '';
}

function monthFromDateKey(dateText) {
  const value = clean(dateText);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.slice(0, 7) : '';
}

function toDbCase(data = {}) {
  const contractNo = clean(data.contractNo).toUpperCase();
  const dateText = clean(data.date);

  return {
    date: dateText || null,
    month: clean(data.month) || monthFromDateKey(dateText),
    system: clean(data.system) || getSystem(contractNo),

    loan_approval: clean(data.loanApproval),
    doc_approval: clean(data.docApproval),
    close_approval: clean(data.closeApproval),

    shop: clean(data.shop),
    province: clean(data.province),

    contract_no: contractNo,
    price: toNumber(data.price),
    note: clean(data.note),
    case_status: clean(data.caseStatus),

    loan_evidence_url: clean(data.loanEvidence),
    doc_evidence_url: clean(data.docEvidence),
    close_evidence_url: clean(data.closeEvidence),

    case_received_at: clean(data.caseReceivedAt),
    loan_completed_at: clean(data.loanCompletedAt),
    doc_completed_at: clean(data.docCompletedAt),
    close_completed_at: clean(data.closeCompletedAt),

    sla_minutes: Number(data.slaMinutes || 20) || 20,
    sla_status: clean(data.slaStatus),
    tat_minutes: data.tatMinutes === '' || data.tatMinutes === undefined || data.tatMinutes === null ? null : toNumber(data.tatMinutes),

    sheet_sync_status: clean(data.sheetSyncStatus) || 'pending',
    sheet_sync_message: clean(data.sheetSyncMessage)
  };
}

function fromDbCase(row) {
  if (!row) return null;

  const parsedDate = parseDate(row.date);

  return {
    id: row.id,
    row: row.id,
    date: row.date || '',
    dateThai: parsedDate ? thaiDate(parsedDate) : '',
    month: row.month || '',
    system: row.system || getSystem(row.contract_no),
    docRequired: ['MV', 'CSR'].includes(row.system || getSystem(row.contract_no)),

    loanApproval: row.loan_approval || '',
    docApproval: row.doc_approval || '',
    closeApproval: row.close_approval || '',

    shop: row.shop || '',
    province: row.province || '',
    contractNo: row.contract_no || '',
    price: Number(row.price || 0),
    note: row.note || '',
    caseStatus: row.case_status || '',

    loanEvidence: row.loan_evidence_url || '',
    docEvidence: row.doc_evidence_url || '',
    closeEvidence: row.close_evidence_url || '',

    caseReceivedAt: row.case_received_at || '',
    loanCompletedAt: row.loan_completed_at || '',
    docCompletedAt: row.doc_completed_at || '',
    closeCompletedAt: row.close_completed_at || '',

    slaMinutes: Number(row.sla_minutes || 20) || 20,
    slaStatus: row.sla_status || '',
    tatMinutes: row.tat_minutes === null || row.tat_minutes === undefined ? '' : row.tat_minutes,

    sheetSyncStatus: row.sheet_sync_status || '',
    sheetSyncMessage: row.sheet_sync_message || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
}

async function upsertCase(data) {
  const supabase = getSupabaseClient();
  const payload = toDbCase(data);

  if (!payload.date) throw new Error('Missing date');
  if (!payload.contract_no) throw new Error('Missing contractNo');
  if (!payload.shop) throw new Error('Missing shop');

  const { data: row, error } = await supabase
    .from('cases')
    .upsert(payload, { onConflict: 'contract_no' })
    .select()
    .single();

  if (error) throw error;
  return fromDbCase(row);
}

async function listCases(limit = 2000) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('cases')
    .select('*')
    .order('date', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []).map(fromDbCase);
}

async function findCaseByContract(contractNo) {
  const supabase = getSupabaseClient();
  const target = clean(contractNo).toUpperCase();
  if (!target) return null;

  const { data, error } = await supabase
    .from('cases')
    .select('*')
    .eq('contract_no', target)
    .maybeSingle();

  if (error) throw error;
  return fromDbCase(data);
}

async function findCaseById(id) {
  const supabase = getSupabaseClient();
  const value = Number(id);
  if (!value) return null;

  const { data, error } = await supabase
    .from('cases')
    .select('*')
    .eq('id', value)
    .maybeSingle();

  if (error) throw error;
  return fromDbCase(data);
}

async function deleteCaseByContract(contractNo) {
  const supabase = getSupabaseClient();
  const target = clean(contractNo).toUpperCase();
  if (!target) return null;

  const { data, error } = await supabase
    .from('cases')
    .delete()
    .eq('contract_no', target)
    .select()
    .maybeSingle();

  if (error) throw error;
  return fromDbCase(data);
}

async function updateSheetSyncStatus(contractNo, status, message = '') {
  const supabase = getSupabaseClient();
  const target = clean(contractNo).toUpperCase();
  if (!target) return null;

  const { data, error } = await supabase
    .from('cases')
    .update({
      sheet_sync_status: clean(status),
      sheet_sync_message: clean(message)
    })
    .eq('contract_no', target)
    .select()
    .maybeSingle();

  if (error) throw error;
  return fromDbCase(data);
}

module.exports = {
  upsertCase,
  listCases,
  findCaseByContract,
  findCaseById,
  deleteCaseByContract,
  updateSheetSyncStatus,
  fromDbCase
};
