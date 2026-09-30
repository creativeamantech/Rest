import { ParsedAllocationRow } from '../types';

export function parseBulkAllocationText(rawText: string): {
  rows: ParsedAllocationRow[];
  totalParsed: number;
  validCount: number;
  invalidCount: number;
  uniqueExecutives: string[];
} {
  if (!rawText || !rawText.trim()) {
    return {
      rows: [],
      totalParsed: 0,
      validCount: 0,
      invalidCount: 0,
      uniqueExecutives: []
    };
  }

  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const parsedRows: ParsedAllocationRow[] = [];
  const seenAgreements = new Set<string>();
  const executivesSet = new Set<string>();

  const todayStr = new Date().toISOString().split('T')[0];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if line is a header row
    const lower = line.toLowerCase();
    if (
      i === 0 &&
      (lower.includes('agreement') ||
        lower.includes('executive') ||
        lower.includes('एग्रीमेंट') ||
        lower.includes('एग्जीक्यूटिव'))
    ) {
      continue;
    }

    let parts: string[] = [];

    if (line.includes('\t')) {
      parts = line.split('\t').map(p => p.trim());
    } else if (line.includes('|')) {
      parts = line.split('|').map(p => p.trim());
    } else if (line.includes(',')) {
      parts = line.split(',').map(p => p.trim());
    } else if (line.includes(' - ')) {
      parts = line.split(' - ').map(p => p.trim());
    } else if (line.includes(': ')) {
      parts = line.split(': ').map(p => p.trim());
    } else if (/\s{2,}/.test(line)) {
      parts = line.split(/\s{2,}/).map(p => p.trim());
    } else {
      // Single space separation fallback: first word agreementId, remainder executive
      const spaceIdx = line.indexOf(' ');
      if (spaceIdx > 0) {
        parts = [line.substring(0, spaceIdx).trim(), line.substring(spaceIdx + 1).trim()];
      } else {
        parts = [line];
      }
    }

    parts = parts.filter(p => p.length > 0);

    const agreementId = parts[0] || '';
    const executiveName = parts[1] || '';
    let allocationDate = parts[2] || todayStr;
    const notes = parts.slice(3).join(' ') || '';

    // Validate date format if provided, else use todayStr
    if (!/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(allocationDate) && parts[2]) {
      // maybe parts[2] was actually a note or status
      allocationDate = todayStr;
    }

    let isValid = true;
    let validationError: string | undefined;

    if (!agreementId) {
      isValid = false;
      validationError = 'Agreement ID missing (एग्रीमेंट आईडी गायब है)';
    } else if (!executiveName) {
      isValid = false;
      validationError = 'Executive Name missing (एग्जीक्यूटिव नाम गायब है)';
    } else if (agreementId.length < 2) {
      isValid = false;
      validationError = 'Agreement ID is too short';
    }

    const isDuplicate = seenAgreements.has(agreementId.toLowerCase());
    if (isValid && !isDuplicate) {
      seenAgreements.add(agreementId.toLowerCase());
      executivesSet.add(executiveName);
    }

    parsedRows.push({
      agreementId,
      executiveName,
      allocationDate,
      status: 'Allocated',
      notes,
      isValid,
      validationError,
      isDuplicate
    });
  }

  const validCount = parsedRows.filter(r => r.isValid).length;
  const invalidCount = parsedRows.filter(r => !r.isValid).length;

  return {
    rows: parsedRows,
    totalParsed: parsedRows.length,
    validCount,
    invalidCount,
    uniqueExecutives: Array.from(executivesSet)
  };
}

export function parseBulkTransferText(
  rawText: string,
  existingAllocations: import('../types').AllocationItem[]
): {
  rows: import('../types').ParsedTransferRow[];
  totalParsed: number;
  validTransfersCount: number;
  newAllocationsCount: number;
  invalidCount: number;
} {
  if (!rawText || !rawText.trim()) {
    return {
      rows: [],
      totalParsed: 0,
      validTransfersCount: 0,
      newAllocationsCount: 0,
      invalidCount: 0,
    };
  }

  // Create map of existing allocations by lowercase agreementId
  const existingMap = new Map<string, import('../types').AllocationItem>();
  existingAllocations.forEach(item => {
    existingMap.set(item.agreementId.toLowerCase(), item);
  });

  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const rows: import('../types').ParsedTransferRow[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();
    if (
      i === 0 &&
      (lower.includes('agreement') ||
        lower.includes('executive') ||
        lower.includes('एग्रीमेंट') ||
        lower.includes('एग्जीक्यूटिव'))
    ) {
      continue;
    }

    let parts: string[] = [];
    if (line.includes('\t')) {
      parts = line.split('\t').map(p => p.trim());
    } else if (line.includes('|')) {
      parts = line.split('|').map(p => p.trim());
    } else if (line.includes(',')) {
      parts = line.split(',').map(p => p.trim());
    } else if (line.includes(' - ')) {
      parts = line.split(' - ').map(p => p.trim());
    } else if (line.includes(': ')) {
      parts = line.split(': ').map(p => p.trim());
    } else if (/\s{2,}/.test(line)) {
      parts = line.split(/\s{2,}/).map(p => p.trim());
    } else {
      const spaceIdx = line.indexOf(' ');
      if (spaceIdx > 0) {
        parts = [line.substring(0, spaceIdx).trim(), line.substring(spaceIdx + 1).trim()];
      } else {
        parts = [line];
      }
    }

    parts = parts.filter(p => p.length > 0);

    const agreementId = parts[0] || '';
    const toExecutive = parts[1] || '';

    let isValid = true;
    let validationError: string | undefined;

    if (!agreementId) {
      isValid = false;
      validationError = 'Agreement ID missing';
    } else if (!toExecutive) {
      isValid = false;
      validationError = 'Target Executive missing';
    }

    const existingMatch = existingMap.get(agreementId.toLowerCase());
    const isExistingAgreement = !!existingMatch;
    const fromExecutive = existingMatch ? (existingMatch.executiveName || 'Unallocated') : 'Unallocated / New';

    let actionType: 'Transfer' | 'New Allocation' | 'Same Executive' = 'Transfer';
    if (!isExistingAgreement) {
      actionType = 'New Allocation';
    } else if (fromExecutive.toLowerCase() === toExecutive.toLowerCase()) {
      actionType = 'Same Executive';
    }

    rows.push({
      agreementId,
      fromExecutive,
      toExecutive,
      isValid,
      validationError,
      isExistingAgreement,
      actionType,
    });
  }

  const validTransfersCount = rows.filter(r => r.isValid && r.actionType === 'Transfer').length;
  const newAllocationsCount = rows.filter(r => r.isValid && r.actionType === 'New Allocation').length;
  const invalidCount = rows.filter(r => !r.isValid).length;

  return {
    rows,
    totalParsed: rows.length,
    validTransfersCount,
    newAllocationsCount,
    invalidCount,
  };
}
