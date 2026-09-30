import React, { useState } from 'react';
import { SpreadsheetInfo } from '../types';
import {
  exportBlankTemplateWithValidation,
  AVAILABILITY_OPTIONS,
  STANDARD_FEEDBACK_OPTIONS,
} from '../services/excelExportService';
import { MacroGuideModal } from './MacroGuideModal';
import {
  Settings,
  FileSpreadsheet,
  ExternalLink,
  PlusCircle,
  FolderOpen,
  Link2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Database,
  Sparkles,
  Shield,
  Layers,
  Copy,
  Check,
  Download,
  Table,
  Lock,
  History,
  Search,
  FileCode,
} from 'lucide-react';

interface SettingsViewProps {
  activeSpreadsheetId: string | null;
  activeSpreadsheetName: string;
  driveSpreadsheets: SpreadsheetInfo[];
  isLoadingDrive: boolean;
  onSelectExistingSheet: (id: string, name: string) => Promise<void>;
  onCreateNewSheet: (title: string) => Promise<void>;
  onRefreshDriveList: () => void;
  onRefreshData: () => Promise<void>;
  isRefreshing: boolean;
  isProcessing: boolean;
  lastSynced: Date | null;
  totalAllocations: number;
  totalUsers: number;
  allowStandardXlsx?: boolean;
  onToggleAllowStandardXlsx?: (val: boolean) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  activeSpreadsheetId,
  activeSpreadsheetName,
  driveSpreadsheets,
  isLoadingDrive,
  onSelectExistingSheet,
  onCreateNewSheet,
  onRefreshDriveList,
  onRefreshData,
  isRefreshing,
  isProcessing,
  lastSynced,
  totalAllocations,
  totalUsers,
  allowStandardXlsx = false,
  onToggleAllowStandardXlsx,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'format' | 'create' | 'select' | 'custom'>('overview');
  const [newSheetTitle, setNewSheetTitle] = useState('Case Allocation & Transfer Master Sheet');
  const [customInput, setCustomInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [isExportingFormat, setIsExportingFormat] = useState(false);
  const [showMacroModal, setShowMacroModal] = useState(false);

  const handleDownloadFormat = async () => {
    try {
      setIsExportingFormat(true);
      await exportBlankTemplateWithValidation();
    } catch (err) {
      console.error('Error downloading format:', err);
    } finally {
      setIsExportingFormat(false);
    }
  };

  const handleCopyId = () => {
    if (!activeSpreadsheetId) return;
    navigator.clipboard.writeText(activeSpreadsheetId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSheetTitle.trim()) return;
    await onCreateNewSheet(newSheetTitle.trim());
    setActiveSubTab('overview');
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;

    let id = customInput.trim();
    const match = id.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      id = match[1];
    }

    await onSelectExistingSheet(id, 'Custom Connected Sheet');
    setActiveSubTab('overview');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-6 rounded-2xl shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-xs flex items-center justify-center font-bold text-white shadow-inner">
              <Settings className="w-6 h-6 text-indigo-300" />
            </div>
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <span>एडमिन सिस्टम व Google Sheet सेटिंग्स</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  Admin Only
                </span>
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                Google Sheets कनेक्शन, वर्कशीट्स प्रबंधन व डेटा सिंक की व्यवस्था
              </p>
            </div>
          </div>

          {activeSpreadsheetId && (
            <a
              href={`https://docs.google.com/spreadsheets/d/${activeSpreadsheetId}/edit`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Google Sheet में खोलें</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* Main Connected Sheet Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                वर्तमान कनेक्टेड स्प्रेडशीट (Active Sheet)
              </p>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
                {activeSpreadsheetName}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onRefreshData}
              disabled={isRefreshing || !activeSpreadsheetId}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
              <span>{isRefreshing ? 'सिंक हो रहा है...' : 'डेटा सिंक करें'}</span>
            </button>

            {activeSpreadsheetId && (
              <a
                href={`https://docs.google.com/spreadsheets/d/${activeSpreadsheetId}/edit`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl border border-emerald-200 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>शीट खोलें</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>

        {/* Sheet ID & Live Tabs Details */}
        {activeSpreadsheetId ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Spreadsheet ID:</span>
                <button
                  onClick={handleCopyId}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded cursor-pointer"
                  title="ID कॉपी करें"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="font-mono text-slate-800 font-bold break-all">{activeSpreadsheetId}</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
              <span className="text-slate-500 font-medium">अंतिम सिंक समय:</span>
              <p className="font-bold text-slate-800">
                {lastSynced ? lastSynced.toLocaleTimeString('hi-IN') : 'अभी सिंक नहीं हुआ'}
              </p>
              <p className="text-[11px] text-slate-400">
                कुल केस: {totalAllocations} • रजिस्टर्ड यूजर: {totalUsers}
              </p>
            </div>

            <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200 space-y-1.5">
              <span className="text-emerald-800 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>लाइव वर्कशीट्स (3 Tabs)</span>
              </span>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                <span className="px-2 py-0.5 bg-white rounded border border-emerald-200 font-mono font-bold text-[11px] text-purple-700">
                  Users_Auth
                </span>
                <span className="px-2 py-0.5 bg-white rounded border border-emerald-200 font-mono font-bold text-[11px] text-blue-700">
                  Master_Allocations
                </span>
                <span className="px-2 py-0.5 bg-white rounded border border-emerald-200 font-mono font-bold text-[11px] text-amber-700">
                  Transfer_Logs
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Google Drive में कोई शीट कनेक्ट नहीं है। नीचे दिए गए विकल्पों से नई शीट बनाएं या चुनें।</span>
            </div>
          </div>
        )}
      </div>

      {/* Action Sub Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="flex border-b border-slate-200 bg-slate-50/70 text-xs font-bold">
          <button
            onClick={() => setActiveSubTab('overview')}
            className={`py-3 px-5 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeSubTab === 'overview'
                ? 'border-indigo-600 text-indigo-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>टैब संरचना व विवरण</span>
          </button>

          <button
            onClick={() => setActiveSubTab('format')}
            className={`py-3 px-5 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeSubTab === 'format'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Table className="w-4 h-4 text-emerald-600" />
            <span>कॉलिंग व फीडबैक फॉर्मेट (Format)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('create')}
            className={`py-3 px-5 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeSubTab === 'create'
                ? 'border-indigo-600 text-indigo-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <PlusCircle className="w-4 h-4 text-emerald-600" />
            <span>नई शीट बनाएं (1-Click)</span>
          </button>

          <button
            onClick={() => {
              setActiveSubTab('select');
              onRefreshDriveList();
            }}
            className={`py-3 px-5 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeSubTab === 'select'
                ? 'border-indigo-600 text-indigo-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FolderOpen className="w-4 h-4 text-blue-600" />
            <span>Drive से दूसरी शीट चुनें ({driveSpreadsheets.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('custom')}
            className={`py-3 px-5 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeSubTab === 'custom'
                ? 'border-indigo-600 text-indigo-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Link2 className="w-4 h-4 text-purple-600" />
            <span>कस्टम URL / ID से कनेक्ट करें</span>
          </button>
        </div>

        <div className="p-6">
          {/* SubTab 1: Overview of Worksheets */}
          {activeSubTab === 'overview' && (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-slate-800">
                आपकी Google Sheet की संरचना (3 Worksheets):
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-purple-900 text-sm">1. Users_Auth</span>
                    <span className="text-[10px] font-semibold bg-purple-100 text-purple-800 px-2 py-0.5 rounded">पहला टैब</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    एडमिन और सभी एग्जीक्यूटिव्स के यूजरनेम, पासवर्ड, रोल और स्टेटस का रिकॉर्ड। लॉगिन ऑथेंटिकेशन इसी से होता है।
                  </p>
                  <p className="text-[11px] font-mono text-purple-800 pt-1">
                    कॉलम्स: User ID, Password, Full Name, Role, Status, Created Date
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-blue-900 text-sm">2. Master_Allocations</span>
                    <span className="text-[10px] font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">दूसरा टैब</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    मुख्य मास्टर डेटा जिसमें प्रत्येक एग्रीमेंट किस एग्जीक्यूटिव को कब दिया गया, उसकी स्थिति और नोट्स रहते हैं।
                  </p>
                  <p className="text-[11px] font-mono text-blue-800 pt-1">
                    कॉलम्स: Agreement ID, Executive Name, Allocation Date, Status, Last Updated, Notes
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-amber-900 text-sm">3. Transfer_Logs</span>
                    <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">तीसरा टैब</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    ऑडिट ट्रेल: जब भी कोई केस एक एग्जीक्यूटिव से दूसरे को ट्रांसफर होता है, तो पूरा विवरण यहाँ स्वतः लॉग होता है।
                  </p>
                  <p className="text-[11px] font-mono text-amber-800 pt-1">
                    कॉलम्स: Timestamp, Agreement ID, From Executive, To Executive, Transferred By, Reason
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* SubTab: Format Specifications & Interactive Preview */}
          {activeSubTab === 'format' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-emerald-50/60 p-4 rounded-xl border border-emerald-200">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span>कॉलिंग व फीडबैक डेटा वैलिडेशन फॉर्मेट (Data Validation Dropdowns)</span>
                  </h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    यह फॉर्मेट केस एलोकेशन डाउनलोड होने वाली Excel (.xlsx) फ़ाइल में डेटा वैलिडेशन (ड्रॉपडाउन) के रूप में लागू रहता है।
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadFormat}
                  disabled={isExportingFormat}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isExportingFormat ? 'डाउनलोड हो रहा है...' : 'Excel टेम्पलेट डाउनलोड (.xlsx)'}</span>
                </button>
              </div>

              {/* Exact Visual Replica of User Format Table */}
              <div className="overflow-x-auto border border-slate-300 rounded-xl shadow-xs">
                <table className="w-full text-xs text-center border-collapse">
                  <thead>
                    <tr className="bg-[#82C341] text-white font-bold text-[11px] uppercase tracking-wide">
                      <th className="py-2.5 px-3 border border-slate-300">Availability</th>
                      <th className="py-2.5 px-3 border border-slate-300">Standard feedbacks</th>
                      <th className="py-2.5 px-3 border border-slate-300">Detailed Feedback</th>
                      <th className="py-2.5 px-3 border border-slate-300">REF 1 Availability</th>
                      <th className="py-2.5 px-3 border border-slate-300">REF 1 Feedback</th>
                      <th className="py-2.5 px-3 border border-slate-300">REF 2 Availability</th>
                      <th className="py-2.5 px-3 border border-slate-300">REF 2 Feedback</th>
                    </tr>
                  </thead>
                  <tbody>
                    {STANDARD_FEEDBACK_OPTIONS.map((feedback, idx) => (
                      <tr
                        key={idx}
                        className={idx % 2 === 0 ? 'bg-[#DDF2FD] text-slate-800' : 'bg-white text-slate-800'}
                      >
                        <td className="py-1.5 px-3 border border-slate-300 font-medium">
                          {AVAILABILITY_OPTIONS[idx] || ''}
                        </td>
                        <td className="py-1.5 px-3 border border-slate-300 font-semibold text-slate-900">
                          {feedback}
                        </td>
                        <td className="py-1.5 px-3 border border-slate-300 text-slate-600 italic">
                          {idx === 0 ? 'Free Text' : ''}
                        </td>
                        <td className="py-1.5 px-3 border border-slate-300 font-medium">
                          {AVAILABILITY_OPTIONS[idx] || ''}
                        </td>
                        <td className="py-1.5 px-3 border border-slate-300 text-slate-600 italic">
                          {idx === 0 ? 'Free Text' : ''}
                        </td>
                        <td className="py-1.5 px-3 border border-slate-300 font-medium">
                          {AVAILABILITY_OPTIONS[idx] || ''}
                        </td>
                        <td className="py-1.5 px-3 border border-slate-300 text-slate-600 italic">
                          {idx === 0 ? 'Free Text' : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Multi-Sheet Architecture Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5 text-emerald-950">
                  <div className="flex items-center gap-2 font-bold text-emerald-800">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>शीट 1: Calling_Feedback (क्लीन कॉलिंग शीट)</span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    यह मुख्य शीट पूरी तरह साफ-सुथरी रहती है। इसमें केवल आपके 7 फीडबैक कॉलम्स व ड्रॉपडाउन रहते हैं ताकि कॉलर को काम करने में कोई परेशानी या कन्फ्यूजन न हो।
                  </p>
                </div>

                <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl space-y-1.5 text-teal-950">
                  <div className="flex items-center gap-2 font-bold text-teal-800">
                    <Lock className="w-4 h-4 text-teal-600" />
                    <span>शीट 2: Timestamps_Audit (सुरक्षित / नॉन-एडिटेबल)</span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    टाइमस्टैम्प को इस अलग शीट में Agreement ID के साथ लॉक रखा गया है। हर सेल का समय सेकंड्स में अलग रहता है और इसे कोई बदल या छेड़ नहीं सकता।
                  </p>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-1.5 text-blue-950">
                  <div className="flex items-center gap-2 font-bold text-blue-800">
                    <History className="w-4 h-4 text-blue-600" />
                    <span>शीट 3: Feedback_History (कॉल हिस्ट्री / नॉन-एडिटेबल)</span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    प्रत्येक केस पर कितनी बार काम हुआ, किस यूजर ने कब कॉल की—यह सब राउंड-वाइज (Round 1, Round 2...) हिस्ट्री में स्वतः दर्ज होता है और लॉक रहता है।
                  </p>
                </div>

                <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-1.5 text-purple-950">
                  <div className="flex items-center gap-2 font-bold text-purple-800">
                    <Search className="w-4 h-4 text-purple-600" />
                    <span>शीट 4: Case_History_Lookup (डायनामिक सर्च पोर्टल)</span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    उसी Excel फ़ाइल में किसी भी केस की हिस्ट्री देखने के लिए ड्रॉपडाउन से Agreement ID चुनें। नीचे उस केस की पूरी तारीख, समय और राउंड हिस्ट्री तुरंत आ जाएगी।
                  </p>
                </div>
              </div>

              {/* Offline Macro Automation Banner */}
              <div className="bg-purple-50/80 border border-purple-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-purple-950">
                <div className="flex items-start gap-2.5">
                  <div className="p-2 bg-purple-600 text-white rounded-xl shrink-0 mt-0.5">
                    <FileCode className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 flex items-center gap-2">
                      <span>ऑफलाइन Excel मैक्रो ऑटोमेशन (.xlsm / VBA)</span>
                      <span className="text-[10px] bg-purple-600 text-white font-extrabold px-2 py-0.5 rounded-full uppercase">
                        Ready to Use
                      </span>
                    </h5>
                    <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                      कॉलर्स जब ऑफलाइन Excel पर काम करते हैं, तो फीडबैक दर्ज करते ही <strong>ऑटोमैटिक यूनिक टाइमस्टैम्प</strong> और <strong>ऑटोमैटिक राउंड हिस्ट्री</strong> बैकग्राउंड में दर्ज करने के लिए रेडी-टू-रन VBA मैक्रो उपलब्ध है।
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMacroModal(true)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>मैक्रो कोड व सेटअप देखें ↗</span>
                </button>
              </div>

              {/* Admin Policy: Allow or Block Standard .xlsx/CSV */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-bold text-slate-800">
                    <Shield className="w-4 h-4 text-indigo-600" />
                    <span>एडमिन नियंत्रण: साधारण .xlsx / CSV एक्सपोर्ट अनुमति</span>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                      allowStandardXlsx ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {allowStandardXlsx ? 'वैकल्पिक चालू (ON)' : 'सख्त सुरक्षा (STRICT OFF)'}
                    </span>
                  </div>
                  <p className="text-slate-500 text-[11px] leading-relaxed max-w-xl">
                    जब यह विकल्प <strong>बंद (OFF)</strong> रहता है, तो कॉलर केवल सुरक्षित 4-शीट मैक्रो ऑडिट वर्कबुक ही निकाल सकते हैं (ताकि कोई बिना टाइमस्टैम्प/हिस्ट्री के साधारण फ़ाइल न निकाल सके)। जब <strong>चालू (ON)</strong> होगा, तभी वैकल्पिक साधारण CSV व ब्लैंक Excel बटन दिखेंगे।
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onToggleAllowStandardXlsx?.(!allowStandardXlsx)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 shrink-0 cursor-pointer ${
                    allowStandardXlsx
                      ? 'bg-amber-600 hover:bg-amber-700 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  <span>{allowStandardXlsx ? 'चालू है (क्लिक करके बंद करें)' : 'बंद है (क्लिक करके चालू करें)'}</span>
                </button>
              </div>

              <div className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
                📌 <strong>उपयोग विधि:</strong> मास्टर एलोकेशन टेबल पर जब आप <strong>"Excel डाउनलोड (4-Sheets Audit)"</strong> बटन दबाएंगे, तो यह 4-शीट वाली सुरक्षित और व्यवस्थित Excel वर्कबुक डाउनलोड होगी।
              </div>
            </div>
          )}

          {/* SubTab 2: Create New Master Sheet */}
          {activeSubTab === 'create' && (
            <form onSubmit={handleCreateSubmit} className="max-w-xl space-y-4">
              <div>
                <h4 className="text-sm font-bold text-slate-800">
                  Google Drive में बिल्कुल नई मास्टर शीट बनाएं
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  यह आपके Google Drive में <code>Users_Auth</code>, <code>Master_Allocations</code> और <code>Transfer_Logs</code> के साथ नई स्प्रेडशीट स्वचालित बना देगा।
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">शीट का नाम (Spreadsheet Name):</label>
                <input
                  type="text"
                  value={newSheetTitle}
                  onChange={e => setNewSheetTitle(e.target.value)}
                  placeholder="उदा. Case Allocation & Transfer Master Sheet"
                  className="w-full p-3 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="py-3 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? (
                  <span>Google Drive में शीट बन रही है...</span>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Google Drive में तुरंत नई शीट बनाएं</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* SubTab 3: Select from Drive */}
          {activeSubTab === 'select' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-800">
                    Google Drive से स्प्रेडशीट चुनें
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    आपके Google खाते में उपलब्ध शीट्स की सूची:
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onRefreshDriveList}
                  disabled={isLoadingDrive}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDrive ? 'animate-spin text-blue-600' : ''}`} />
                  <span>रिफ्रेश लिस्ट</span>
                </button>
              </div>

              {isLoadingDrive ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Google Drive से शीट्स लोड हो रही हैं...
                </div>
              ) : driveSpreadsheets.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  Google Drive में कोई स्प्रेडशीट नहीं मिली। आप 'नई शीट बनाएं' विकल्प का उपयोग कर सकते हैं।
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
                  {driveSpreadsheets.map(sheet => {
                    const isCurrent = sheet.id === activeSpreadsheetId;
                    return (
                      <div
                        key={sheet.id}
                        className={`p-3 sm:p-4 flex items-center justify-between gap-3 transition-colors ${
                          isCurrent ? 'bg-emerald-50/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <FileSpreadsheet
                            className={`w-5 h-5 shrink-0 ${isCurrent ? 'text-emerald-600' : 'text-slate-400'}`}
                          />
                          <div className="min-w-0">
                            <p className="font-bold text-xs text-slate-900 truncate">{sheet.name}</p>
                            <p className="text-[11px] text-slate-400 font-mono truncate">{sheet.id}</p>
                          </div>
                        </div>

                        {isCurrent ? (
                          <span className="px-3 py-1 bg-emerald-600 text-white font-bold text-xs rounded-lg shrink-0">
                            सक्रिय
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={async () => {
                              await onSelectExistingSheet(sheet.id, sheet.name);
                              setActiveSubTab('overview');
                            }}
                            disabled={isProcessing}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 font-semibold text-xs rounded-lg transition-colors shrink-0 cursor-pointer"
                          >
                            चुनें
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* SubTab 4: Custom URL or ID */}
          {activeSubTab === 'custom' && (
            <form onSubmit={handleCustomSubmit} className="max-w-xl space-y-4">
              <div>
                <h4 className="text-sm font-bold text-slate-800">
                  Google Sheet URL या ID दर्ज करें
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  यदि आपके पास किसी शीट का सीधा लिंक है, तो उसे यहाँ पेस्ट करें।
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Google Sheet URL / ID:</label>
                <input
                  type="text"
                  value={customInput}
                  onChange={e => setCustomInput(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
                  className="w-full p-3 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-mono"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>इस शीट को कनेक्ट करें</span>
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Offline Macro Guide Modal */}
      <MacroGuideModal
        isOpen={showMacroModal}
        onClose={() => setShowMacroModal(false)}
      />
    </div>
  );
};
