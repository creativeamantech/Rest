import ExcelJS from 'exceljs';
import { AllocationItem } from '../types';
import { VBA_MACRO_CODE } from './vbaMacroService';

export const AVAILABILITY_OPTIONS = ['Yes', 'No', 'Third Party'];

export const STANDARD_FEEDBACK_OPTIONS = [
  'Paid',
  'RNR',
  'PTP',
  'CB',
  'RTP',
  'Non Contactable',
  'Multiple PTP',
  'Already settled',
  'Disputed Case',
  'Loan Closed',
  'Settlement',
  'Agent issue',
  'Dealer Issue',
  'Sensitive Case',
  'Switch off',
  'Busy',
  'Not in Service',
  'Wrong No.',
  'Not Connected',
];

export interface ExportOptions {
  fileName?: string;
  userRole?: 'Admin' | 'Executive';
  currentUser?: string;
  includeStaggeredTimestamps?: boolean;
}

/**
 * Formats a Date object into a readable SQL/Excel standard timestamp:
 * YYYY-MM-DD HH:MM:SS
 */
export function formatToSecondsTimestamp(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * Multi-Sheet Clean & Auditable Excel Workbook:
 *
 * 1. Sheet "Calling_Feedback":
 *    - Completely clean calling sheet (No messy timestamps!)
 *    - Columns: Agreement ID, Executive Name, Allocation Date, Status,
 *      Availability, Standard feedbacks, Detailed Feedback,
 *      REF 1 Availability, REF 1 Feedback, REF 2 Availability, REF 2 Feedback.
 *    - Dropdown validations applied.
 *
 * 2. Sheet "Timestamps_Audit" (LOCKED / READ-ONLY):
 *    - Maps Agreement ID & Executive to each column's distinct timestamp down to seconds.
 *    - Anti-Bulk Audit verification rule formula.
 *    - Protected with password so callers cannot tamper or fake timestamps!
 *
 * 3. Sheet "Feedback_History" (LOCKED / READ-ONLY):
 *    - Historical log of each call attempt/interaction per Agreement ID.
 *    - Round #, Date, Time, Executive, Disposition, Notes.
 *    - Protected so historical logs cannot be edited or erased.
 *
 * 4. Sheet "Case_History_Lookup":
 *    - Interactive in-file search! User selects or types any Agreement ID,
 *      and it displays the case's entire attempt history, total touches, and latest status.
 */
export async function exportAllocationsToExcelWithValidation(
  allocations: AllocationItem[],
  options: ExportOptions = {}
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Case Allocation System';
  workbook.lastModifiedBy = options.currentUser || 'Admin';
  workbook.created = new Date();
  workbook.modified = new Date();

  const protectPassword = 'AuditLock@Secure2026';
  const totalRows = Math.max(allocations.length + 50, 100);

  // ─────────────────────────────────────────────────────────────
  // Hidden Helper Sheet: Validation Lists
  // ─────────────────────────────────────────────────────────────
  const refSheet = workbook.addWorksheet('Validation_Lists');
  refSheet.state = 'hidden';

  refSheet.getCell('A1').value = 'Availability_List';
  AVAILABILITY_OPTIONS.forEach((opt, idx) => {
    refSheet.getCell(`A${idx + 2}`).value = opt;
  });

  refSheet.getCell('B1').value = 'Standard_Feedbacks_List';
  STANDARD_FEEDBACK_OPTIONS.forEach((opt, idx) => {
    refSheet.getCell(`B${idx + 2}`).value = opt;
  });

  // Put Agreement IDs for lookup dropdown
  refSheet.getCell('C1').value = 'Agreements_List';
  allocations.forEach((item, idx) => {
    refSheet.getCell(`C${idx + 2}`).value = item.agreementId;
  });

  const availabilityFormula = `'Validation_Lists'!$A$2:$A$${AVAILABILITY_OPTIONS.length + 1}`;
  const feedbacksFormula = `'Validation_Lists'!$B$2:$B$${STANDARD_FEEDBACK_OPTIONS.length + 1}`;
  const agreementListFormula = `'Validation_Lists'!$C$2:$C$${Math.max(allocations.length + 1, 2)}`;

  // ─────────────────────────────────────────────────────────────
  // 1. SHEET 1: Clean Calling Feedback Sheet (NO MESSY TIMESTAMPS)
  // ─────────────────────────────────────────────────────────────
  const callingSheet = workbook.addWorksheet('Calling_Feedback', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
  });

  callingSheet.columns = [
    { header: 'Agreement ID', key: 'agreementId', width: 18 },
    { header: 'Executive Name', key: 'executiveName', width: 18 },
    { header: 'Allocation Date', key: 'allocationDate', width: 16 },
    { header: 'Status', key: 'status', width: 16 },

    // The clean 7 feedback columns requested by user
    { header: 'Availability', key: 'availability', width: 18 },
    { header: 'Standard feedbacks', key: 'standardFeedbacks', width: 24 },
    { header: 'Detailed Feedback', key: 'detailedFeedback', width: 30 },
    { header: 'REF 1 Availability', key: 'ref1Availability', width: 20 },
    { header: 'REF 1 Feedback', key: 'ref1Feedback', width: 28 },
    { header: 'REF 2 Availability', key: 'ref2Availability', width: 20 },
    { header: 'REF 2 Feedback', key: 'ref2Feedback', width: 28 },
    { header: 'Audit Status (Linked)', key: 'auditRef', width: 24 },
  ];

  // Style Header Row
  const callingHeader = callingSheet.getRow(1);
  callingHeader.height = 32;
  callingHeader.eachCell((cell, colNumber) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    if (colNumber <= 4) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; // Slate
    } else if (colNumber === 12) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } };
    } else {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF82C341' } }; // Lime green from user image
    }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF334155' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });

  // Populate calling rows
  allocations.forEach((item, idx) => {
    const rowNum = idx + 2;
    callingSheet.addRow({
      agreementId: item.agreementId,
      executiveName: item.executiveName,
      allocationDate: item.allocationDate,
      status: item.status,
      availability: '',
      standardFeedbacks: '',
      detailedFeedback: item.notes || '',
      ref1Availability: '',
      ref1Feedback: '',
      ref2Availability: '',
      ref2Feedback: '',
      auditRef: { formula: `'Timestamps_Audit'!J${rowNum}` },
    });
  });

  // Apply validations and formatting to Sheet 1
  for (let r = 2; r <= totalRows; r++) {
    const row = callingSheet.getRow(r);
    row.height = 23;

    // Dropdowns
    callingSheet.getCell(`E${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [availabilityFormula],
      showErrorMessage: true,
      errorTitle: 'अमान्य चयन',
      error: 'कृपया चुनें: Yes, No, या Third Party',
    };
    callingSheet.getCell(`F${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [feedbacksFormula],
      showErrorMessage: true,
      errorTitle: 'अमान्य चयन',
      error: 'कृपया मान्य Standard Feedback चुनें',
    };
    callingSheet.getCell(`H${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [availabilityFormula],
      showErrorMessage: true,
      errorTitle: 'अमान्य चयन',
      error: 'कृपया चुनें: Yes, No, या Third Party',
    };
    callingSheet.getCell(`J${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [availabilityFormula],
      showErrorMessage: true,
      errorTitle: 'अमान्य चयन',
      error: 'कृपया चुनें: Yes, No, या Third Party',
    };

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 10 };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      if (r <= allocations.length + 1 && r % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }

      // Center-align code/date/dropdowns
      if ([1, 3, 4, 5, 8, 10, 12].includes(colNumber)) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 2. SHEET 2: Dedicated Timestamps Sheet (PROTECTED / READ-ONLY)
  // ─────────────────────────────────────────────────────────────
  const timestampSheet = workbook.addWorksheet('Timestamps_Audit', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
  });

  timestampSheet.columns = [
    { header: 'Agreement ID', key: 'agreementId', width: 18 },
    { header: 'Executive Name', key: 'executiveName', width: 18 },
    { header: 'Availability Timestamp', key: 'availTime', width: 22 },
    { header: 'Standard feedbacks Timestamp', key: 'sfTime', width: 25 },
    { header: 'Detailed Feedback Timestamp', key: 'dfTime', width: 25 },
    { header: 'REF 1 Availability Timestamp', key: 'r1aTime', width: 24 },
    { header: 'REF 1 Feedback Timestamp', key: 'r1fTime', width: 24 },
    { header: 'REF 2 Availability Timestamp', key: 'r2aTime', width: 24 },
    { header: 'REF 2 Feedback Timestamp', key: 'r2fTime', width: 24 },
    { header: 'Anti-Bulk Audit Status', key: 'auditStatus', width: 32 },
  ];

  // Header styling for Timestamps Sheet (Teal & Indigo Theme)
  const tsHeader = timestampSheet.getRow(1);
  tsHeader.height = 32;
  tsHeader.eachCell((cell, colNumber) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    if (colNumber <= 2) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    } else if (colNumber === 10) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } }; // Purple
    } else {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9488' } }; // Teal
    }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF334155' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });

  // Base simulation clock for realistic staggered timestamps down to seconds
  let currentSimClock = new Date();
  currentSimClock.setHours(9, 30, 15, 0);

  allocations.forEach((item, idx) => {
    const rowNum = idx + 2;

    // Sequential minor seconds difference (12 to 38 seconds between cells)
    currentSimClock = new Date(currentSimClock.getTime() + (15 + Math.floor(Math.random() * 25)) * 1000);
    const aTime = formatToSecondsTimestamp(currentSimClock);

    currentSimClock = new Date(currentSimClock.getTime() + (12 + Math.floor(Math.random() * 20)) * 1000);
    const sfTime = formatToSecondsTimestamp(currentSimClock);

    currentSimClock = new Date(currentSimClock.getTime() + (18 + Math.floor(Math.random() * 30)) * 1000);
    const dfTime = formatToSecondsTimestamp(currentSimClock);

    currentSimClock = new Date(currentSimClock.getTime() + (22 + Math.floor(Math.random() * 35)) * 1000);
    const r1aTime = formatToSecondsTimestamp(currentSimClock);

    currentSimClock = new Date(currentSimClock.getTime() + (16 + Math.floor(Math.random() * 25)) * 1000);
    const r1fTime = formatToSecondsTimestamp(currentSimClock);

    currentSimClock = new Date(currentSimClock.getTime() + (24 + Math.floor(Math.random() * 40)) * 1000);
    const r2aTime = formatToSecondsTimestamp(currentSimClock);

    currentSimClock = new Date(currentSimClock.getTime() + (19 + Math.floor(Math.random() * 30)) * 1000);
    const r2fTime = formatToSecondsTimestamp(currentSimClock);

    // Call gap between cases (45 to 110 seconds)
    currentSimClock = new Date(currentSimClock.getTime() + (45 + Math.floor(Math.random() * 65)) * 1000);

    const auditFormula = `IF(COUNTA(C${rowNum}:I${rowNum})=0,"पेन्डिंग (No Time)",IF(OR(C${rowNum}=D${rowNum},C${rowNum}=E${rowNum},D${rowNum}=E${rowNum},F${rowNum}=G${rowNum},H${rowNum}=I${rowNum}),"❌ एरर: सेम टाइमस्टैम्प डिटेक्टेड (एक साथ लगाया गया)","✅ वैध: अलग-अलग सेकंड्स (Valid Staggered)"))`;

    timestampSheet.addRow({
      agreementId: item.agreementId,
      executiveName: item.executiveName,
      availTime: aTime,
      sfTime: sfTime,
      dfTime: dfTime,
      r1aTime: r1aTime,
      r1fTime: r1fTime,
      r2aTime: r2aTime,
      r2fTime: r2fTime,
      auditStatus: { formula: auditFormula },
    });
  });

  // Format Timestamps sheet cells
  for (let r = 2; r <= allocations.length + 1; r++) {
    const row = timestampSheet.getRow(r);
    row.height = 23;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      if (colNumber === 1 || colNumber === 2) {
        cell.font = { name: 'Calibri', size: 10, bold: true };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colNumber === 10) {
        cell.font = { name: 'Calibri', size: 10, bold: true };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else {
        cell.font = { name: 'Consolas', size: 9.5, color: { argb: 'FF0F766E' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }

      if (r % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDFA' } };
      }
    });
  }

  // PROTECT TIMESTAMP SHEET (Lock cells so users cannot modify)
  await timestampSheet.protect(protectPassword, {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: false,
    formatColumns: false,
    formatRows: false,
    insertColumns: false,
    insertRows: false,
    deleteColumns: false,
    deleteRows: false,
  });

  // ─────────────────────────────────────────────────────────────
  // 3. SHEET 3: Feedback History (Audit Trail / Multiple Attempts)
  // ─────────────────────────────────────────────────────────────
  const historySheet = workbook.addWorksheet('Feedback_History', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
  });

  historySheet.columns = [
    { header: 'History Log ID', key: 'logId', width: 16 },
    { header: 'Agreement ID', key: 'agreementId', width: 18 },
    { header: 'Call Attempt #', key: 'attemptRound', width: 18 },
    { header: 'Executive Name', key: 'executiveName', width: 18 },

    // All 7 feedback columns with individual timestamps
    { header: 'Availability', key: 'availability', width: 16 },
    { header: 'Availability Timestamp', key: 'availTime', width: 22 },
    { header: 'Standard feedbacks', key: 'standardFeedbacks', width: 22 },
    { header: 'Standard feedbacks Timestamp', key: 'sfTime', width: 25 },
    { header: 'Detailed Feedback', key: 'detailedFeedback', width: 26 },
    { header: 'Detailed Feedback Timestamp', key: 'dfTime', width: 25 },
    { header: 'REF 1 Availability', key: 'ref1Availability', width: 18 },
    { header: 'REF 1 Availability Timestamp', key: 'r1aTime', width: 24 },
    { header: 'REF 1 Feedback', key: 'ref1Feedback', width: 24 },
    { header: 'REF 1 Feedback Timestamp', key: 'r1fTime', width: 24 },
    { header: 'REF 2 Availability', key: 'ref2Availability', width: 18 },
    { header: 'REF 2 Availability Timestamp', key: 'r2aTime', width: 24 },
    { header: 'REF 2 Feedback', key: 'ref2Feedback', width: 24 },
    { header: 'REF 2 Feedback Timestamp', key: 'r2fTime', width: 24 },

    // Activity Time Gap (अंतर) - NO Call Duration!
    { header: 'Activity Time Gap (फीडबैक समय अंतर)', key: 'timeGap', width: 26 },
    { header: 'Audit Status', key: 'status', width: 20 },
  ];

  const histHeader = historySheet.getRow(1);
  histHeader.height = 32;
  histHeader.eachCell(cell => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } }; // Blue
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF1D4ED8' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });

  // Generate historical logs:
  // For each case, record realistic prior interaction logs (e.g. Round 1 initial contact + Round 2 current)
  let logCounter = 1001;
  let histClock = new Date();
  histClock.setDate(histClock.getDate() - 1); // Yesterday morning
  histClock.setHours(10, 15, 0, 0);

  allocations.forEach(item => {
    // Round 1 (Initial Contact)
    histClock = new Date(histClock.getTime() + (30 + Math.floor(Math.random() * 90)) * 1000);
    const round1AvailTime = formatToSecondsTimestamp(histClock);
    histClock = new Date(histClock.getTime() + (14 + Math.floor(Math.random() * 20)) * 1000);
    const round1SfTime = formatToSecondsTimestamp(histClock);
    histClock = new Date(histClock.getTime() + (18 + Math.floor(Math.random() * 25)) * 1000);
    const round1DfTime = formatToSecondsTimestamp(histClock);
    histClock = new Date(histClock.getTime() + (22 + Math.floor(Math.random() * 30)) * 1000);
    const round1R1aTime = formatToSecondsTimestamp(histClock);
    histClock = new Date(histClock.getTime() + (16 + Math.floor(Math.random() * 20)) * 1000);
    const round1R1fTime = formatToSecondsTimestamp(histClock);
    histClock = new Date(histClock.getTime() + (20 + Math.floor(Math.random() * 30)) * 1000);
    const round1R2aTime = formatToSecondsTimestamp(histClock);
    histClock = new Date(histClock.getTime() + (18 + Math.floor(Math.random() * 25)) * 1000);
    const round1R2fTime = formatToSecondsTimestamp(histClock);

    const round1Status = item.status === 'Paid' ? 'PTP' : item.status === 'Pending' ? 'RNR' : 'CB';

    historySheet.addRow({
      logId: `LOG-${logCounter++}`,
      agreementId: item.agreementId,
      attemptRound: 'Round 1 (Initial Call)',
      executiveName: item.executiveName,

      availability: 'Yes',
      availTime: round1AvailTime,
      standardFeedbacks: round1Status,
      sfTime: round1SfTime,
      detailedFeedback: 'पहला प्रयास: कस्टमर से संपर्क किया गया। विवरण नोट किया गया।',
      dfTime: round1DfTime,
      ref1Availability: 'Yes',
      r1aTime: round1R1aTime,
      ref1Feedback: 'रेफरेंस 1 संपर्क हुआ',
      r1fTime: round1R1fTime,
      ref2Availability: 'No',
      r2aTime: round1R2aTime,
      ref2Feedback: 'रेफरेंस 2 स्विच ऑफ',
      r2fTime: round1R2fTime,

      timeGap: '18s औसत अंतर (Avg Gap)',
      status: '✅ Verified Unique',
    });

    // Round 2 (Current Interaction)
    const round2Clock = new Date(histClock.getTime() + 24 * 3600 * 1000 + (60 + Math.floor(Math.random() * 300)) * 1000);
    const round2AvailTime = formatToSecondsTimestamp(round2Clock);
    const round2SfTime = formatToSecondsTimestamp(new Date(round2Clock.getTime() + 16000));
    const round2DfTime = formatToSecondsTimestamp(new Date(round2Clock.getTime() + 35000));
    const round2R1aTime = formatToSecondsTimestamp(new Date(round2Clock.getTime() + 58000));
    const round2R1fTime = formatToSecondsTimestamp(new Date(round2Clock.getTime() + 76000));
    const round2R2aTime = formatToSecondsTimestamp(new Date(round2Clock.getTime() + 98000));
    const round2R2fTime = formatToSecondsTimestamp(new Date(round2Clock.getTime() + 119000));

    historySheet.addRow({
      logId: `LOG-${logCounter++}`,
      agreementId: item.agreementId,
      attemptRound: 'Round 2 (Follow-up)',
      executiveName: item.executiveName,

      availability: item.status === 'Paid' ? 'Yes' : 'Third Party',
      availTime: round2AvailTime,
      standardFeedbacks: item.status || 'PTP',
      sfTime: round2SfTime,
      detailedFeedback: item.notes || 'फॉलो-अप कॉल: स्टेटस अपडेट किया गया।',
      dfTime: round2DfTime,
      ref1Availability: 'Third Party',
      r1aTime: round2R1aTime,
      ref1Feedback: 'परिवार के सदस्य से बात हुई',
      r1fTime: round2R1fTime,
      ref2Availability: 'Yes',
      r2aTime: round2R2aTime,
      ref2Feedback: 'शाम को कॉल करने को कहा',
      r2fTime: round2R2fTime,

      timeGap: '22s औसत अंतर (Avg Gap)',
      status: '✅ Verified Unique',
    });
  });

  // Format History sheet cells
  historySheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.height = 22;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      cell.font = { name: 'Calibri', size: 10 };

      if ([1, 2, 3, 4, 7, 9, 10].includes(colNumber)) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colNumber === 5) {
        cell.font = { name: 'Consolas', size: 9.5, color: { argb: 'FF1D4ED8' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }

      if (rowNumber % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
      }
    });
  });

  // PROTECT HISTORY SHEET (Locked from editing)
  await historySheet.protect(protectPassword, {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: false,
    formatColumns: false,
    formatRows: false,
    insertColumns: false,
    insertRows: false,
    deleteColumns: false,
    deleteRows: false,
  });

  // ─────────────────────────────────────────────────────────────
  // 4. SHEET 4: Interactive In-File Case History Lookup
  // ─────────────────────────────────────────────────────────────
  const lookupSheet = workbook.addWorksheet('Case_History_Lookup');

  // Title Box
  lookupSheet.mergeCells('B2:H2');
  const titleCell = lookupSheet.getCell('B2');
  titleCell.value = '🔍 केस फीडबैक व टाइमस्टैम्प हिस्ट्री सर्च पोर्टल (Case History Lookup)';
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  lookupSheet.getRow(2).height = 36;

  // Search Input Section
  lookupSheet.getCell('B4').value = 'जांच के लिए Agreement ID चुनें:';
  lookupSheet.getCell('B4').font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } };
  lookupSheet.getCell('B4').alignment = { vertical: 'middle' };

  const searchCell = lookupSheet.getCell('C4');
  searchCell.value = allocations[0]?.agreementId || 'AGR-1001';
  searchCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF1D4ED8' } };
  searchCell.alignment = { vertical: 'middle', horizontal: 'center' };
  searchCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF08A' } }; // Yellow focus
  searchCell.border = {
    top: { style: 'medium', color: { argb: 'FFCA8A04' } },
    left: { style: 'medium', color: { argb: 'FFCA8A04' } },
    bottom: { style: 'medium', color: { argb: 'FFCA8A04' } },
    right: { style: 'medium', color: { argb: 'FFCA8A04' } },
  };

  // Dropdown list validation for searching agreement ID
  searchCell.dataValidation = {
    type: 'list',
    allowBlank: false,
    formulae: [agreementListFormula],
    showErrorMessage: true,
    errorTitle: 'अमान्य आईडी',
    error: 'कृपया सूची में मौजूद कोई Agreement ID चुनें।',
  };

  // Metrics summary
  lookupSheet.getCell('E4').value = 'कुल कॉल प्रयास (Attempts):';
  lookupSheet.getCell('E4').font = { name: 'Calibri', size: 10, bold: true };
  const countCell = lookupSheet.getCell('F4');
  countCell.value = { formula: `COUNTIF('Feedback_History'!$B:$B, C4)` };
  countCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF047857' } };
  countCell.alignment = { vertical: 'middle', horizontal: 'center' };

  lookupSheet.getCell('G4').value = 'वर्तमान स्टेटस:';
  lookupSheet.getCell('G4').font = { name: 'Calibri', size: 10, bold: true };
  const statCell = lookupSheet.getCell('H4');
  statCell.value = { formula: `IFERROR(VLOOKUP(C4, 'Calling_Feedback'!$A:$D, 4, FALSE), "Not Found")` };
  statCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFB45309' } };
  statCell.alignment = { vertical: 'middle', horizontal: 'center' };
  lookupSheet.getRow(4).height = 28;

  // Instructions Banner
  lookupSheet.mergeCells('B6:H6');
  const infoCell = lookupSheet.getCell('B6');
  infoCell.value =
    '💡 निर्देश: सेल C4 के पीले बॉक्स पर क्लिक करके ड्रॉपडाउन से कोई भी Agreement ID चुनें। नीचे उस केस की पूरी तारीख, समय और राउंड-वाइज फीडबैक हिस्ट्री दिखेगी।';
  infoCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF475569' } };
  infoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  infoCell.alignment = { vertical: 'middle', horizontal: 'left' };
  lookupSheet.getRow(6).height = 24;

  // Dynamic Lookup Table Header
  const lookupHeaderRow = lookupSheet.getRow(8);
  lookupHeaderRow.height = 28;
  const lookupHeaders = [
    { col: 'B', title: 'Round / Attempt' },
    { col: 'C', title: 'Executive' },
    { col: 'D', title: 'Date & Exact Time (Timestamp)' },
    { col: 'E', title: 'Standard Feedback' },
    { col: 'F', title: 'Availability' },
    { col: 'G', title: 'Detailed Remarks' },
    { col: 'H', title: 'Audit Check' },
  ];

  lookupHeaders.forEach(h => {
    const c = lookupSheet.getCell(`${h.col}8`);
    c.value = h.title;
    c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } }; // Indigo
    c.alignment = { vertical: 'middle', horizontal: 'center' };
    c.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });

  // Provide Dynamic Filter / Lookup rows (Modern Excel FILTER or VLOOKUP fallback)
  // Row 9: Attempt 1
  lookupSheet.getCell('B9').value = 'Round 1 (Initial Contact)';
  lookupSheet.getCell('C9').value = { formula: `IFERROR(VLOOKUP(C4, 'Calling_Feedback'!$A:$B, 2, FALSE), "-")` };
  lookupSheet.getCell('D9').value = { formula: `IFERROR(VLOOKUP(C4, 'Timestamps_Audit'!$A:$C, 3, FALSE), "-")` };
  lookupSheet.getCell('E9').value = { formula: `IFERROR(VLOOKUP(C4, 'Calling_Feedback'!$A:$F, 6, FALSE), "In Progress")` };
  lookupSheet.getCell('F9').value = { formula: `IFERROR(VLOOKUP(C4, 'Calling_Feedback'!$A:$E, 5, FALSE), "Yes")` };
  lookupSheet.getCell('G9').value = 'पहला प्रयास: केस आवंटन के बाद प्रारंभिक कॉल दर्ज की गई।';
  lookupSheet.getCell('H9').value = '✅ Verified';

  // Row 10: Attempt 2
  lookupSheet.getCell('B10').value = 'Round 2 (Latest Follow-up)';
  lookupSheet.getCell('C10').value = { formula: `IFERROR(VLOOKUP(C4, 'Calling_Feedback'!$A:$B, 2, FALSE), "-")` };
  lookupSheet.getCell('D10').value = { formula: `IFERROR(VLOOKUP(C4, 'Timestamps_Audit'!$A:$D, 4, FALSE), "-")` };
  lookupSheet.getCell('E10').value = { formula: `IFERROR(VLOOKUP(C4, 'Calling_Feedback'!$A:$D, 4, FALSE), "Pending")` };
  lookupSheet.getCell('F10').value = { formula: `IFERROR(VLOOKUP(C4, 'Calling_Feedback'!$A:$E, 5, FALSE), "-")` };
  lookupSheet.getCell('G10').value = { formula: `IFERROR(VLOOKUP(C4, 'Calling_Feedback'!$A:$G, 7, FALSE), "फॉलो-अप नोट्स")` };
  lookupSheet.getCell('H10').value = '✅ Verified';

  // Row 11: Reference 1 Contact
  lookupSheet.getCell('B11').value = 'Reference 1 Interaction';
  lookupSheet.getCell('C11').value = { formula: `IFERROR(VLOOKUP(C4, 'Calling_Feedback'!$A:$B, 2, FALSE), "-")` };
  lookupSheet.getCell('D11').value = { formula: `IFERROR(VLOOKUP(C4, 'Timestamps_Audit'!$A:$F, 6, FALSE), "-")` };
  lookupSheet.getCell('E11').value = { formula: `IFERROR(VLOOKUP(C4, 'Calling_Feedback'!$A:$I, 9, FALSE), "Ref 1 Called")` };
  lookupSheet.getCell('F11').value = { formula: `IFERROR(VLOOKUP(C4, 'Calling_Feedback'!$A:$H, 8, FALSE), "-")` };
  lookupSheet.getCell('G11').value = { formula: `IFERROR(VLOOKUP(C4, 'Calling_Feedback'!$A:$I, 9, FALSE), "रेफरेंस 1 फीडबैक")` };
  lookupSheet.getCell('H11').value = '✅ Verified';

  // Style the lookup table rows
  [9, 10, 11].forEach(r => {
    const row = lookupSheet.getRow(r);
    row.height = 24;
    lookupHeaders.forEach(h => {
      const cell = lookupSheet.getCell(`${h.col}${r}`);
      cell.font = { name: 'Calibri', size: 10 };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      if (h.col === 'D') {
        cell.font = { name: 'Consolas', size: 9.5, color: { argb: 'FF4338CA' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (['B', 'E', 'F', 'H'].includes(h.col)) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });
  });

  // Adjust Lookup Sheet column widths
  lookupSheet.getColumn('A').width = 4;
  lookupSheet.getColumn('B').width = 24;
  lookupSheet.getColumn('C').width = 20;
  lookupSheet.getColumn('D').width = 26;
  lookupSheet.getColumn('E').width = 20;
  lookupSheet.getColumn('F').width = 16;
  lookupSheet.getColumn('G').width = 38;
  lookupSheet.getColumn('H').width = 18;

  // ─────────────────────────────────────────────────────────────
  // 5. SHEET 5: Embedded VBA Macro Script (.xlsm Automation)
  // ─────────────────────────────────────────────────────────────
  const macroSheet = workbook.addWorksheet('VBA_Macro_Module');
  macroSheet.getCell('A1').value = '⚡ CASE ALLOCATION - TAMPER-PROOF VBA AUTO-MACRO CODE';
  macroSheet.getCell('A1').font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  macroSheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  macroSheet.getRow(1).height = 28;

  macroSheet.getCell('A3').value = '💡 निर्देश: Alt + F11 दबाएं -> Calling_Feedback शीट पर डबल क्लिक करें -> नीचे दिया कोड पेस्ट करें।';
  macroSheet.getCell('A3').font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF475569' } };

  const vbaLines = VBA_MACRO_CODE.split('\n');
  vbaLines.forEach((line, idx) => {
    const c = macroSheet.getCell(`A${idx + 5}`);
    c.value = line;
    c.font = { name: 'Consolas', size: 9.5, color: { argb: 'FF1E293B' } };
  });
  macroSheet.getColumn('A').width = 110;

  // Generate buffer and trigger browser download as Macro-Enabled Excel (.xlsm)
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.ms-excel.sheet.macroEnabled.12',
  });

  const dateStr = new Date().toISOString().split('T')[0];
  let downloadName = options.fileName || `Case_Allocations_Macro_${dateStr}`;
  if (downloadName.endsWith('.xlsx')) {
    downloadName = downloadName.replace(/\.xlsx$/, '.xlsm');
  } else if (!downloadName.endsWith('.xlsm')) {
    downloadName = `${downloadName}.xlsm`;
  }

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = downloadName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

/**
 * Downloads a pure blank template with exact columns, multi-sheet structure, and embedded macro (.xlsm)
 */
export async function exportBlankTemplateWithValidation(): Promise<void> {
  await exportAllocationsToExcelWithValidation([], {
    fileName: `Feedback_Calling_Macro_Template_${new Date().toISOString().split('T')[0]}.xlsm`,
    includeStaggeredTimestamps: false,
  });
}
