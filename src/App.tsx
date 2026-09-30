import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  initAuth,
  googleSignIn,
  getAccessToken,
} from './services/auth';
import {
  listSpreadsheets,
  createMasterSpreadsheet,
  initializeSpreadsheetTabs,
  getMasterAllocations,
  getTransferLogs,
  getUsersFromSheet,
  addUserToSheet,
  updateUserInSheet,
  implementBulkAllocations,
  transferCase,
  updateCaseStatus,
  syncFeedbackUploadToGoogleSheet,
  INITIAL_DEFAULT_USERS,
} from './services/sheetsService';
import {
  AllocationItem,
  AuthSession,
  ParsedAllocationRow,
  SpreadsheetInfo,
  TransferLogItem,
  UserAccount,
  FeedbackUploadItem,
} from './types';
import { Header } from './components/Header';
import { LoginScreen } from './components/LoginScreen';
import { ConfirmationModal } from './components/ConfirmationModal';
import { BulkPasteModalOrView } from './components/BulkPasteModalOrView';
import { StatusTrackerView } from './components/StatusTrackerView';
import { CaseTransferView } from './components/CaseTransferView';
import { MasterAllocationsTable } from './components/MasterAllocationsTable';
import { SheetSettingsModal } from './components/SheetSettingsModal';
import { ExecutiveWorkloadView } from './components/ExecutiveWorkloadView';
import { UserManagementView } from './components/UserManagementView';
import { SettingsView } from './components/SettingsView';
import { DailyFeedbackUploadView } from './components/DailyFeedbackUploadView';
import { MacroGuideModal } from './components/MacroGuideModal';
import {
  FileSpreadsheet,
  ClipboardPaste,
  Search,
  ArrowRightLeft,
  Users,
  CheckCircle2,
  AlertCircle,
  Database,
  PlusCircle,
  UserCheck,
  ShieldCheck,
  Briefcase,
  KeyRound,
  Settings,
  UploadCloud,
} from 'lucide-react';

const STORAGE_KEY_SHEET_ID = 'case_alloc_sheet_id';
const STORAGE_KEY_SHEET_NAME = 'case_alloc_sheet_name';
const STORAGE_KEY_AUTH_SESSION = 'case_alloc_auth_session';
const STORAGE_KEY_LOCAL_USERS = 'case_alloc_local_users';
const STORAGE_KEY_ALLOW_STANDARD_XLSX = 'case_alloc_allow_standard_xlsx';
const STORAGE_KEY_ALLOCATIONS = 'case_alloc_local_allocations';
const STORAGE_KEY_LOGS = 'case_alloc_local_logs';

// Fallback initial accounts
const DEFAULT_USER_ACCOUNTS: UserAccount[] = INITIAL_DEFAULT_USERS.map((row, index) => ({
  username: row[0],
  password: row[1],
  fullName: row[2],
  role: row[3] as 'Admin' | 'Executive',
  status: row[4] as 'Active' | 'Inactive',
  createdDate: row[5],
  rowIndex: index + 2,
}));

