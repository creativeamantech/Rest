import ExcelJS from 'exceljs';
import { AllocationItem, FeedbackUploadItem } from '../types';
import { AVAILABILITY_OPTIONS, STANDARD_FEEDBACK_OPTIONS } from './excelExportService';

export interface FormatErrorItem {
  rowNumber?: number;
  agreementId?: string;
  columnName: string;
  foundValue: string;
  expectedFormat: string;
  errorType:
    | 'CRITICAL_HEADER_MISMATCH'
    | 'MISSING_REQUIRED_SHEET'
    | 'INVALID_DROPDOWN_OPTION'
    | 'INVALID_TIMESTAMP_FORMAT'
    | 'MISSING_REQUIRED_FIELD'
    | 'DUPLICATE_TIMESTAMP'
    | 'UNASSIGNED_CASE';
  message: string;
  severity: 'critical' | 'warning';
}

export interface ParseFeedbackResult {
  fileName: string;
  fileSize: number;
  totalCases: number;
  validCount: number;
  flaggedCount: number;
  unassignedCount: number;
  items: FeedbackUploadItem[];
  validItems: FeedbackUploadItem[];
  statusBreakdown: Record<string, number>;
  auditSummary: {
    totalTimestampsChecked: number;
    staggeredUniqueCount: number;
    duplicateFlaggedCount: number;
    missingCount: number;
    complianceScore: number; // percentage
  };
  hasTimestampSheet: boolean;
  hasHistorySheet: boolean;
  historyLogsCount: number;
  // Format Validation Details
  formatErrors: FormatErrorItem[];
  isFormatValid: boolean;
  headerValidation: {
    isValid: boolean;
    missingHeaders: string[];
    foundHeaders: string[];
  };
}

// Expected standard columns in Calling_Feedback
export const EXPECTED_CALLING_HEADERS = [
  'Agreement ID',
  'Executive Name',
  'Allocation Date',
  'Status',
  'Availability',
  'Standard feedbacks',
  'Detailed Feedback',
  'REF 1 Availability',
  'REF 1 Feedback',
  'REF 2 Availability',
  'REF 2 Feedback',
];

/**
 * Validates timestamp format: Must match YYYY-MM-DD HH:MM:SS or standard ISO date string
 */
function isValidTimestampFormat(ts: string): boolean {
  if (!ts || !ts.trim()) return false;
  const str = ts.trim();
  // Regex for standard format YYYY-MM-DD HH:MM:SS or YYYY/MM/DD HH:MM:SS
  const formatRegex = /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\s+\d{1,2}:\d{2}(:\d{2})?$/;
  if (formatRegex.test(str)) return true;

  // Check if parseable via Date and has both date and time components
  const parsed = Date.parse(str);
  if (isNaN(parsed)) return false;

  return str.includes(':') && (str.includes('-') || str.includes('/'));
}

/**
 * Parses an uploaded .xlsx or .xlsm feedback file from an executive or admin.
 * Enforces rigorous format compliance:
 * 1. Checks worksheet structure & header column names
 * 2. Validates Availability against AVAILABILITY_OPTIONS
 * 3. Validates Standard feedbacks against STANDARD_FEEDBACK_OPTIONS
 * 4. Validates timestamp format (YYYY-MM-DD HH:MM:SS)
 * 5. Audits for duplicate timestamps (anti-bulk)
 * 6. Checks case assignment permissions for executives
 */
