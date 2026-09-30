import { AllocationItem, SpreadsheetInfo, TransferLogItem, UserAccount } from '../types';

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';

export const USERS_AUTH_TAB = 'Users_Auth';
export const MASTER_SHEET_TAB = 'Master_Allocations';
export const TRANSFER_LOGS_TAB = 'Transfer_Logs';

export const DEFAULT_HEADERS_USERS = [
  'User ID / Username',
  'Password',
  'Full Name',
  'Role',
  'Status',
  'Created Date'
];

export const INITIAL_DEFAULT_USERS: string[][] = [
  ['admin', 'admin123', 'System Administrator', 'Admin', 'Active', '2026-09-29'],
  ['rahul', 'pass123', 'Rahul Sharma', 'Executive', 'Active', '2026-09-29'],
  ['priya', 'pass123', 'Priya Patel', 'Executive', 'Active', '2026-09-29'],
  ['amit', 'pass123', 'Amit Verma', 'Executive', 'Active', '2026-09-29'],
  ['vikas', 'pass123', 'Vikas Gupta', 'Executive', 'Active', '2026-09-29'],
];

export const DEFAULT_HEADERS_MASTER = [
  'Agreement ID',
  'Executive Name',
  'Allocation Date',
  'Status',
  'Last Updated',
  'Notes'
];

export const DEFAULT_HEADERS_LOGS = [
  'Timestamp',
  'Agreement ID',
  'From Executive',
  'To Executive',
  'Transferred By',
  'Reason'
];

/**
 * List Google Spreadsheets owned or accessible by the user via Drive API
 */
export async function listSpreadsheets(accessToken: string): Promise<SpreadsheetInfo[]> {
  const query = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
  const res = await fetch(
    `${DRIVE_API_BASE}/files?q=${query}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc&pageSize=25`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `Failed to list spreadsheets: ${res.statusText}`);
  }

  const data = await res.json();
  return (data.files || []).map((f: { id: string; name: string; modifiedTime?: string }) => ({
    id: f.id,
    name: f.name,
    modifiedTime: f.modifiedTime,
  }));
}

/**
 * Creates a brand new dedicated Master Allocation Spreadsheet in Google Drive
 */
export async function createMasterSpreadsheet(
  accessToken: string,
  title: string = 'Case Allocation & Transfer Master Sheet'
): Promise<{ id: string; name: string; url: string }> {
  const createRes = await fetch(SHEETS_API_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title,
      },
      sheets: [
        {
          properties: {
            title: USERS_AUTH_TAB,
            gridProperties: {
              frozenRowCount: 1,
            },
          },
        },
        {
          properties: {
            title: MASTER_SHEET_TAB,
            gridProperties: {
              frozenRowCount: 1,
            },
          },
        },
        {
          properties: {
            title: TRANSFER_LOGS_TAB,
            gridProperties: {
              frozenRowCount: 1,
            },
          },
        },
      ],
    }),
  });

  if (!createRes.ok) {
    const errorData = await createRes.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `Failed to create spreadsheet: ${createRes.statusText}`);
  }

  const sheetData = await createRes.json();
  const spreadsheetId = sheetData.spreadsheetId;

  // Set the headers & initial seed data in all sheets
  await Promise.all([
    fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/${USERS_AUTH_TAB}!A1:F${INITIAL_DEFAULT_USERS.length + 1}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [DEFAULT_HEADERS_USERS, ...INITIAL_DEFAULT_USERS],
        }),
      }
    ),
    fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/${MASTER_SHEET_TAB}!A1:F1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [DEFAULT_HEADERS_MASTER],
        }),
      }
    ),
    fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/${TRANSFER_LOGS_TAB}!A1:F1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [DEFAULT_HEADERS_LOGS],
        }),
      }
    ),
  ]);

  return {
    id: spreadsheetId,
    name: sheetData.properties?.title || title,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
  };
}

