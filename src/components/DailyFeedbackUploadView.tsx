import React, { useState, useMemo, useRef } from 'react';
import { AllocationItem, FeedbackUploadItem, FeedbackUploadBatchLog } from '../types';
import {
  parseFeedbackExcelFile,
  ParseFeedbackResult,
  FormatErrorItem,
} from '../services/feedbackUploadService';
import { exportBlankTemplateWithValidation } from '../services/excelExportService';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  ShieldCheck,
  Check,
  Search,
  Filter,
  RefreshCw,
  User,
  Calendar,
  Lock,
  History,
  FileCode,
  Sparkles,
  ArrowRight,
  TrendingUp,
  XCircle,
  HelpCircle,
  Download,
  FileDown,
  AlertOctagon,
  Info,
} from 'lucide-react';

interface DailyFeedbackUploadViewProps {
  allocations: AllocationItem[];
  userRole?: 'Admin' | 'Executive';
  currentUserName: string;
  currentUserUsername: string;
  executivesList: string[];
  spreadsheetId: string | null;
  onSyncUpload: (
    validItems: FeedbackUploadItem[],
    fileName: string,
    fileSize: number
  ) => Promise<{ updatedCount: number }>;
  isSyncing: boolean;
  onOpenMacroGuide?: () => void;
}

const STORAGE_KEY_UPLOAD_LOGS = 'case_alloc_upload_batch_logs';

/**
 * Generates and triggers download of a detailed text error report
 * that executives can open to fix specific cell errors in their offline Excel file.
 */