export async function parseFeedbackExcelFile(
  file: File,
  userRole: 'Admin' | 'Executive',
  currentUserName: string,
  currentUserUsername: string,
  existingAllocations: AllocationItem[]
): Promise<ParseFeedbackResult> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const formatErrors: FormatErrorItem[] = [];

  // 1. Locate Sheets
  const callingSheet =
    workbook.getWorksheet('Calling_Feedback') ||
    workbook.worksheets.find(ws => ws.name.toLowerCase().includes('calling')) ||
    workbook.worksheets.find(ws => ws.state === 'visible') ||
    workbook.worksheets[0];

  if (!callingSheet) {
    throw new Error(
      'फ़ॉर्मेट एरर: अपलोड की गई Excel फ़ाइल में "Calling_Feedback" वर्कशीट नहीं मिली। कृपया मान्य टेम्पलेट उपयोग करें।'
    );
  }

  const timestampSheet =
    workbook.getWorksheet('Timestamps_Audit') ||
    workbook.worksheets.find(ws => ws.name.toLowerCase().includes('timestamp'));

  const historySheet =
    workbook.getWorksheet('Feedback_History') ||
    workbook.worksheets.find(ws => ws.name.toLowerCase().includes('history'));

  if (!timestampSheet) {
    formatErrors.push({
      columnName: 'Timestamps_Audit Sheet',
      foundValue: 'अनुपस्थित (Missing)',
      expectedFormat: 'Timestamps_Audit नाम की सुरक्षित शीट',
      errorType: 'MISSING_REQUIRED_SHEET',
      message: 'फ़ाइल में "Timestamps_Audit" शीट नहीं मिली। सभी फीडबैक का अलग-अलग सेकंड्स में टाइमस्टैम्प होना अनिवार्य है।',
      severity: 'warning',
    });
  }

  // 2. Validate Calling_Feedback Headers
  const headerRow = callingSheet.getRow(1);
  const foundHeaders: string[] = [];
  for (let c = 1; c <= 11; c++) {
    const val = (headerRow.getCell(c).text || '').trim();
    if (val) foundHeaders.push(val);
  }

  const missingHeaders: string[] = [];
  const requiredKeyHeaders = [
    { idx: 1, name: 'Agreement ID' },
    { idx: 2, name: 'Executive Name' },
    { idx: 5, name: 'Availability' },
    { idx: 6, name: 'Standard feedbacks' },
  ];

  requiredKeyHeaders.forEach(req => {
    const cellVal = (headerRow.getCell(req.idx).text || '').trim().toLowerCase();
    const expected = req.name.toLowerCase();
    if (!cellVal || (!cellVal.includes(expected) && !expected.includes(cellVal))) {
      missingHeaders.push(`Col ${req.idx}: "${req.name}" (पाया गया: "${headerRow.getCell(req.idx).text || 'खाली'}")`);
      formatErrors.push({
        columnName: `कॉलम ${req.idx}`,
        foundValue: headerRow.getCell(req.idx).text || 'खाली',
        expectedFormat: req.name,
        errorType: 'CRITICAL_HEADER_MISMATCH',
        message: `कॉलम ${req.idx} पर "${req.name}" होना अनिवार्य है। कृपया हेडर नाम न बदलें।`,
        severity: 'critical',
      });
    }
  });

  const headerValidation = {
    isValid: missingHeaders.length === 0,
    missingHeaders,
    foundHeaders,
  };

  // Build lookup map of existing allocations by Agreement ID (case-insensitive)
  const allocationMap = new Map<string, AllocationItem>();
  existingAllocations.forEach(item => {
    allocationMap.set(item.agreementId.trim().toLowerCase(), item);
  });

  // Build timestamp lookup map from Timestamps_Audit sheet
  interface TimestampData {
    availTime?: string;
    sfTime?: string;
    dfTime?: string;
    r1aTime?: string;
    r1fTime?: string;
    r2aTime?: string;
    r2fTime?: string;
    rowNumber?: number;
  }
  const timestampMap = new Map<string, TimestampData>();

  if (timestampSheet) {
    timestampSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const agrId = (row.getCell(1).text || '').trim();
      if (agrId) {
        timestampMap.set(agrId.toLowerCase(), {
          availTime: (row.getCell(3).text || '').trim(),
          sfTime: (row.getCell(4).text || '').trim(),
          dfTime: (row.getCell(5).text || '').trim(),
          r1aTime: (row.getCell(6).text || '').trim(),
          r1fTime: (row.getCell(7).text || '').trim(),
          r2aTime: (row.getCell(8).text || '').trim(),
          r2fTime: (row.getCell(9).text || '').trim(),
          rowNumber,
        });
      }
    });
  }

  const items: FeedbackUploadItem[] = [];
  const statusBreakdown: Record<string, number> = {};
  let totalTimestampsChecked = 0;
  let staggeredUniqueCount = 0;
  let duplicateFlaggedCount = 0;
  let missingCount = 0;

  // Anti-bulk tracker across file
  const seenTimestamps = new Set<string>();

  // Helper to extract clean text from cell
  const getCellText = (cell: ExcelJS.Cell): string => {
    if (!cell || cell.value === null || cell.value === undefined) return '';
    if (typeof cell.value === 'object') {
      if ('result' in cell.value && cell.value.result !== undefined) {
        return String(cell.value.result).trim();
      }
      if ('text' in cell.value && cell.value.text !== undefined) {
        return String(cell.value.text).trim();
      }
    }
    return String(cell.value).trim();
  };

  // Standard valid options sets (case-insensitive for validation)
  const validAvailSet = new Set(AVAILABILITY_OPTIONS.map(o => o.toLowerCase()));
  const validStandardSet = new Set(STANDARD_FEEDBACK_OPTIONS.map(o => o.toLowerCase()));

  callingSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Header

    const agreementId = getCellText(row.getCell(1));
    if (!agreementId) return; // Skip empty row

    const executiveName = getCellText(row.getCell(2));
    const allocationDate = getCellText(row.getCell(3));
    let statusVal = getCellText(row.getCell(4));
    const availability = getCellText(row.getCell(5));
    const standardFeedbacks = getCellText(row.getCell(6));
    const detailedFeedback = getCellText(row.getCell(7));
    const ref1Availability = getCellText(row.getCell(8));
    const ref1Feedback = getCellText(row.getCell(9));
    const ref2Availability = getCellText(row.getCell(10));
    const ref2Feedback = getCellText(row.getCell(11));

    const effectiveStatus = standardFeedbacks || statusVal || 'Allocated';

    // Get Timestamps from linked sheet
    const tsData = timestampMap.get(agreementId.toLowerCase()) || {};
    const availTime = tsData.availTime || '';
    const sfTime = tsData.sfTime || '';
    const dfTime = tsData.dfTime || '';
    const r1aTime = tsData.r1aTime || '';
    const r1fTime = tsData.r1fTime || '';
    const r2aTime = tsData.r2aTime || '';
    const r2fTime = tsData.r2fTime || '';

    let isValid = true;
    let validationError: string | undefined;
    let auditFlag: 'Valid' | 'DuplicateTimestamp' | 'MissingTime' | 'Unassigned' = 'Valid';

    const existingCase = allocationMap.get(agreementId.toLowerCase());

    // ─────────────────────────────────────────────────────────────
    // FORMAT VALIDATION RULE 1: Check Availability Dropdown Value
    // ─────────────────────────────────────────────────────────────
    if (availability && !validAvailSet.has(availability.toLowerCase())) {
      isValid = false;
      const msg = `पंक्ति ${rowNumber}: 'Availability' का मान "${availability}" अमान्य है। केवल ड्रॉपडाउन विकल्प चुनें (${AVAILABILITY_OPTIONS.join(', ')})`;
      validationError = msg;
      formatErrors.push({
        rowNumber,
        agreementId,
        columnName: 'Availability',
        foundValue: availability,
        expectedFormat: AVAILABILITY_OPTIONS.join(' | '),
        errorType: 'INVALID_DROPDOWN_OPTION',
        message: msg,
        severity: 'critical',
      });
    }

    // ─────────────────────────────────────────────────────────────
    // FORMAT VALIDATION RULE 2: Check Standard feedbacks Dropdown Value
    // ─────────────────────────────────────────────────────────────
    if (standardFeedbacks && !validStandardSet.has(standardFeedbacks.toLowerCase())) {
      isValid = false;
      const msg = `पंक्ति ${rowNumber}: 'Standard feedbacks' का मान "${standardFeedbacks}" अमान्य है। केवल मानक विकल्प चुनें (${STANDARD_FEEDBACK_OPTIONS.slice(0, 5).join(', ')}...)`;
      validationError = msg;
      formatErrors.push({
        rowNumber,
        agreementId,
        columnName: 'Standard feedbacks',
        foundValue: standardFeedbacks,
        expectedFormat: STANDARD_FEEDBACK_OPTIONS.join(' | '),
        errorType: 'INVALID_DROPDOWN_OPTION',
        message: msg,
        severity: 'critical',
      });
    }

    // ─────────────────────────────────────────────────────────────
    // FORMAT VALIDATION RULE 3: Co-dependency Check
    // ─────────────────────────────────────────────────────────────
    if (standardFeedbacks && !availability) {
      isValid = false;
      const msg = `पंक्ति ${rowNumber}: 'Standard feedbacks' (${standardFeedbacks}) भरा गया है लेकिन 'Availability' खाली है। उपलब्धता चुनना अनिवार्य है।`;
      validationError = msg;
      formatErrors.push({
        rowNumber,
        agreementId,
        columnName: 'Availability',
        foundValue: 'खाली (Empty)',
        expectedFormat: 'Yes / No / Third Party आदि',
        errorType: 'MISSING_REQUIRED_FIELD',
        message: msg,
        severity: 'critical',
      });
    }

    // ─────────────────────────────────────────────────────────────
    // FORMAT VALIDATION RULE 4: REF 1 & REF 2 Availability Check
    // ─────────────────────────────────────────────────────────────
    if (ref1Availability && !validAvailSet.has(ref1Availability.toLowerCase())) {
      isValid = false;
      formatErrors.push({
        rowNumber,
        agreementId,
        columnName: 'REF 1 Availability',
        foundValue: ref1Availability,
        expectedFormat: AVAILABILITY_OPTIONS.join(' | '),
        errorType: 'INVALID_DROPDOWN_OPTION',
        message: `पंक्ति ${rowNumber}: 'REF 1 Availability' मान "${ref1Availability}" अमान्य है।`,
        severity: 'critical',
      });
    }

    if (ref2Availability && !validAvailSet.has(ref2Availability.toLowerCase())) {
      isValid = false;
      formatErrors.push({
        rowNumber,
        agreementId,
        columnName: 'REF 2 Availability',
        foundValue: ref2Availability,
        expectedFormat: AVAILABILITY_OPTIONS.join(' | '),
        errorType: 'INVALID_DROPDOWN_OPTION',
        message: `पंक्ति ${rowNumber}: 'REF 2 Availability' मान "${ref2Availability}" अमान्य है।`,
        severity: 'critical',
      });
    }

    // ─────────────────────────────────────────────────────────────
    // FORMAT VALIDATION RULE 5: Executive Case Assignment Permission
    // ─────────────────────────────────────────────────────────────
    if (userRole === 'Executive') {
      const myName = currentUserName.toLowerCase();
      const myUsername = currentUserUsername.toLowerCase();
      const caseExec = (existingCase?.executiveName || executiveName || '').toLowerCase();

      const isMyCase =
        caseExec === myName ||
        caseExec === myUsername ||
        caseExec.includes(myName) ||
        myName.includes(caseExec);

      if (!isMyCase) {
        isValid = false;
        const msg = `पंक्ति ${rowNumber}: केस ${agreementId} आपके नाम पर आवंटित नहीं है (असाइन: ${existingCase?.executiveName || 'Unknown'})`;
        validationError = msg;
        auditFlag = 'Unassigned';
        formatErrors.push({
          rowNumber,
          agreementId,
          columnName: 'Agreement ID / Assignment',
          foundValue: existingCase?.executiveName || executiveName || 'Unknown',
          expectedFormat: currentUserName,
          errorType: 'UNASSIGNED_CASE',
          message: msg,
          severity: 'critical',
        });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // FORMAT VALIDATION RULE 6: Timestamp Format & Anti-Bulk Check
    // ─────────────────────────────────────────────────────────────
    const timestampEntries = [
      { name: 'Availability Timestamp', val: availTime },
      { name: 'Standard Feedback Timestamp', val: sfTime },
      { name: 'Detailed Feedback Timestamp', val: dfTime },
      { name: 'REF 1 Avail Time', val: r1aTime },
      { name: 'REF 1 Feedback Time', val: r1fTime },
      { name: 'REF 2 Avail Time', val: r2aTime },
      { name: 'REF 2 Feedback Time', val: r2fTime },
    ];

    const filledTimes = timestampEntries.filter(e => e.val);

    // Validate timestamp formatting (YYYY-MM-DD HH:MM:SS)
    filledTimes.forEach(t => {
      if (!isValidTimestampFormat(t.val)) {
        isValid = false;
        formatErrors.push({
          rowNumber,
          agreementId,
          columnName: t.name,
          foundValue: t.val,
          expectedFormat: 'YYYY-MM-DD HH:MM:SS (उदा. 2026-09-29 14:35:18)',
          errorType: 'INVALID_TIMESTAMP_FORMAT',
          message: `पंक्ति ${rowNumber}: ${t.name} का प्रारूप गलत है ("${t.val}")। अपेक्षित: YYYY-MM-DD HH:MM:SS`,
          severity: 'warning',
        });
      }
    });

    const rowTimes = filledTimes.map(e => e.val);

    if (rowTimes.length > 0) {
      totalTimestampsChecked += rowTimes.length;

      // Duplicate within same row (all filled times must have distinct seconds)
      const uniqueRowTimes = new Set(rowTimes);
      if (uniqueRowTimes.size < rowTimes.length) {
        isValid = false;
        duplicateFlaggedCount++;
        auditFlag = 'DuplicateTimestamp';
        const msg = `पंक्ति ${rowNumber}: डुप्लिकेट टाइमस्टैम्प डिटेक्टेड! एक ही सेकंड में कई फीडबैक भरे गए हैं (सेकंड्स भिन्न नियम उल्लंघन)`;
        validationError = msg;
        formatErrors.push({
          rowNumber,
          agreementId,
          columnName: 'Timestamps_Audit',
          foundValue: rowTimes[0],
          expectedFormat: 'प्रत्येक फीडबैक का अलग-अलग सेकंड्स (Staggered Seconds)',
          errorType: 'DUPLICATE_TIMESTAMP',
          message: msg,
          severity: 'critical',
        });
      } else {
        // Cross-row duplicate timestamp (two completely different cases stamped with exact same second)
        let hasCrossDuplicate = false;
        for (const t of rowTimes) {
          if (seenTimestamps.has(t)) {
            hasCrossDuplicate = true;
            break;
          }
          seenTimestamps.add(t);
        }

        if (hasCrossDuplicate) {
          isValid = false;
          duplicateFlaggedCount++;
          auditFlag = 'DuplicateTimestamp';
          const msg = `पंक्ति ${rowNumber}: समान टाइमस्टैम्प डिटेक्टेड! यह समय अन्य केस में भी पाया गया है।`;
          validationError = msg;
          formatErrors.push({
            rowNumber,
            agreementId,
            columnName: 'Timestamps_Audit',
            foundValue: rowTimes[0],
            expectedFormat: 'सभी कॉल्स के लिए विशिष्ट सेकंड्स (Unique Timestamps)',
            errorType: 'DUPLICATE_TIMESTAMP',
            message: msg,
            severity: 'critical',
          });
        } else {
          staggeredUniqueCount += rowTimes.length;
        }
      }
    } else if (standardFeedbacks || detailedFeedback) {
      // Feedback filled but timestamp is completely missing
      missingCount++;
      auditFlag = 'MissingTime';
      formatErrors.push({
        rowNumber,
        agreementId,
        columnName: 'Timestamps_Audit',
        foundValue: 'खाली (Missing)',
        expectedFormat: 'सिस्टम टाइमस्टैम्प (YYYY-MM-DD HH:MM:SS)',
        errorType: 'MISSING_REQUIRED_FIELD',
        message: `पंक्ति ${rowNumber}: केस ${agreementId} में फीडबैक भरा गया है लेकिन Timestamps_Audit में समय दर्ज नहीं है।`,
        severity: 'warning',
      });
    }

    statusBreakdown[effectiveStatus] = (statusBreakdown[effectiveStatus] || 0) + 1;

    items.push({
      agreementId,
      executiveName: executiveName || existingCase?.executiveName || currentUserName,
      allocationDate: allocationDate || existingCase?.allocationDate,
      status: effectiveStatus,
      availability,
      availTime,
      standardFeedbacks,
      sfTime,
      detailedFeedback,
      dfTime,
      ref1Availability,
      r1aTime,
      ref1Feedback,
      r1fTime,
      ref2Availability,
      r2aTime,
      ref2Feedback,
      r2fTime,
      timeGap: 'अलग-अलग सेकंड्स सत्यापित',
      isValid: isValid && auditFlag !== 'DuplicateTimestamp' && auditFlag !== 'Unassigned',
      validationError,
      auditFlag,
    });
  });

  const validItems = items.filter(i => i.isValid);
  const flaggedCount = items.filter(
    i => !i.isValid || i.auditFlag === 'DuplicateTimestamp' || i.auditFlag === 'MissingTime'
  ).length;
  const unassignedCount = items.filter(i => i.auditFlag === 'Unassigned').length;

  const complianceScore =
    totalTimestampsChecked > 0
      ? Math.round((staggeredUniqueCount / totalTimestampsChecked) * 100)
      : 100;

  let historyLogsCount = 0;
  if (historySheet) {
    historyLogsCount = Math.max(historySheet.actualRowCount - 1, 0);
  }

  const isFormatValid = formatErrors.length === 0;

  return {
    fileName: file.name,
    fileSize: file.size,
    totalCases: items.length,
    validCount: validItems.length,
    flaggedCount,
    unassignedCount,
    items,
    validItems,
    statusBreakdown,
    auditSummary: {
      totalTimestampsChecked,
      staggeredUniqueCount,
      duplicateFlaggedCount,
      missingCount,
      complianceScore,
    },
    hasTimestampSheet: Boolean(timestampSheet),
    hasHistorySheet: Boolean(historySheet),
    historyLogsCount,
    formatErrors,
    isFormatValid,
    headerValidation,
  };
}