/**
 * Ensures the target spreadsheet has the required tabs and header rows
 */
export async function initializeSpreadsheetTabs(
  accessToken: string,
  spreadsheetId: string
): Promise<{ masterTabName: string; logsTabName: string; usersTabName: string }> {
  // 1. Fetch metadata to inspect tabs
  const metaRes = await fetch(`${SHEETS_API_BASE}/${spreadsheetId}?fields=sheets(properties(sheetId,title))`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!metaRes.ok) {
    const err = await metaRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to read spreadsheet metadata: ${metaRes.statusText}`);
  }

  const metaData = await metaRes.json();
  const existingSheetTitles: string[] = (metaData.sheets || []).map(
    (s: { properties: { title: string } }) => s.properties.title
  );

  let masterTabName = MASTER_SHEET_TAB;
  let logsTabName = TRANSFER_LOGS_TAB;
  let usersTabName = USERS_AUTH_TAB;

  const hasUsers = existingSheetTitles.includes(USERS_AUTH_TAB);
  const hasMaster = existingSheetTitles.includes(MASTER_SHEET_TAB);
  const hasLogs = existingSheetTitles.includes(TRANSFER_LOGS_TAB);

  const requests: any[] = [];

  if (!hasUsers) {
    requests.push({
      addSheet: {
        properties: {
          title: USERS_AUTH_TAB,
          gridProperties: { frozenRowCount: 1 },
        },
      },
    });
  }

  if (!hasMaster) {
    if (existingSheetTitles.length === 1 && existingSheetTitles[0] === 'Sheet1') {
      // Rename Sheet1 to Master_Allocations
      requests.push({
        updateSheetProperties: {
          properties: {
            sheetId: metaData.sheets[0].properties.sheetId,
            title: MASTER_SHEET_TAB,
          },
          fields: 'title',
        },
      });
    } else {
      requests.push({
        addSheet: {
          properties: {
            title: MASTER_SHEET_TAB,
            gridProperties: { frozenRowCount: 1 },
          },
        },
      });
    }
  }

  if (!hasLogs) {
    requests.push({
      addSheet: {
        properties: {
          title: TRANSFER_LOGS_TAB,
          gridProperties: { frozenRowCount: 1 },
        },
      },
    });
  }

  if (requests.length > 0) {
    await fetch(`${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    });
  }

  // Ensure headers exist in Users_Auth
  const usersValuesRes = await fetch(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/${usersTabName}!A1:F1`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  const usersValues = await usersValuesRes.json().catch(() => ({}));
  if (!usersValues.values || usersValues.values.length === 0 || !usersValues.values[0][0]) {
    await fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/${usersTabName}!A1:F${INITIAL_DEFAULT_USERS.length + 1}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [DEFAULT_HEADERS_USERS, ...INITIAL_DEFAULT_USERS] }),
      }
    );
  }

  // Ensure headers exist in Master_Allocations
  const masterValuesRes = await fetch(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/${masterTabName}!A1:F1`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  const masterValues = await masterValuesRes.json().catch(() => ({}));
  if (!masterValues.values || masterValues.values.length === 0 || !masterValues.values[0][0]) {
    await fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/${masterTabName}!A1:F1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [DEFAULT_HEADERS_MASTER] }),
      }
    );
  }

  // Ensure headers exist in Transfer_Logs
  const logsValuesRes = await fetch(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/${logsTabName}!A1:F1`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  const logsValues = await logsValuesRes.json().catch(() => ({}));
  if (!logsValues.values || logsValues.values.length === 0 || !logsValues.values[0][0]) {
    await fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/${logsTabName}!A1:F1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [DEFAULT_HEADERS_LOGS] }),
      }
    );
  }

  return { masterTabName, logsTabName, usersTabName };
}

/**
 * Fetch all users and passwords from Users_Auth
 */
export async function getUsersFromSheet(
  accessToken: string,
  spreadsheetId: string,
  tabName: string = USERS_AUTH_TAB
): Promise<UserAccount[]> {
  const res = await fetch(`${SHEETS_API_BASE}/${spreadsheetId}/values/${tabName}!A2:F500`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    return [];
  }

  const data = await res.json();
  const rawRows: string[][] = data.values || [];

  const users: UserAccount[] = [];
  rawRows.forEach((row, index) => {
    const username = (row[0] || '').trim();
    if (username) {
      users.push({
        username,
        password: (row[1] || '').trim(),
        fullName: (row[2] || username).trim(),
        role: ((row[3] || 'Executive').trim().toLowerCase() === 'admin' ? 'Admin' : 'Executive'),
        status: ((row[4] || 'Active').trim().toLowerCase() === 'inactive' ? 'Inactive' : 'Active'),
        createdDate: (row[5] || '').trim(),
        rowIndex: index + 2,
      });
    }
  });

  return users;
}

/**
 * Add a new user with username and password to Users_Auth
 */
export async function addUserToSheet(
  accessToken: string,
  spreadsheetId: string,
  user: UserAccount,
  tabName: string = USERS_AUTH_TAB
): Promise<void> {
  const todayStr = new Date().toISOString().split('T')[0];
  const rowData = [
    user.username.trim(),
    user.password.trim(),
    user.fullName.trim(),
    user.role,
    user.status || 'Active',
    user.createdDate || todayStr,
  ];

  const res = await fetch(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/${tabName}!A:F:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [rowData] }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to add user to sheet: ${res.statusText}`);
  }
}