function downloadErrorReportText(result: ParseFeedbackResult, uploaderName: string) {
  let content = `================================================================================\n`;
  content += `           CASE ALLOCATION PORTAL - DAILY FEEDBACK FORMAT ERROR REPORT\n`;
  content += `================================================================================\n\n`;
  content += `File Name:         ${result.fileName}\n`;
  content += `Uploaded By:       ${uploaderName}\n`;
  content += `Generated At:      ${new Date().toLocaleString('en-IN')}\n`;
  content += `Total Cases:       ${result.totalCases}\n`;
  content += `Valid Cases:       ${result.validCount}\n`;
  content += `Total Errors:      ${result.formatErrors.length}\n`;
  content += `Header Valid:      ${result.headerValidation.isValid ? 'YES' : 'NO (Headers Mismatched)'}\n\n`;

  if (!result.headerValidation.isValid) {
    content += `CRITICAL HEADER ERRORS:\n`;
    result.headerValidation.missingHeaders.forEach(h => {
      content += `  • Missing / Mismatched: ${h}\n`;
    });
    content += `\n`;
  }

  content += `--------------------------------------------------------------------------------\n`;
  content += `DETAILED ROW-BY-ROW FORMAT ERRORS (WHAT TO FIX IN EXCEL):\n`;
  content += `--------------------------------------------------------------------------------\n\n`;

  result.formatErrors.forEach((err, idx) => {
    content += `[Error #${idx + 1}]\n`;
    if (err.rowNumber) content += `  • Excel Row:       Row ${err.rowNumber}\n`;
    if (err.agreementId) content += `  • Agreement ID:    ${err.agreementId}\n`;
    content += `  • Column:          ${err.columnName}\n`;
    content += `  • Found Value:     "${err.foundValue}"\n`;
    content += `  • Expected Format: ${err.expectedFormat}\n`;
    content += `  • Problem / Fix:   ${err.message}\n\n`;
  });

  content += `================================================================================\n`;
  content += `HOW TO FIX IN EXCEL:\n`;
  content += `1. Open your Excel file (${result.fileName}).\n`;
  content += `2. Go to the specified row and column cells above.\n`;
  content += `3. Replace invalid values with standard dropdown options (Yes, No, PTP, RNR, etc.).\n`;
  content += `4. Ensure each feedback timestamp has distinct seconds (no bulk copy-paste).\n`;
  content += `5. Save and re-upload the file.\n`;
  content += `================================================================================\n`;

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Format_Errors_${result.fileName.replace(/\.[^/.]+$/, '')}_${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

export const DailyFeedbackUploadView: React.FC<DailyFeedbackUploadViewProps> = ({
  allocations,
  userRole = 'Admin',
  currentUserName,
  currentUserUsername,
  executivesList,
  spreadsheetId,
  onSyncUpload,
  isSyncing,
  onOpenMacroGuide,
}) => {
  const isAdmin = userRole === 'Admin';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseFeedbackResult | null>(null);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);

  // Filter tabs for parsed preview
  const [tableFilter, setTableFilter] = useState<'all' | 'valid' | 'errors'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Upload Batch History Logs (Persisted in localStorage)
  const [uploadLogs, setUploadLogs] = useState<FeedbackUploadBatchLog[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_UPLOAD_LOGS);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Calculate my currently assigned cases
  const myAssignedCases = useMemo(() => {
    if (isAdmin) return allocations;
    const name = currentUserName.toLowerCase();
    const uname = currentUserUsername.toLowerCase();
    return allocations.filter(
      a =>
        a.executiveName.toLowerCase() === name ||
        a.executiveName.toLowerCase() === uname ||
        a.executiveName.toLowerCase().includes(name) ||
        name.includes(a.executiveName.toLowerCase())
    );
  }, [allocations, isAdmin, currentUserName, currentUserUsername]);

  // Executive Submission Status for today (Admin View)
  const todayDateStr = new Date().toISOString().split('T')[0];
  const executiveSubmissionStatus = useMemo(() => {
    return executivesList.map(exec => {
      const execLogs = uploadLogs.filter(
        l =>
          (l.executiveName?.toLowerCase() === exec.toLowerCase() ||
            l.uploadedBy?.toLowerCase() === exec.toLowerCase()) &&
          l.timestamp.startsWith(todayDateStr)
      );
      const isSubmitted = execLogs.length > 0;
      const totalUpdatedToday = execLogs.reduce((acc, l) => acc + l.updatedCount, 0);
      const latestLog = execLogs[0];

      return {
        executiveName: exec,
        isSubmitted,
        totalUpdatedToday,
        latestTime: latestLog ? latestLog.timestamp.split(' ')[1] : null,
      };
    });
  }, [executivesList, uploadLogs, todayDateStr]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const processFile = async (file: File) => {
    setParseError(null);
    setSyncSuccessMsg(null);

    const name = file.name.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xlsm') && !name.endsWith('.xls')) {
      setParseError('कृपया केवल Excel (.xlsx या .xlsm) फ़ाइल अपलोड करें।');
      return;
    }

    try {
      setIsParsing(true);
      const result = await parseFeedbackExcelFile(
        file,
        userRole,
        currentUserName,
        currentUserUsername,
        allocations
      );
      setParseResult(result);
      // If there are format errors, automatically switch tab to 'errors' so executive sees them first!
      if (result.formatErrors.length > 0) {
        setTableFilter('errors');
      } else {
        setTableFilter('all');
      }
    } catch (err: any) {
      console.error('Error parsing feedback file:', err);
      setParseError(err.message || 'फ़ाइल को पढ़ने में त्रुटि हुई। कृपया फ़ाइल की संरचना जांचें।');
      setParseResult(null);
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleConfirmSync = async () => {
    if (!parseResult || parseResult.validItems.length === 0) return;

    try {
      const res = await onSyncUpload(
        parseResult.validItems,
        parseResult.fileName,
        parseResult.fileSize
      );

      // Record in Upload Batch History
      const newLog: FeedbackUploadBatchLog = {
        id: `LOG-${Date.now().toString().slice(-6)}`,
        timestamp: new Date().toLocaleString('en-IN', {
          dateStyle: 'short',
          timeStyle: 'medium',
        }),
        uploadedBy: currentUserName,
        executiveName: currentUserName,
        fileName: parseResult.fileName,
        totalCases: parseResult.totalCases,
        updatedCount: res.updatedCount,
        statusBreakdown: parseResult.statusBreakdown,
        auditStatus: `${parseResult.auditSummary.complianceScore}% Unique Seconds`,
      };

      const updatedLogs = [newLog, ...uploadLogs].slice(0, 50);
      setUploadLogs(updatedLogs);
      localStorage.setItem(STORAGE_KEY_UPLOAD_LOGS, JSON.stringify(updatedLogs));

      setSyncSuccessMsg(
        `सफलता! ${res.updatedCount} केस का फीडबैक और स्टेटस मास्टर शीट में सफलतापूर्वक सिंक हो गया है।`
      );
      setParseResult(null);
    } catch (err: any) {
      setParseError(err.message || 'मास्टर शीट में सिंक करने में त्रुटि हुई।');
    }
  };

  const handleDownloadBlankTemplate = async () => {
    try {
      setIsDownloadingTemplate(true);
      await exportBlankTemplateWithValidation();
    } catch (err) {
      console.error('Error downloading template:', err);
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const handleReset = () => {
    setParseResult(null);
    setParseError(null);
    setSyncSuccessMsg(null);
  };

  // Grouped format errors count
  const errorStats = useMemo(() => {
    if (!parseResult) return { header: 0, dropdown: 0, timestamp: 0, duplicate: 0, unassigned: 0 };
    const errs = parseResult.formatErrors;
    return {
      header: errs.filter(e => e.errorType === 'CRITICAL_HEADER_MISMATCH' || e.errorType === 'MISSING_REQUIRED_SHEET').length,
      dropdown: errs.filter(e => e.errorType === 'INVALID_DROPDOWN_OPTION' || e.errorType === 'MISSING_REQUIRED_FIELD').length,
      timestamp: errs.filter(e => e.errorType === 'INVALID_TIMESTAMP_FORMAT').length,
      duplicate: errs.filter(e => e.errorType === 'DUPLICATE_TIMESTAMP').length,
      unassigned: errs.filter(e => e.errorType === 'UNASSIGNED_CASE').length,
    };
  }, [parseResult]);

  // Filtered rows for the preview table
  const displayedItems = useMemo(() => {
    if (!parseResult) return [];
    let list = parseResult.items;

    if (tableFilter === 'valid') {
      list = list.filter(i => i.isValid);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        i =>
          i.agreementId.toLowerCase().includes(q) ||
          i.status.toLowerCase().includes(q) ||
          i.detailedFeedback.toLowerCase().includes(q)
      );
    }

    return list;
  }, [parseResult, tableFilter, searchQuery]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Hidden file input always available in DOM */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xlsm,.xls"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Top Banner / Role Greeting */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold">
              <UploadCloud className="w-4 h-4 text-emerald-200" />
              <span>दैनिक कॉलिंग फीडबैक इनजेशन (Daily Intake)</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              दैनिक फीडबैक फ़ाइल अपलोड
            </h2>
            <p className="text-emerald-100 text-xs sm:text-sm max-w-2xl leading-relaxed">
              {isAdmin
                ? 'एडमिन पोर्टल: सभी एग्जीक्यूटिव्स की कॉलिंग फाइल्स अपलोड करें या उनकी दैनिक सबमिशन प्रगति मॉनिटर करें।'
                : `नमस्ते ${currentUserName}! दिनभर का कॉलिंग फीडबैक दर्ज करने के बाद अपनी Excel (.xlsx या .xlsm) फ़ाइल यहाँ अपलोड करें।`}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/20 text-center">
              <span className="block text-[11px] text-emerald-200 uppercase font-semibold">
                {isAdmin ? 'कुल मास्टर केस' : 'आपके आवंटित केस'}
              </span>
              <span className="text-xl font-black">{myAssignedCases.length}</span>
            </div>

            <button
              type="button"
              onClick={handleDownloadBlankTemplate}
              disabled={isDownloadingTemplate}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs rounded-2xl shadow-lg transition-all flex items-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4 text-white" />
              <span>{isDownloadingTemplate ? 'डाउनलोड हो रहा है...' : 'खाली मैक्रो टेम्पलेट (.xlsm)'}</span>
            </button>

            {onOpenMacroGuide && (
              <button
                type="button"
                onClick={onOpenMacroGuide}
                className="px-4 py-2.5 bg-white text-slate-900 hover:bg-slate-100 font-bold text-xs rounded-2xl shadow-lg transition-all flex items-center gap-2 cursor-pointer shrink-0"
              >
                <FileCode className="w-4 h-4 text-purple-600" />
                <span>मैक्रो (.xlsm) गाइड ↗</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Admin Executive Daily Submission Tracker (Admin Only) */}
      {isAdmin && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">
                आज का एग्जीक्यूटिव अपलोड स्टेटस ({todayDateStr})
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              कुल एग्जीक्यूटिव्स: <strong>{executivesList.length}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {executiveSubmissionStatus.map((exec, idx) => (
              <div
                key={idx}
                className={`p-3.5 rounded-xl border transition-all text-xs space-y-1.5 ${
                  exec.isSubmitted
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                    : 'bg-amber-50/60 border-amber-200 text-amber-950'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold truncate">{exec.executiveName}</span>
                  {exec.isSubmitted ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  )}
                </div>
                <div className="text-[11px] text-slate-600 flex items-center justify-between">
                  <span>
                    {exec.isSubmitted
                      ? `✅ ${exec.totalUpdatedToday} केस अपडेट किए`
                      : '⏳ आज की फ़ाइल पेंडिंग'}
                  </span>
                  {exec.latestTime && (
                    <span className="text-slate-400 font-mono text-[10px]">
                      {exec.latestTime}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feedback Messages */}
      {syncSuccessMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl flex items-center justify-between text-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-semibold">{syncSuccessMsg}</span>
          </div>
          <button
            onClick={() => setSyncSuccessMsg(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {parseError && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl flex items-center justify-between text-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="font-semibold">{parseError}</span>
          </div>
          <button
            onClick={() => setParseError(null)}
            className="text-rose-700 hover:text-rose-900 font-bold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Upload Dropzone Section (Hidden when a file is currently parsed & pending sync) */}
      {!parseResult && (
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-white hover:bg-emerald-50/30 rounded-3xl p-8 sm:p-12 text-center transition-all cursor-pointer group shadow-xs space-y-4"
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 group-hover:bg-emerald-200 text-emerald-700 mx-auto flex items-center justify-center transition-colors shadow-xs">
            {isParsing ? (
              <RefreshCw className="w-8 h-8 animate-spin" />
            ) : (
              <UploadCloud className="w-8 h-8" />
            )}
          </div>

          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-base sm:text-lg font-bold text-slate-800">
              {isParsing
                ? 'फ़ाइल पढ़ी और फ़ॉर्मेट जांची जा रही है...'
                : 'अपनी दैनिक फीडबैक Excel / मैक्रो फ़ाइल यहाँ छोड़ें'}
            </h3>
            <p className="text-xs text-slate-500">
              क्लिक करके चुनें या फ़ाइल को ड्रैग-एंड-ड्रॉप करें। समर्थित फ़ाइलें: <strong>.xlsx</strong>, <strong>.xlsm</strong>
            </p>
          </div>

          {/* Guidelines Badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-[11px] text-slate-600">
            <span className="px-2.5 py-1 bg-slate-100 rounded-full border border-slate-200 flex items-center gap-1">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              मानक विकल्प सत्यापन (PTP, RNR, CB, Yes, No...)
            </span>
            <span className="px-2.5 py-1 bg-slate-100 rounded-full border border-slate-200 flex items-center gap-1">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              ऑटो-टाइमस्टैम्प जांच (सेकंड्स भिन्न नियम)
            </span>
            <span className="px-2.5 py-1 bg-slate-100 rounded-full border border-slate-200 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              केस असाइनमेंट सत्यापन
            </span>
          </div>
        </div>
      )}

      {/* Parse Result & Live Validation Preview */}
      {parseResult && (
        <div className="space-y-5 animate-in fade-in duration-300">
          {/* File Card & Overview Stats */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-bold text-slate-900">{parseResult.fileName}</h4>
                    {parseResult.isFormatValid ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        ✅ 100% वैध फ़ॉर्मेट
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        <span>{parseResult.formatErrors.length} फ़ॉर्मेट त्रुटियां</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    आकार: {(parseResult.fileSize / 1024).toFixed(1)} KB • कुल केस: <strong>{parseResult.totalCases}</strong> • वैध: <strong>{parseResult.validCount}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isSyncing}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  फ़ाइल हटाएं (Reset)
                </button>

                {parseResult.formatErrors.length > 0 ? (
                  <>
                    <button
                      type="button"
                      disabled={true}
                      className="px-4 py-2 bg-rose-100 text-rose-700 border border-rose-300 text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-not-allowed opacity-90"
                      title="फ़ाइल में त्रुटियां मौजूद हैं। पहले सभी त्रुटियां ठीक करके सही फ़ाइल दोबारा अपलोड करें।"
                    >
                      <Lock className="w-4 h-4 text-rose-600" />
                      <span>⛔ सिंक अवरुद्ध ({parseResult.formatErrors.length} त्रुटियां ठीक करें)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
                    >
                      <UploadCloud className="w-4 h-4" />
                      <span>सुधारी गई फ़ाइल अपलोड करें</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleConfirmSync}
                    disabled={
                      isSyncing ||
                      parseResult.validCount === 0 ||
                      !parseResult.headerValidation.isValid
                    }
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSyncing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>सिंक हो रहा है...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>✅ सभी {parseResult.validCount} केस मास्टर में सिंक करें</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                <span className="text-slate-500 block text-[11px] font-semibold">वैध केस (Ready)</span>
                <span className="text-2xl font-black text-emerald-700">{parseResult.validCount}</span>
                <span className="text-[10px] text-emerald-600 block mt-0.5">मास्टर में अपडेट होंगे</span>
              </div>

              <div className="p-3.5 bg-teal-50/70 border border-teal-200 rounded-xl">
                <span className="text-slate-500 block text-[11px] font-semibold">
                  एंटी-बल्क टाइम स्कोर
                </span>
                <span className="text-2xl font-black text-teal-700">
                  {parseResult.auditSummary.complianceScore}%
                </span>
                <span className="text-[10px] text-teal-600 block mt-0.5">
                  {parseResult.auditSummary.staggeredUniqueCount} सेकंड्स यूनिक
                </span>
              </div>

              <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-xl">
                <span className="text-slate-500 block text-[11px] font-semibold">फ़ॉर्मेट त्रुटियां</span>
                <span className="text-2xl font-black text-rose-700">
                  {parseResult.formatErrors.length}
                </span>
                <span className="text-[10px] text-rose-600 block mt-0.5">
                  {parseResult.formatErrors.length === 0 ? 'शून्य एरर (Pass)' : 'सुधार की आवश्यकता'}
                </span>
              </div>

              <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-xl">
                <span className="text-slate-500 block text-[11px] font-semibold">हिस्ट्री रिकॉर्ड्स</span>
                <span className="text-2xl font-black text-purple-700">
                  {parseResult.historyLogsCount || parseResult.totalCases}
                </span>
                <span className="text-[10px] text-purple-600 block mt-0.5">ऑडिट राउंड्स लॉग</span>
              </div>
            </div>

            {/* Status Breakdown Bar */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <span className="text-[11px] font-bold text-slate-700 block">
                स्टेटस वितरण (Status Breakdown in Uploaded File):
              </span>
              <div className="flex flex-wrap gap-2">
                {Object.entries(parseResult.statusBreakdown).map(([status, count]) => (
                  <span
                    key={status}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 shadow-2xs"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>{status}:</span>
                    <strong className="text-emerald-700">{count}</strong>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* PROMINENT FORMAT ERROR REPORT ALERT CARD (IF ERRORS EXIST) */}
          {parseResult.formatErrors.length > 0 && (
            <div className="p-5 bg-rose-50 border-2 border-rose-300 rounded-2xl space-y-4 shadow-sm animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-rose-600 text-white rounded-xl shrink-0 mt-0.5">
                    <AlertOctagon className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-rose-950 flex items-center gap-2">
                      <span>फ़ाइल में {parseResult.formatErrors.length} फ़ॉर्मेट त्रुटियां मिलीं (Format Errors Detected)</span>
                    </h4>
                    <p className="text-xs text-rose-800 mt-0.5 leading-relaxed">
                      अपलोड की गई फ़ाइल में कुछ सेल्स या मान मानक फ़ॉर्मेट के अनुसार नहीं हैं। कृपया नीचे दिए गए एरर विवरण को ठीक करें।
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => downloadErrorReportText(parseResult, currentUserName)}
                    className="px-3.5 py-2 bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>त्रुटि रिपोर्ट (.txt) डाउनलोड करें</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadBlankTemplate}
                    disabled={isDownloadingTemplate}
                    className="px-3.5 py-2 bg-white hover:bg-rose-100 text-rose-900 border border-rose-300 font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <FileDown className="w-3.5 h-3.5 text-rose-600" />
                    <span>मानक टेम्पलेट (.xlsx) लें</span>
                  </button>
                </div>
              </div>

              {/* Categorized Badges */}
              <div className="flex flex-wrap gap-2 pt-1 text-xs">
                {errorStats.header > 0 && (
                  <span className="px-3 py-1 bg-rose-200/80 border border-rose-300 text-rose-950 font-bold rounded-lg flex items-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5 text-rose-700" />
                    हेडर / शीट संरचना एरर: {errorStats.header}
                  </span>
                )}
                {errorStats.dropdown > 0 && (
                  <span className="px-3 py-1 bg-amber-100 border border-amber-300 text-amber-950 font-bold rounded-lg flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                    अमान्य ड्रॉपडाउन मान: {errorStats.dropdown}
                  </span>
                )}
                {errorStats.timestamp > 0 && (
                  <span className="px-3 py-1 bg-purple-100 border border-purple-300 text-purple-950 font-bold rounded-lg flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-purple-700" />
                    गलत समय प्रारूप: {errorStats.timestamp}
                  </span>
                )}
                {errorStats.duplicate > 0 && (
                  <span className="px-3 py-1 bg-rose-100 border border-rose-300 text-rose-950 font-bold rounded-lg flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-700" />
                    डुप्लिकेट टाइमस्टैम्प: {errorStats.duplicate}
                  </span>
                )}
                {errorStats.unassigned > 0 && (
                  <span className="px-3 py-1 bg-orange-100 border border-orange-300 text-orange-950 font-bold rounded-lg flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-orange-700" />
                    अनाधिकृत केस: {errorStats.unassigned}
                  </span>
                )}
              </div>

              {!parseResult.headerValidation.isValid && (
                <div className="p-3 bg-rose-200/60 border border-rose-300 rounded-xl text-xs text-rose-900 font-semibold flex items-center gap-2">
                  <AlertOctagon className="w-4 h-4 text-rose-700 shrink-0" />
                  <span>
                    <strong>गंभीर चेतावनी:</strong> हेडर कॉलम का नाम बदला गया है। जब तक कॉलम 1 से 7 मानक नाम पर नहीं होंगे, तब तक डेटा सिंक नहीं किया जा सकता।
                  </span>
                </div>
              )}

              {/* Strict Zero Skipping Policy Banner */}
              <div className="p-4 bg-rose-100/95 border-2 border-rose-400 rounded-xl text-xs text-rose-950 space-y-2">
                <div className="font-extrabold flex items-center gap-2 text-sm text-rose-900">
                  <AlertOctagon className="w-5 h-5 text-rose-700 shrink-0" />
                  <span>सख्त नियम: त्रुटियों वाले केस छोड़े नहीं जा सकते (Zero Skipping Rule)</span>
                </div>
                <p className="text-xs text-rose-900 leading-relaxed font-medium">
                  मास्टर डेटाबेस की सटीकता और ऑडिट अनुपालन के लिए कोई भी केस अधूरा या गलत नहीं छोड़ा जा सकता। जब तक फ़ाइल <strong>100% त्रुटिरहित</strong> नहीं होगी, <strong>डेटा सिंक पूरी तरह अवरुद्ध रहेगा</strong>। कृपया नीचे दिए गए एरर विवरण को अपनी Excel फ़ाइल में सुधारें और <strong>सही फ़ाइल दोबारा अपलोड करें</strong>।
                </p>
                <div className="pt-1.5 flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>सुधारी गई सही फ़ाइल अपलोड करें (Re-upload)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadErrorReportText(parseResult, currentUserName)}
                    className="px-4 py-2 bg-white hover:bg-rose-50 text-rose-800 border border-rose-300 font-bold text-xs rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-rose-700" />
                    <span>त्रुटि विवरण (.txt) डाउनलोड करें</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Interactive Preview Table with Tabs */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              {/* Tab Filters */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setTableFilter('all')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    tableFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  सभी केस ({parseResult.items.length})
                </button>

                <button
                  onClick={() => setTableFilter('valid')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    tableFilter === 'valid'
                      ? 'bg-white text-emerald-700 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  केवल वैध ({parseResult.validCount})
                </button>

                {parseResult.formatErrors.length > 0 && (
                  <button
                    onClick={() => setTableFilter('errors')}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                      tableFilter === 'errors'
                        ? 'bg-rose-600 text-white shadow-2xs font-bold'
                        : 'text-rose-700 hover:bg-rose-50 font-bold'
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>फ़ॉर्मेट त्रुटियां ({parseResult.formatErrors.length})</span>
                  </button>
                )}
              </div>

              {/* Search in preview */}
              {tableFilter !== 'errors' && (
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="केस खोजें..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}
            </div>

            {/* TAB 1 & 2: Cases Table */}
            {tableFilter !== 'errors' && (
              <div className="overflow-x-auto max-h-96 overflow-y-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3 border-b border-slate-200">Agreement ID</th>
                      <th className="py-2.5 px-3 border-b border-slate-200">Executive</th>
                      <th className="py-2.5 px-3 border-b border-slate-200">Standard Feedback</th>
                      <th className="py-2.5 px-3 border-b border-slate-200">SF Timestamp</th>
                      <th className="py-2.5 px-3 border-b border-slate-200">Availability</th>
                      <th className="py-2.5 px-3 border-b border-slate-200">Detailed Feedback</th>
                      <th className="py-2.5 px-3 border-b border-slate-200 text-center">सत्यापन स्थिति</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                          कोई केस नहीं मिला
                        </td>
                      </tr>
                    ) : (
                      displayedItems.map((item, idx) => (
                        <tr
                          key={idx}
                          className={item.isValid ? 'hover:bg-slate-50' : 'bg-rose-50/50 hover:bg-rose-50'}
                        >
                          <td className="py-2 px-3 font-mono font-bold text-slate-900">
                            {item.agreementId}
                          </td>
                          <td className="py-2 px-3 text-slate-700">{item.executiveName}</td>
                          <td className="py-2 px-3">
                            <span className="px-2 py-0.5 rounded font-semibold text-[11px] bg-slate-100 text-slate-800">
                              {item.status}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px] text-teal-800">
                            {item.sfTime || item.availTime || '-'}
                          </td>
                          <td className="py-2 px-3 text-slate-600">{item.availability || '-'}</td>
                          <td className="py-2 px-3 text-slate-600 max-w-xs truncate" title={item.detailedFeedback}>
                            {item.detailedFeedback || '-'}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {item.isValid ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-bold bg-emerald-100/70 px-2 py-0.5 rounded-full">
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>वैध</span>
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] text-rose-700 font-bold bg-rose-100 px-2 py-0.5 rounded-full cursor-help"
                                title={item.validationError}
                              >
                                <XCircle className="w-3 h-3 text-rose-600" />
                                <span>{item.auditFlag === 'DuplicateTimestamp' ? 'डुप्लिकेट सेकंड' : 'अमान्य फ़ॉर्मेट'}</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB 3: DEDICATED FORMAT ERRORS TABLE */}
            {tableFilter === 'errors' && (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-rose-900 bg-rose-100/80 p-3.5 rounded-xl border border-rose-300">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertOctagon className="w-4 h-4 text-rose-700 shrink-0" />
                    <span>
                      ⛔ इन त्रुटियों के कारण सिंक पूरी तरह रोका गया है। त्रुटियों वाले केस छोड़े नहीं जा सकते। कृपया नीचे देखकर Excel फ़ाइल ठीक करें और दोबारा अपलोड करें।
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1 bg-rose-700 hover:bg-rose-800 text-white font-bold text-[11px] rounded-lg cursor-pointer"
                    >
                      फ़ाइल दोबारा अपलोड करें
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadErrorReportText(parseResult, currentUserName)}
                      className="px-2.5 py-1 bg-white text-rose-800 border border-rose-300 font-bold cursor-pointer text-[11px] rounded-lg"
                    >
                      रिपोर्ट डाउनलोड (.txt)
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-96 overflow-y-auto border border-rose-200 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-rose-100/80 text-rose-950 font-bold sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3 border-b border-rose-200">पंक्ति (Row)</th>
                        <th className="py-2.5 px-3 border-b border-rose-200">Agreement ID</th>
                        <th className="py-2.5 px-3 border-b border-rose-200">कॉलम (Column)</th>
                        <th className="py-2.5 px-3 border-b border-rose-200">दर्ज किया गया मान (Found)</th>
                        <th className="py-2.5 px-3 border-b border-rose-200">अपेक्षित फ़ॉर्मेट (Expected)</th>
                        <th className="py-2.5 px-3 border-b border-rose-200">सुधार निर्देश (Fix Guide)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rose-100 bg-white">
                      {parseResult.formatErrors.map((err, idx) => (
                        <tr key={idx} className="hover:bg-rose-50/40">
                          <td className="py-2 px-3 font-mono font-bold text-slate-800">
                            {err.rowNumber ? `Row ${err.rowNumber}` : '-'}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-rose-900">
                            {err.agreementId || '-'}
                          </td>
                          <td className="py-2 px-3 font-bold text-slate-800">{err.columnName}</td>
                          <td className="py-2 px-3 font-mono text-[11px] text-rose-700 bg-rose-50/80 rounded">
                            "{err.foundValue}"
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px] text-emerald-800 bg-emerald-50/60 rounded">
                            {err.expectedFormat}
                          </td>
                          <td className="py-2 px-3 text-slate-700 leading-relaxed">
                            {err.message}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Past Uploads History Table */}
      {uploadLogs.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">हालिया अपलोड इतिहास (Upload History Log)</h3>
            </div>
            <span className="text-xs text-slate-500">
              कुल {uploadLogs.length} बैच
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <th className="py-2.5 px-3">बैच आईडी</th>
                  <th className="py-2.5 px-3">अपलोड समय</th>
                  <th className="py-2.5 px-3">एग्जीक्यूटिव</th>
                  <th className="py-2.5 px-3">फ़ाइल का नाम</th>
                  <th className="py-2.5 px-3 text-center">कुल केस</th>
                  <th className="py-2.5 px-3 text-center">सिंक किए गए</th>
                  <th className="py-2.5 px-3 text-center">ऑडिट सत्यापन</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {uploadLogs.slice(0, 10).map((log, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70">
                    <td className="py-2 px-3 font-mono font-bold text-slate-600">{log.id}</td>
                    <td className="py-2 px-3 text-slate-600">{log.timestamp}</td>
                    <td className="py-2 px-3 font-semibold text-slate-800">{log.uploadedBy}</td>
                    <td className="py-2 px-3 text-slate-700 max-w-xs truncate" title={log.fileName}>
                      {log.fileName}
                    </td>
                    <td className="py-2 px-3 text-center font-bold">{log.totalCases}</td>
                    <td className="py-2 px-3 text-center text-emerald-700 font-bold">
                      {log.updatedCount}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className="px-2 py-0.5 bg-teal-50 text-teal-800 rounded font-bold text-[11px] border border-teal-200">
                        {log.auditStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