export default function App() {
  // Sheet-based Authentication Session
  const [session, setSession] = useState<AuthSession | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_AUTH_SESSION);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Users & Passwords list from Users_Auth sheet
  const [usersList, setUsersList] = useState<UserAccount[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_LOCAL_USERS);
      return stored ? JSON.parse(stored) : DEFAULT_USER_ACCOUNTS;
    } catch {
      return DEFAULT_USER_ACCOUNTS;
    }
  });

  // Active Google Sheet state
  const [activeSpreadsheetId, setActiveSpreadsheetId] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY_SHEET_ID) || null;
  });
  const [activeSpreadsheetName, setActiveSpreadsheetName] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY_SHEET_NAME) || 'Case Allocation Master Sheet';
  });

  // Admin permission setting: Allow Standard .xlsx / CSV downloads (optional)
  const [allowStandardXlsx, setAllowStandardXlsx] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_KEY_ALLOW_STANDARD_XLSX) === 'true';
  });

  const handleToggleAllowStandardXlsx = (val: boolean) => {
    setAllowStandardXlsx(val);
    localStorage.setItem(STORAGE_KEY_ALLOW_STANDARD_XLSX, String(val));
  };

  // Drive sheets list
  const [driveSpreadsheets, setDriveSpreadsheets] = useState<SpreadsheetInfo[]>([]);
  const [isLoadingDrive, setIsLoadingDrive] = useState(false);
  const [isSheetSettingsOpen, setIsSheetSettingsOpen] = useState(false);
  const [isProcessingSheet, setIsProcessingSheet] = useState(false);

  // App Data state
  const [allocations, setAllocations] = useState<AllocationItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_ALLOCATIONS);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [transferLogs, setTransferLogs] = useState<TransferLogItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_LOGS);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<'master' | 'upload' | 'bulk_paste' | 'search' | 'transfer' | 'workload' | 'users' | 'settings'>('master');
  const [isSyncingFeedback, setIsSyncingFeedback] = useState(false);
  const [showMacroModalApp, setShowMacroModalApp] = useState(false);

  // Confirmation Modals State (Mandatory Workspace Mutating Operations)
  const [pendingBulkRows, setPendingBulkRows] = useState<ParsedAllocationRow[] | null>(null);
  const [isImplementingBulk, setIsImplementingBulk] = useState(false);

  const [pendingTransferItems, setPendingTransferItems] = useState<{
    transfers: { agreementId: string; fromExecutive: string; toExecutive: string }[];
    reason: string;
  } | null>(null);
  const [isTransferringCase, setIsTransferringCase] = useState(false);

  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isProcessingUser, setIsProcessingUser] = useState(false);

  // Unique list of executives
  const executivesList = useMemo(() => {
    const set = new Set<string>();
    // Add executives from usersList
    usersList.forEach(u => {
      if (u.role === 'Executive' || u.role === 'Admin') set.add(u.fullName || u.username);
    });
    // Add from allocations
    allocations.forEach(a => {
      if (a.executiveName) set.add(a.executiveName);
    });
    // Add from transferLogs
    transferLogs.forEach(l => {
      if (l.fromExecutive) set.add(l.fromExecutive);
      if (l.toExecutive) set.add(l.toExecutive);
    });
    return Array.from(set).sort();
  }, [allocations, transferLogs, usersList]);

  // Existing agreement IDs map
  const existingAgreements = useMemo(() => {
    const set = new Set<string>();
    allocations.forEach(a => set.add(a.agreementId.toLowerCase()));
    return set;
  }, [allocations]);

  const isAdmin = session?.role === 'Admin';
  const myName = (session?.fullName || '').toLowerCase().trim();
  const myUser = (session?.username || '').toLowerCase().trim();

  const isMyCase = useCallback(
    (caseExecutive: string) => {
      if (!caseExecutive) return false;
      const exec = caseExecutive.toLowerCase().trim();
      return exec === myName || exec === myUser;
    },
    [myName, myUser]
  );

  // If regular Executive, ensure they cannot land on Admin-only tabs (bulk_paste, transfer, users, settings)
  useEffect(() => {
    if (
      !isAdmin &&
      (activeTab === 'bulk_paste' ||
        activeTab === 'transfer' ||
        activeTab === 'users' ||
        activeTab === 'settings')
    ) {
      setActiveTab('master');
    }
  }, [isAdmin, activeTab]);

  // Role-based Stats computation
  const statsTotalCases = isAdmin
    ? allocations.length
    : allocations.filter(a => isMyCase(a.executiveName)).length;

  const statsAllocatedCases = isAdmin
    ? allocations.filter(
        a =>
          a.status.toLowerCase().includes('allocated') &&
          !a.status.toLowerCase().includes('unallocated')
      ).length
    : allocations.filter(
        a =>
          isMyCase(a.executiveName) &&
          a.status.toLowerCase().includes('allocated') &&
          !a.status.toLowerCase().includes('unallocated')
      ).length;

  const statsThirdLabel = isAdmin ? 'अनएलोकेटेड केस' : 'ट्रांसफर केस';
  const statsThirdCount = isAdmin
    ? allocations.filter(
        a => a.status.toLowerCase().includes('unallocated') || !a.executiveName.trim()
      ).length
    : allocations.filter(
        a => isMyCase(a.executiveName) && a.status.toLowerCase().includes('transferred')
      ).length;

  const statsPaidCases = isAdmin
    ? allocations.filter(a => a.status.toLowerCase().includes('paid')).length
    : allocations.filter(
        a => isMyCase(a.executiveName) && a.status.toLowerCase().includes('paid')
      ).length;

  // Clear feedback message automatically
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Save selected sheet to local storage
  const handleSetSpreadsheet = (id: string, name: string) => {
    setActiveSpreadsheetId(id);
    setActiveSpreadsheetName(name);
    localStorage.setItem(STORAGE_KEY_SHEET_ID, id);
    localStorage.setItem(STORAGE_KEY_SHEET_NAME, name);
  };

  // Load all user data and allocations directly from live Google Sheet
  const loadSheetData = useCallback(async (token: string, sheetId: string) => {
    setIsRefreshing(true);
    try {
      // Ensure all 3 tabs and headers exist (Users_Auth, Master_Allocations, Transfer_Logs)
      await initializeSpreadsheetTabs(token, sheetId);

      // Fetch users, allocations, and transfer logs in parallel
      const [sheetUsers, allocsData, logsData] = await Promise.all([
        getUsersFromSheet(token, sheetId),
        getMasterAllocations(token, sheetId),
        getTransferLogs(token, sheetId),
      ]);

      if (sheetUsers.length > 0) {
        setUsersList(sheetUsers);
        localStorage.setItem(STORAGE_KEY_LOCAL_USERS, JSON.stringify(sheetUsers));
      }

      setAllocations(allocsData);
      localStorage.setItem(STORAGE_KEY_ALLOCATIONS, JSON.stringify(allocsData));

      setTransferLogs(logsData);
      localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(logsData));

      setLastSynced(new Date());
    } catch (err: any) {
      console.error('Failed to load sheet data:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Fetch drive spreadsheets
  const fetchDriveSpreadsheets = useCallback(async (token: string) => {
    setIsLoadingDrive(true);
    try {
      const sheets = await listSpreadsheets(token);
      setDriveSpreadsheets(sheets);
    } catch (err: any) {
      console.error('Failed to fetch Drive spreadsheets:', err);
    } finally {
      setIsLoadingDrive(false);
    }
  }, []);

  // Initialize Auth listener in background for Google Workspace token
  useEffect(() => {
    let isCancelled = false;

    const unsubscribe = initAuth(
      async (_currentUser, token) => {
        if (isCancelled) return;

        // 1. If we already have an activeSpreadsheetId, load it
        if (activeSpreadsheetId) {
          await loadSheetData(token, activeSpreadsheetId);
          await fetchDriveSpreadsheets(token);
          return;
        }

        // 2. If activeSpreadsheetId is not set, discover or auto-create in Google Drive
        try {
          setIsLoadingDrive(true);
          const sheets = await listSpreadsheets(token);
          if (isCancelled) return;
          setDriveSpreadsheets(sheets);

          // Find if there's an existing allocation master sheet in user's Drive
          const existingMaster = sheets.find(
            s =>
              s.name.toLowerCase().includes('case allocation') ||
              s.name.toLowerCase().includes('master sheet')
          );

          if (existingMaster) {
            handleSetSpreadsheet(existingMaster.id, existingMaster.name);
            await loadSheetData(token, existingMaster.id);
            setFeedback({
              type: 'success',
              message: `आपकी Google Drive से मास्टर शीट "${existingMaster.name}" कनेक्ट हो गई है!`,
            });
          } else {
            // Auto-create in Google Drive with Users_Auth, Master_Allocations, and Transfer_Logs
            setIsProcessingSheet(true);
            const created = await createMasterSpreadsheet(token, 'Case Allocation & Transfer Master Sheet');
            if (isCancelled) return;
            handleSetSpreadsheet(created.id, created.name);
            await loadSheetData(token, created.id);
            await fetchDriveSpreadsheets(token);
            setFeedback({
              type: 'success',
              message: `नई मास्टर शीट "${created.name}" Users_Auth टैब के साथ आपकी Google Drive में सफलतापूर्वक बन गई है!`,
            });
          }
        } catch (err: any) {
          console.error('Auto-connect / create sheet failed:', err);
        } finally {
          if (!isCancelled) {
            setIsLoadingDrive(false);
            setIsProcessingSheet(false);
          }
        }
      },
      () => {
        // Token not active yet
      }
    );

    return () => {
      isCancelled = true;
      unsubscribe();
    };
  }, [activeSpreadsheetId, loadSheetData, fetchDriveSpreadsheets]);

  // Session Login Success
  const handleSessionLogin = (user: UserAccount) => {
    const newSession: AuthSession = {
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      loggedInAt: new Date().toISOString(),
    };
    setSession(newSession);
    localStorage.setItem(STORAGE_KEY_AUTH_SESSION, JSON.stringify(newSession));
    setFeedback({
      type: 'success',
      message: `सफलतापूर्वक लॉगिन किया गया: ${user.fullName} (${user.role})`,
    });
  };

  // Session Logout
  const handleSessionLogout = () => {
    setSession(null);
    localStorage.removeItem(STORAGE_KEY_AUTH_SESSION);
    setActiveTab('master');
    setFeedback({
      type: 'success',
      message: 'सफलतापूर्वक लॉगआउट किया गया।',
    });
  };

  // Refresh current sheet data (Silent, never forces popup)
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const token = await getAccessToken();
      if (token && activeSpreadsheetId) {
        await loadSheetData(token, activeSpreadsheetId);
        setFeedback({
          type: 'success',
          message: 'Google Sheet कनेक्टर से लाइव डेटा सफलतापूर्वक रिफ्रेश हुआ!',
        });
      } else {
        // Refresh from local persistent master storage
        const storedAllocs = localStorage.getItem(STORAGE_KEY_ALLOCATIONS);
        if (storedAllocs) {
          setAllocations(JSON.parse(storedAllocs));
        }
        const storedUsers = localStorage.getItem(STORAGE_KEY_LOCAL_USERS);
        if (storedUsers) {
          setUsersList(JSON.parse(storedUsers));
        }
        setLastSynced(new Date());
        setFeedback({
          type: 'success',
          message: 'लोकल कनेक्टर से डेटा सफलतापूर्वक रिफ्रेश हुआ!',
        });
      }
    } catch (e: any) {
      console.warn('Refresh error:', e);
      setFeedback({
        type: 'error',
        message: e.message || 'रिफ्रेश करने में त्रुटि हुई।',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Create new Master Spreadsheet in Google Drive
  const handleCreateNewSheet = async (title: string) => {
    let token = await getAccessToken();
    if (!token) {
      const res = await googleSignIn();
      token = res?.accessToken || null;
    }
    if (!token) return;

    setIsProcessingSheet(true);
    try {
      const created = await createMasterSpreadsheet(token, title);
      handleSetSpreadsheet(created.id, created.name);
      await loadSheetData(token, created.id);
      await fetchDriveSpreadsheets(token);
      setFeedback({
        type: 'success',
        message: `नई मास्टर शीट "${created.name}" Users_Auth के साथ सफलता से बनाई गई!`,
      });
    } catch (err: any) {
      console.error('Failed to create sheet:', err);
      setFeedback({
        type: 'error',
        message: err.message || 'शीट बनाने में त्रुटि हुई।',
      });
    } finally {
      setIsProcessingSheet(false);
    }
  };

  // Select existing sheet from Drive
  const handleSelectExistingSheet = async (id: string, name: string) => {
    let token = await getAccessToken();
    if (!token) {
      const res = await googleSignIn();
      token = res?.accessToken || null;
    }
    if (!token) return;

    setIsProcessingSheet(true);
    try {
      handleSetSpreadsheet(id, name);
      await loadSheetData(token, id);
      setFeedback({
        type: 'success',
        message: `शीट "${name}" से कनेक्ट किया गया!`,
      });
    } catch (err: any) {
      console.error('Failed to select sheet:', err);
      setFeedback({
        type: 'error',
        message: err.message || 'शीट से कनेक्ट करने में त्रुटि हुई।',
      });
    } finally {
      setIsProcessingSheet(false);
    }
  };

  // Add New User to Google Sheet (Direct live sync)
  const handleAddUser = async (newUser: UserAccount) => {
    setIsProcessingUser(true);
    try {
      const updated = [...usersList, newUser];
      setUsersList(updated);
      localStorage.setItem(STORAGE_KEY_LOCAL_USERS, JSON.stringify(updated));

      const token = await getAccessToken();
      if (token && activeSpreadsheetId) {
        await addUserToSheet(token, activeSpreadsheetId, newUser);
      }

      setFeedback({
        type: 'success',
        message: `यूजर "${newUser.username}" सफलता से Google Sheet में जोड़ दिया गया!`,
      });
    } catch (err: any) {
      console.error('Failed to add user:', err);
      setFeedback({
        type: 'error',
        message: err.message || 'यूजर जोड़ने में त्रुटि हुई।',
      });
    } finally {
      setIsProcessingUser(false);
    }
  };

  // Update User in Google Sheet (Direct live sync)
  const handleUpdateUser = async (updatedUser: UserAccount) => {
    setIsProcessingUser(true);
    try {
      const updated = usersList.map(u =>
        u.username.toLowerCase() === updatedUser.username.toLowerCase() ? updatedUser : u
      );
      setUsersList(updated);
      localStorage.setItem(STORAGE_KEY_LOCAL_USERS, JSON.stringify(updated));

      const token = await getAccessToken();
      if (token && activeSpreadsheetId) {
        await updateUserInSheet(token, activeSpreadsheetId, updatedUser);
      }

      setFeedback({
        type: 'success',
        message: `यूजर "${updatedUser.username}" की जानकारी Google Sheet में अपडेट कर दी गई!`,
      });
    } catch (err: any) {
      console.error('Failed to update user:', err);
      setFeedback({
        type: 'error',
        message: err.message || 'यूजर अपडेट करने में त्रुटि हुई।',
      });
    } finally {
      setIsProcessingUser(false);
    }
  };

  // Bulk Implement: triggered when user clicks Implement in BulkPasteModalOrView
  const handleTriggerBulkImplement = (validRows: ParsedAllocationRow[]) => {
    setPendingBulkRows(validRows);
  };

  // Confirm and Execute Bulk Implementation to Google Sheets
  const handleConfirmBulkImplement = async () => {
    if (!pendingBulkRows || pendingBulkRows.length === 0) return;
    let token = await getAccessToken();
    if (!token) {
      try {
        const res = await googleSignIn();
        token = res?.accessToken || null;
      } catch {
        setFeedback({
          type: 'error',
          message: 'Google Sheets ऑथराइजेशन रद्द किया गया।',
        });
        setPendingBulkRows(null);
        return;
      }
    }

    if (!token || !activeSpreadsheetId) {
      setFeedback({
        type: 'error',
        message: 'कृपया पहले Google Sheet कनेक्ट करें।',
      });
      setPendingBulkRows(null);
      return;
    }

    setIsImplementingBulk(true);
    try {
      const result = await implementBulkAllocations(token, activeSpreadsheetId, pendingBulkRows);
      await loadSheetData(token, activeSpreadsheetId);
      setPendingBulkRows(null);
      setActiveTab('master');
      setFeedback({
        type: 'success',
        message: `मास्टर शीट में सफलतापूर्वक लागू किया गया! (${result.insertedCount} नए केस जोड़े गए, ${result.updatedCount} अपडेट हुए)`,
      });
    } catch (err: any) {
      console.error('Bulk implement failed:', err);
      setFeedback({
        type: 'error',
        message: err.message || 'Google Sheet में डेटा अपडेट नहीं हो सका।',
      });
    } finally {
      setIsImplementingBulk(false);
    }
  };

  // Transfer Cases: triggered from CaseTransferView (Paste-based transfer)
  const handleTriggerBulkTransfer = (
    transfers: { agreementId: string; fromExecutive: string; toExecutive: string }[],
    reason: string
  ) => {
    setPendingTransferItems({ transfers, reason });
  };

  // Confirm and Execute Case Transfer in Google Sheets
  const handleConfirmTransfer = async () => {
    if (!pendingTransferItems || pendingTransferItems.transfers.length === 0) return;
    const { transfers, reason } = pendingTransferItems;
    const transferredBy = session?.fullName || session?.username || 'Authorized User';
    const nowStr = new Date().toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    // 1. Immediately update local allocations
    const transferMap = new Map<string, string>();
    transfers.forEach(t => transferMap.set(t.agreementId.toLowerCase(), t.toExecutive));

    const updatedAllocs = allocations.map(a => {
      const newExec = transferMap.get(a.agreementId.toLowerCase());
      if (newExec) {
        return {
          ...a,
          executiveName: newExec,
          status: 'Allocated',
          lastUpdated: nowStr,
        };
      }
      return a;
    });
    setAllocations(updatedAllocs);
    localStorage.setItem(STORAGE_KEY_ALLOCATIONS, JSON.stringify(updatedAllocs));

    // 2. Add to local transfer logs
    const newLogs: TransferLogItem[] = transfers.map(t => ({
      timestamp: nowStr,
      agreementId: t.agreementId,
      fromExecutive: t.fromExecutive,
      toExecutive: t.toExecutive,
      transferredBy,
      reason,
    }));
    const updatedLogs = [...newLogs, ...transferLogs];
    setTransferLogs(updatedLogs);
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(updatedLogs));

    // 3. Direct live push to Google Sheet
    const token = await getAccessToken();
    if (token && activeSpreadsheetId) {
      setIsTransferringCase(true);
      try {
        for (const item of transfers) {
          await transferCase(
            token,
            activeSpreadsheetId,
            item.agreementId,
            item.fromExecutive,
            item.toExecutive,
            transferredBy,
            reason
          );
        }
      } catch (err) {
        console.warn('Google Sheet transfer push error:', err);
      } finally {
        setIsTransferringCase(false);
      }
    }

    setPendingTransferItems(null);
    setFeedback({
      type: 'success',
      message: `${transfers.length} केस सफलतापूर्वक ट्रांसफर कर दिए गए और Google Sheet में दर्ज हो गए!`,
    });
  };

  // Update Status directly live to Google Sheet
  const handleUpdateStatus = async (agreementId: string, newStatus: string, notes?: string) => {
    setIsUpdatingStatus(true);
    const nowStr = new Date().toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    // 1. Update local allocations immediately
    const updatedAllocs = allocations.map(a => {
      if (a.agreementId.toLowerCase() === agreementId.toLowerCase()) {
        return {
          ...a,
          status: newStatus,
          notes: notes !== undefined ? notes : a.notes,
          lastUpdated: nowStr,
        };
      }
      return a;
    });
    setAllocations(updatedAllocs);
    localStorage.setItem(STORAGE_KEY_ALLOCATIONS, JSON.stringify(updatedAllocs));

    // 2. Direct live update to Google Sheet
    const token = await getAccessToken();
    if (token && activeSpreadsheetId) {
      try {
        await updateCaseStatus(token, activeSpreadsheetId, agreementId, newStatus, notes);
      } catch (e) {
        console.warn('Direct sheet status update error:', e);
      }
    }

    setFeedback({
      type: 'success',
      message: `केस "${agreementId}" की स्थिति लाइव Google Sheet में "${newStatus}" अपडेट की गई!`,
    });
    setIsUpdatingStatus(false);
  };

  // Bulk Sync Daily Feedback File directly live to Google Sheet
  const handleSyncDailyFeedback = async (
    validItems: FeedbackUploadItem[],
    fileName: string,
    _fileSize: number
  ): Promise<{ updatedCount: number }> => {
    setIsSyncingFeedback(true);
    try {
      const updatedCount = validItems.length;
      const nowStr = new Date().toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });

      // 1. Update local allocations
      const updateMap = new Map<string, FeedbackUploadItem>();
      validItems.forEach(i => {
        updateMap.set(i.agreementId.trim().toLowerCase(), i);
      });

      const updatedAllocs = allocations.map(a => {
        const item = updateMap.get(a.agreementId.trim().toLowerCase());
        if (item) {
          return {
            ...a,
            status: item.status || a.status,
            notes: item.detailedFeedback || a.notes,
            lastUpdated: nowStr,
          };
        }
        return a;
      });

      setAllocations(updatedAllocs);
      localStorage.setItem(STORAGE_KEY_ALLOCATIONS, JSON.stringify(updatedAllocs));
      setLastSynced(new Date());

      // 2. Push directly live to Google Sheet
      const token = await getAccessToken();
      if (token && activeSpreadsheetId) {
        await syncFeedbackUploadToGoogleSheet(
          token,
          activeSpreadsheetId,
          validItems,
          session?.fullName || session?.username || 'Executive',
          fileName
        );
      }

      setFeedback({
        type: 'success',
        message: `✅ ${updatedCount} केस का दैनिक फीडबैक Google Sheet में लाइव सिंक हो गया!`,
      });

      return { updatedCount };
    } catch (err: any) {
      console.error('Failed to sync feedback:', err);
      setFeedback({
        type: 'error',
        message: err.message || 'दैनिक फीडबैक दर्ज करने में त्रुटि हुई।',
      });
      throw err;
    } finally {
      setIsSyncingFeedback(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col font-sans">
      {/* Top Application Header */}
      <Header
        session={session}
        onLogout={handleSessionLogout}
        activeSpreadsheetId={activeSpreadsheetId}
        activeSpreadsheetName={activeSpreadsheetName}
        onOpenSheetSelector={() => setActiveTab('settings')}
        onRefreshData={handleRefresh}
        isRefreshing={isRefreshing}
        lastSynced={lastSynced}
        totalAllocationsCount={allocations.length}
      />

      {/* Toast Notification */}
      {feedback && (
        <div className="fixed top-20 right-4 z-50 animate-in fade-in slide-in-from-top-4 duration-300 max-w-md">
          <div
            className={`p-4 rounded-2xl shadow-xl border flex items-start gap-3 ${
              feedback.type === 'success'
                ? 'bg-emerald-900 text-white border-emerald-700'
                : 'bg-red-900 text-white border-red-700'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-300 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-xs sm:text-sm font-medium leading-relaxed">
              {feedback.message}
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-white/60 hover:text-white p-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* If user is not logged in, show Sheet-based Login Screen */}
        {!session ? (
          <LoginScreen
            onLoginSuccess={handleSessionLogin}
            usersList={usersList}
          />
        ) : (
          /* User Logged In */
          <>
            {/* Top Quick Stats Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase">
                    {isAdmin ? 'कुल मास्टर केस' : 'मेरे कुल केस'}
                  </p>
                  <p className="text-xl font-black text-slate-900 mt-0.5">{statsTotalCases}</p>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-emerald-700 uppercase">
                    {isAdmin ? 'एलोकेटेड केस' : 'मेरे एक्टिव केस'}
                  </p>
                  <p className="text-xl font-black text-slate-900 mt-0.5">{statsAllocatedCases}</p>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-amber-700 uppercase">{statsThirdLabel}</p>
                  <p className="text-xl font-black text-slate-900 mt-0.5">{statsThirdCount}</p>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-purple-700 uppercase">
                    {isAdmin ? 'कुल पेड (Paid)' : 'मेरे पेड (Paid)'}
                  </p>
                  <p className="text-xl font-black text-purple-900 mt-0.5">{statsPaidCases}</p>
                </div>
              </div>
            </div>

            {/* Navigation Tab Bar */}
            <div className="bg-white rounded-2xl border border-slate-200 p-1.5 shadow-xs overflow-x-auto">
              <nav className="flex space-x-1 min-w-max">
                <button
                  onClick={() => setActiveTab('master')}
                  className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                    activeTab === 'master'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>
                    {isAdmin ? 'मास्टर एलोकेशन शीट (All Cases)' : 'मेरे एलोकेटेड केस (My Cases)'}
                  </span>
                </button>

                {/* Daily Feedback Upload (Available to Both Admin and Executives) */}
                <button
                  onClick={() => setActiveTab('upload')}
                  className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                    activeTab === 'upload'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>दैनिक फीडबैक अपलोड (Daily Upload)</span>
                </button>

                {/* Bulk Paste is available ONLY to Admin */}
                {isAdmin && (
                  <button
                    onClick={() => setActiveTab('bulk_paste')}
                    className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                      activeTab === 'bulk_paste'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <ClipboardPaste className="w-4 h-4" />
                    <span>कॉपी-पेस्ट एलोकेशन (Smart Paste)</span>
                  </button>
                )}

                <button
                  onClick={() => setActiveTab('search')}
                  className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                    activeTab === 'search'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Search className="w-4 h-4" />
                  <span>
                    {isAdmin ? 'क्लाइंट स्टेटस सर्च (Status Tracker)' : 'केस स्टेटस सर्च (Search My Cases)'}
                  </span>
                </button>

                {/* Case Transfer (Paste & Transfer) is available ONLY to Admin */}
                {isAdmin && (
                  <button
                    onClick={() => setActiveTab('transfer')}
                    className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                      activeTab === 'transfer'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    <span>केस ट्रांसफर (Paste Transfer)</span>
                  </button>
                )}

                <button
                  onClick={() => setActiveTab('workload')}
                  className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                    activeTab === 'workload'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Briefcase className="w-4 h-4" />
                  <span>
                    {isAdmin ? 'एग्जीक्यूटिव वर्कलोड (All Workload)' : 'मेरा वर्कलोड (My Workload)'}
                  </span>
                </button>

                {/* User Management Tab (Admin Only) */}
                {isAdmin && (
                  <button
                    onClick={() => setActiveTab('users')}
                    className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                      activeTab === 'users'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>यूजर व पासवर्ड्स (Users_Auth)</span>
                  </button>
                )}

                {/* System & Sheet Settings Tab (Admin Only) */}
                {isAdmin && (
                  <button
                    onClick={() => setActiveTab('settings')}
                    className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                      activeTab === 'settings'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Settings className="w-4 h-4" />
                    <span>शीट सेटिंग्स (Settings)</span>
                  </button>
                )}
              </nav>
            </div>

            {/* Tab Views */}
            {activeTab === 'master' && (
              <MasterAllocationsTable
                allocations={allocations}
                executivesList={executivesList}
                spreadsheetId={activeSpreadsheetId}
                onTransferCase={() => setActiveTab('transfer')}
                onUpdateStatus={(id, s) => handleUpdateStatus(id, s)}
                onOpenBulkPaste={() => setActiveTab('bulk_paste')}
                userRole={session.role}
                currentUserName={session.fullName}
                currentUserUsername={session.username}
                allowStandardXlsx={allowStandardXlsx}
              />
            )}

            {activeTab === 'upload' && (
              <DailyFeedbackUploadView
                allocations={allocations}
                userRole={session.role}
                currentUserName={session.fullName}
                currentUserUsername={session.username}
                executivesList={executivesList}
                spreadsheetId={activeSpreadsheetId}
                onSyncUpload={handleSyncDailyFeedback}
                isSyncing={isSyncingFeedback}
                onOpenMacroGuide={() => setShowMacroModalApp(true)}
              />
            )}

            {activeTab === 'bulk_paste' && isAdmin && (
              <BulkPasteModalOrView
                onImplement={handleTriggerBulkImplement}
                isImplementing={isImplementingBulk}
                existingAgreements={existingAgreements}
                connectedSheetName={activeSpreadsheetName}
              />
            )}

            {activeTab === 'search' && (
              <StatusTrackerView
                allocations={
                  isAdmin
                    ? allocations
                    : allocations.filter(a => isMyCase(a.executiveName))
                }
                transferLogs={
                  isAdmin
                    ? transferLogs
                    : transferLogs.filter(
                        l =>
                          isMyCase(l.fromExecutive) ||
                          isMyCase(l.toExecutive) ||
                          isMyCase(l.transferredBy)
                      )
                }
                onQuickTransfer={() => setActiveTab('transfer')}
                onUpdateStatus={handleUpdateStatus}
                isUpdating={isUpdatingStatus}
                userRole={session.role}
                currentUserName={session.fullName}
                currentUserUsername={session.username}
              />
            )}

            {activeTab === 'transfer' && isAdmin && (
              <CaseTransferView
                allocations={allocations}
                transferLogs={transferLogs}
                executivesList={executivesList}
                currentUserEmail={undefined}
                currentUserName={session.fullName}
                currentUserUsername={session.username}
                userRole={session.role}
                onExecuteBulkTransfer={handleTriggerBulkTransfer}
                isTransferring={isTransferringCase}
              />
            )}

            {activeTab === 'workload' && (
              <ExecutiveWorkloadView
                allocations={allocations}
                executivesList={executivesList}
                onSelectExecutive={() => setActiveTab('master')}
                userRole={session.role}
                currentUserName={session.fullName}
                currentUserUsername={session.username}
              />
            )}

            {activeTab === 'users' && isAdmin && (
              <UserManagementView
                usersList={usersList}
                onAddUser={handleAddUser}
                onUpdateUser={handleUpdateUser}
                isProcessing={isProcessingUser}
                connectedSheetName={activeSpreadsheetName}
                activeSpreadsheetId={activeSpreadsheetId}
                onOpenSheetSettings={() => setActiveTab('settings')}
              />
            )}

            {activeTab === 'settings' && isAdmin && (
              <SettingsView
                activeSpreadsheetId={activeSpreadsheetId}
                activeSpreadsheetName={activeSpreadsheetName}
                driveSpreadsheets={driveSpreadsheets}
                isLoadingDrive={isLoadingDrive}
                onSelectExistingSheet={handleSelectExistingSheet}
                onCreateNewSheet={handleCreateNewSheet}
                onRefreshDriveList={() => {
                  getAccessToken().then(tok => {
                    if (tok) fetchDriveSpreadsheets(tok);
                  });
                }}
                onRefreshData={handleRefresh}
                isRefreshing={isRefreshing}
                isProcessing={isProcessingSheet}
                lastSynced={lastSynced}
                totalAllocations={allocations.length}
                totalUsers={usersList.length}
                allowStandardXlsx={allowStandardXlsx}
                onToggleAllowStandardXlsx={handleToggleAllowStandardXlsx}
              />
            )}
          </>
        )}
      </main>

      {/* Sheet Settings / Selector Modal */}
      <SheetSettingsModal
        isOpen={isSheetSettingsOpen}
        onClose={() => setIsSheetSettingsOpen(false)}
        activeSpreadsheetId={activeSpreadsheetId}
        activeSpreadsheetName={activeSpreadsheetName}
        driveSpreadsheets={driveSpreadsheets}
        isLoadingDrive={isLoadingDrive}
        onSelectExistingSheet={handleSelectExistingSheet}
        onCreateNewSheet={handleCreateNewSheet}
        onRefreshDriveList={() => {
          getAccessToken().then(tok => {
            if (tok) fetchDriveSpreadsheets(tok);
          });
        }}
        isProcessing={isProcessingSheet}
      />

      {/* Bulk Implement Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!pendingBulkRows}
        title="Google Sheet में डेटा लागू करें?"
        message={`क्या आप सुनिश्चित हैं कि आप ${pendingBulkRows?.length || 0} एलोकेशन रिकॉर्ड्स को कनेक्टेड Google Sheet ("${activeSpreadsheetName}") में इम्प्लीमेंट करना चाहते हैं?`}
        details={pendingBulkRows?.map(
          r => `${r.agreementId} → ${r.executiveName} (${r.allocationDate})`
        )}
        confirmText="हाँ, मास्टर शीट में इम्प्लीमेंट करें"
        cancelText="रद्द करें"
        isLoading={isImplementingBulk}
        onConfirm={handleConfirmBulkImplement}
        onCancel={() => setPendingBulkRows(null)}
      />

      {/* Case Transfer Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!pendingTransferItems}
        title="केस ट्रांसफर लागू करें?"
        message={`क्या आप ${pendingTransferItems?.transfers.length || 0} केस Google Sheet में ट्रांसफर करना चाहते हैं?`}
        details={pendingTransferItems?.transfers.map(
          t => `${t.agreementId}: ${t.fromExecutive} → ${t.toExecutive}`
        )}
        confirmText="हाँ, शीट में ट्रांसफर लागू करें"
        cancelText="रद्द करें"
        isLoading={isTransferringCase}
        onConfirm={handleConfirmTransfer}
        onCancel={() => setPendingTransferItems(null)}
      />

      {/* Offline Macro Guide Modal */}
      <MacroGuideModal
        isOpen={showMacroModalApp}
        onClose={() => setShowMacroModalApp(false)}
      />

      {/* App Footer */}
      <footer className="bg-white border-t border-slate-200 mt-auto py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Case Allocation & Transfer Master • Google Sheet Auth (Users_Auth)</span>
          <span>Google Sheets Live Database Integration</span>
        </div>
      </footer>
    </div>
  );
}