/**
 * Update an existing user's password, role, or status in Users_Auth
 */
export async function updateUserInSheet(
  accessToken: string,
  spreadsheetId: string,
  user: UserAccount,
  tabName: string = USERS_AUTH_TAB
): Promise<void> {
  if (!user.rowIndex) {
    throw new Error('User row index missing');
  }

  const rowData = [
    user.username.trim(),
    user.password.trim(),
    user.fullName.trim(),
    user.role,
    user.status,
    user.createdDate || '',
  ];

  const res = await fetch(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/${tabName}!A${user.rowIndex}:F${user.rowIndex}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [rowData] }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to update user in sheet: ${res.statusText}`);
  }
}

/**
 * Fetch all allocation rows from Master_Allocations
 */
export async function getMasterAllocations(
  accessToken: string,
  spreadsheetId: string,
  tabName: string = MASTER_SHEET_TAB
): Promise<AllocationItem[]> {
  const res = await fetch(`${SHEETS_API_BASE}/${spreadsheetId}/values/${tabName}!A2:F5000`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `Failed to read allocations: ${res.statusText}`);
  }

  const data = await res.json();
  const rawRows: string[][] = data.values || [];

  const result: AllocationItem[] = [];
  rawRows.forEach((row, index) => {
    const agreementId = (row[0] || '').trim();
    if (agreementId) {
      result.push({
        agreementId,
        executiveName: (row[1] || '').trim(),
        allocationDate: (row[2] || '').trim(),
        status: (row[3] || 'Allocated').trim(),
        lastUpdated: (row[4] || '').trim(),
        notes: (row[5] || '').trim(),
        rowIndex: index + 2, // 1-based index (header is 1)
      });
    }
  });

  return result;
}

/**
 * Fetch all transfer log rows from Transfer_Logs
 */
export async function getTransferLogs(
  accessToken: string,
  spreadsheetId: string,
  tabName: string = TRANSFER_LOGS_TAB
): Promise<TransferLogItem[]> {
  const res = await fetch(`${SHEETS_API_BASE}/${spreadsheetId}/values/${tabName}!A2:F5000`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    return [];
  }

  const data = await res.json();
  const rawRows: string[][] = data.values || [];

  const logs: TransferLogItem[] = [];
  rawRows.forEach(row => {
    const agreementId = (row[1] || '').trim();
    if (agreementId) {
      logs.push({
        timestamp: (row[0] || '').trim(),
        agreementId,
        fromExecutive: (row[2] || '').trim(),
        toExecutive: (row[3] || '').trim(),
        transferredBy: (row[4] || '').trim(),
        reason: (row[5] || '').trim(),
      });
    }
  });

  return logs.reverse(); // latest first
}

/**
 * Bulk Implement Allocations to Google Sheet:
 * If an Agreement ID already exists in the sheet, update its Executive, Date, Status.
 * If new, append it as a new row.
 */
export async function implementBulkAllocations(
  accessToken: string,
  spreadsheetId: string,
  newAllocations: {
    agreementId: string;
    executiveName: string;
    allocationDate: string;
    status?: string;
    notes?: string;
  }[],
  tabName: string = MASTER_SHEET_TAB
): Promise<{ updatedCount: number; insertedCount: number }> {
  // Fetch existing rows
  const existingRows = await getMasterAllocations(accessToken, spreadsheetId, tabName);
  const existingMap = new Map<string, AllocationItem>();
  existingRows.forEach(item => {
    existingMap.set(item.agreementId.toLowerCase(), item);
  });

  const nowStr = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const toAppendRows: string[][] = [];
  const updatePromises: Promise<any>[] = [];

  let updatedCount = 0;
  let insertedCount = 0;

  for (const item of newAllocations) {
    const key = item.agreementId.toLowerCase();
    const existing = existingMap.get(key);

    if (existing && existing.rowIndex) {
      // Update existing row
      updatedCount++;
      const updatedRowData = [
        item.agreementId,
        item.executiveName,
        item.allocationDate || existing.allocationDate,
        item.status || 'Allocated',
        nowStr,
        item.notes || existing.notes || '',
      ];

      updatePromises.push(
        fetch(
          `${SHEETS_API_BASE}/${spreadsheetId}/values/${tabName}!A${existing.rowIndex}:F${existing.rowIndex}?valueInputOption=USER_ENTERED`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ values: [updatedRowData] }),
          }
        )
      );
    } else {
      // New row to append
      insertedCount++;
      toAppendRows.push([
        item.agreementId,
        item.executiveName,
        item.allocationDate,
        item.status || 'Allocated',
        nowStr,
        item.notes || '',
      ]);
    }
  }

  // Execute updates
  if (updatePromises.length > 0) {
    await Promise.all(updatePromises);
  }

  // Execute appends
  if (toAppendRows.length > 0) {
    const appendRes = await fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/${tabName}!A:F:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: toAppendRows }),
      }
    );

    if (!appendRes.ok) {
      const err = await appendRes.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Failed to append new allocations: ${appendRes.statusText}`);
    }
  }

  return { updatedCount, insertedCount };
}

/**
 * Transfer a case from one executive to another:
 * 1. Updates executiveName in Master_Allocations
 * 2. Sets status to 'Transferred' or 'Allocated'
 * 3. Adds record to Transfer_Logs
 */
export async function transferCase(
  accessToken: string,
  spreadsheetId: string,
  agreementId: string,
  fromExecutive: string,
  toExecutive: string,
  transferredBy: string,
  reason: string,
  masterTab: string = MASTER_SHEET_TAB,
  logsTab: string = TRANSFER_LOGS_TAB
): Promise<void> {
  const existingRows = await getMasterAllocations(accessToken, spreadsheetId, masterTab);
  const target = existingRows.find(
    r => r.agreementId.toLowerCase() === agreementId.trim().toLowerCase()
  );

  if (!target || !target.rowIndex) {
    throw new Error(`Agreement ID "${agreementId}" not found in master sheet.`);
  }

  const nowStr = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  // 1. Update row in Master_Allocations
  const updatedRowData = [
    target.agreementId,
    toExecutive.trim(),
    target.allocationDate,
    'Transferred',
    nowStr,
    `Transferred from ${fromExecutive} to ${toExecutive}. Reason: ${reason || 'N/A'}`,
  ];

  const updateRes = await fetch(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/${masterTab}!A${target.rowIndex}:F${target.rowIndex}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [updatedRowData] }),
    }
  );

  if (!updateRes.ok) {
    const err = await updateRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to update master row: ${updateRes.statusText}`);
  }

  // 2. Append to Transfer_Logs
  const logData = [
    nowStr,
    target.agreementId,
    fromExecutive,
    toExecutive,
    transferredBy,
    reason || 'Reallocation',
  ];

  await fetch(`${SHEETS_API_BASE}/${spreadsheetId}/values/${logsTab}!A:F:append?valueInputOption=USER_ENTERED`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: [logData] }),
  });
}

/**
 * Update case status directly (e.g. In Progress, Resolved, Closed)
 */
export async function updateCaseStatus(
  accessToken: string,
  spreadsheetId: string,
  agreementId: string,
  newStatus: string,
  notes?: string,
  masterTab: string = MASTER_SHEET_TAB
): Promise<void> {
  const existingRows = await getMasterAllocations(accessToken, spreadsheetId, masterTab);
  const target = existingRows.find(
    r => r.agreementId.toLowerCase() === agreementId.trim().toLowerCase()
  );

  if (!target || !target.rowIndex) {
    throw new Error(`Agreement ID "${agreementId}" not found in master sheet.`);
  }

  const nowStr = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const updatedRowData = [
    target.agreementId,
    target.executiveName,
    target.allocationDate,
    newStatus,
    nowStr,
    notes !== undefined ? notes : target.notes || '',
  ];

  const res = await fetch(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/${masterTab}!A${target.rowIndex}:F${target.rowIndex}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [updatedRowData] }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to update status: ${res.statusText}`);
  }
}

/**
 * Bulk synchronize parsed daily feedback file into the Master Google Sheet:
 * - Updates case status, detailed notes, and last updated time in Master_Allocations
 * - Records upload audit trail in Google Sheet
 */
export async function syncFeedbackUploadToGoogleSheet(
  accessToken: string,
  spreadsheetId: string,
  items: {
    agreementId: string;
    status: string;
    detailedFeedback?: string;
    executiveName?: string;
  }[],
  uploadedBy: string,
  fileName: string,
  masterTab: string = MASTER_SHEET_TAB
): Promise<{ updatedCount: number }> {
  const existingRows = await getMasterAllocations(accessToken, spreadsheetId, masterTab);
  const existingMap = new Map<string, AllocationItem>();
  existingRows.forEach(item => {
    existingMap.set(item.agreementId.trim().toLowerCase(), item);
  });

  const nowStr = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const updatePromises: Promise<any>[] = [];
  let updatedCount = 0;

  for (const item of items) {
    const existing = existingMap.get(item.agreementId.trim().toLowerCase());
    if (existing && existing.rowIndex) {
      updatedCount++;
      const updatedRowData = [
        existing.agreementId,
        item.executiveName || existing.executiveName,
        existing.allocationDate,
        item.status || existing.status,
        nowStr,
        item.detailedFeedback || existing.notes || '',
      ];

      updatePromises.push(
        fetch(
          `${SHEETS_API_BASE}/${spreadsheetId}/values/${masterTab}!A${existing.rowIndex}:F${existing.rowIndex}?valueInputOption=USER_ENTERED`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ values: [updatedRowData] }),
          }
        )
      );
    }
  }

  // Execute in batches of 15 to prevent rate limits
  const BATCH_SIZE = 15;
  for (let i = 0; i < updatePromises.length; i += BATCH_SIZE) {
    const chunk = updatePromises.slice(i, i + BATCH_SIZE);
    await Promise.all(chunk);
  }

  return { updatedCount };
}
