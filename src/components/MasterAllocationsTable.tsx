import React, { useState, useMemo } from 'react';
import { AllocationItem } from '../types';
import {
  exportAllocationsToExcelWithValidation,
  exportBlankTemplateWithValidation,
} from '../services/excelExportService';
import { MacroGuideModal } from './MacroGuideModal';
import {
  Search,
  Filter,
  Download,
  ArrowRightLeft,
  Calendar,
  User,
  CheckCircle,
  Clock,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  FileSpreadsheet,
  Sparkles,
  FileCode,
} from 'lucide-react';

interface MasterTableProps {
  allocations: AllocationItem[];
  executivesList: string[];
  spreadsheetId: string | null;
  onTransferCase: (item: AllocationItem) => void;
  onUpdateStatus: (agreementId: string, newStatus: string) => void;
  onOpenBulkPaste: () => void;
  userRole?: 'Admin' | 'Executive';
  currentUserName?: string;
  currentUserUsername?: string;
  allowStandardXlsx?: boolean;
}

export const MasterAllocationsTable: React.FC<MasterTableProps> = ({
  allocations,
  executivesList,
  spreadsheetId: _spreadsheetId,
  onTransferCase,
  onUpdateStatus,
  onOpenBulkPaste,
  userRole = 'Admin',
  currentUserName = '',
  currentUserUsername = '',
  allowStandardXlsx = false,
}) => {
  const isAdmin = userRole === 'Admin';
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedExecutive, setSelectedExecutive] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // If Executive, STRICTLY only show their own cases!
  const userAllocations = useMemo(() => {
    if (isAdmin) return allocations;
    const myName = currentUserName.toLowerCase().trim();
    const myUser = currentUserUsername.toLowerCase().trim();
    return allocations.filter(a => {
      const exec = (a.executiveName || '').toLowerCase().trim();
      return exec === myName || exec === myUser;
    });
  }, [isAdmin, allocations, currentUserName, currentUserUsername]);

  // Filter allocations
  const filtered = useMemo(() => {
    return userAllocations.filter(item => {
      const matchSearch =
        !searchTerm.trim() ||
        item.agreementId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.executiveName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.notes || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchExec =
        !isAdmin ||
        selectedExecutive === 'ALL' ||
        item.executiveName.toLowerCase() === selectedExecutive.toLowerCase();

      const matchStatus =
        selectedStatus === 'ALL' ||
        item.status.toLowerCase() === selectedStatus.toLowerCase();

      return matchSearch && matchExec && matchStatus;
    });
  }, [userAllocations, searchTerm, selectedExecutive, selectedStatus, isAdmin]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage]);

  const [isExporting, setIsExporting] = useState(false);
  const [showMacroModal, setShowMacroModal] = useState(false);

  // EXCEL MACRO EXPORT (.xlsm) WITH DATA VALIDATION DROPDOWNS & UNIQUE STAGGERED TIMESTAMPS
  const handleExportExcel = async (onlyBlank = false, withTimestamps = true) => {
    try {
      setIsExporting(true);
      if (onlyBlank) {
        await exportBlankTemplateWithValidation();
      } else {
        const fileName = isAdmin
          ? 'Master_Allocations_Feedback'
          : `My_Allocations_Feedback_${currentUserUsername}`;
        await exportAllocationsToExcelWithValidation(filtered, {
          fileName: `${fileName}_${new Date().toISOString().split('T')[0]}.xlsm`,
          currentUser: currentUserName || currentUserUsername,
          userRole,
          includeStaggeredTimestamps: withTimestamps,
        });
      }
    } catch (err) {
      console.error('Failed to export Excel macro file:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('paid')) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
          <CheckCircle className="w-3 h-3 text-emerald-600" />
          Paid (पेड)
        </span>
      );
    }
    if (s.includes('closed')) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 border border-slate-300">
          Closed (क्लोज्ड)
        </span>
      );
    }
    if (s.includes('transfer')) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
          <ArrowRightLeft className="w-3 h-3 text-blue-600" />
          Transferred
        </span>
      );
    }
    if (s.includes('unallocated')) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
          <Clock className="w-3 h-3 text-amber-600" />
          Unallocated (अनएलोकेटेड)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
        <ShieldCheck className="w-3 h-3 text-slate-600" />
        {status || 'Allocated'}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={
                isAdmin
                  ? 'एग्रीमेंट आईडी या एग्जीक्यूटिव से खोजें...'
                  : 'अपने केस खोजें (एग्रीमेंट आईडी से)...'
              }
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Executive filter dropdown is ONLY visible to Admin */}
            {isAdmin && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
                <User className="w-3.5 h-3.5 text-slate-500" />
                <select
                  value={selectedExecutive}
                  onChange={e => {
                    setSelectedExecutive(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-transparent font-medium text-slate-700 focus:outline-hidden cursor-pointer"
                >
                  <option value="ALL">सभी एग्जीक्यूटिव्स</option>
                  {executivesList.map(exec => (
                    <option key={exec} value={exec}>
                      {exec}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={selectedStatus}
                onChange={e => {
                  setSelectedStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent font-medium text-slate-700 focus:outline-hidden cursor-pointer"
              >
                <option value="ALL">सभी स्थिति (All)</option>
                <option value="Allocated">Allocated (एलोकेटेड)</option>
                {isAdmin && <option value="Unallocated">Unallocated (अनएलोकेटेड)</option>}
                <option value="Transferred">Transferred (ट्रांसफर्ड)</option>
                <option value="Paid">Paid (पेड)</option>
                <option value="Closed">Closed (क्लोज्ड)</option>
              </select>
            </div>

            <button
              onClick={() => handleExportExcel(false, true)}
              disabled={isExporting || userAllocations.length === 0}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="डायरेक्ट मैक्रो-इनेबल्ड वर्कबुक (.xlsm) डाउनलोड करें जिसमें सभी आवंटित केस, ऑटो-टाइमस्टैम्प और हिस्ट्री मॉडयूल शामिल हैं"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
              <span>{isExporting ? 'डाउनलोड हो रहा है...' : 'डायरेक्ट मैक्रो फ़ाइल (.xlsm)'}</span>
            </button>

            <button
              onClick={() => setShowMacroModal(true)}
              className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="VBA मैक्रो कोड और सेटअप गाइड देखें"
            >
              <FileCode className="w-4 h-4 text-purple-200" />
              <span>मैक्रो गाइड (.xlsm)</span>
            </button>

            <button
              onClick={() => handleExportExcel(true, false)}
              disabled={isExporting}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="ब्लैंक मैक्रो टेम्पलेट (.xlsm) डाउनलोड करें"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden lg:inline">खाली मैक्रो टेम्पलेट (.xlsm)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Validation & Timestamp Feature Banner */}
      <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-emerald-900">
        <div className="flex items-start sm:items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
          <span>
            <strong>यूनिक टाइमस्टैम्प व एंटी-बल्क नियम:</strong> हर फीडबैक कॉलम का अपना टाइमस्टैम्प है और प्रत्येक सेल का समय अलग (माइनर सेकंड्स भिन्न) होना अनिवार्य है।
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto text-[11px]">
          <button
            onClick={() => setShowMacroModal(true)}
            className="text-purple-700 hover:text-purple-900 font-bold underline cursor-pointer flex items-center gap-1"
          >
            <FileCode className="w-3.5 h-3.5 text-purple-600" />
            <span>मैक्रो (.xlsm) कैसे चालू करें ↗</span>
          </button>
          <span className="text-slate-300">|</span>
          <button
            onClick={() => handleExportExcel(true, false)}
            className="text-emerald-700 hover:text-emerald-900 font-bold underline cursor-pointer"
          >
            खाली टेम्पलेट (.xlsx) ↗
          </button>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">एग्रीमेंट आईडी</th>
                <th className="py-3.5 px-4">
                  {isAdmin ? 'एग्जीक्यूटिव नेम (User ID)' : 'आवंटित यूजर'}
                </th>
                <th className="py-3.5 px-4">एलोकेशन डेट</th>
                <th className="py-3.5 px-4">वर्तमान स्थिति</th>
                <th className="py-3.5 px-4">अंतिम अपडेट</th>
                <th className="py-3.5 px-4 text-right">स्थिति / एक्शन</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {userAllocations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    <p className="text-sm font-semibold text-slate-600">
                      {isAdmin
                        ? 'मास्टर शीट में कोई रिकॉर्ड नहीं है'
                        : 'आपके नाम पर अभी कोई केस एलोकेटेड नहीं है'}
                    </p>
                    {isAdmin && (
                      <>
                        <p className="text-xs text-slate-400 mt-1">
                          'कॉपी-पेस्ट एलोकेशन' टैब पर क्लिक करके एग्रीमेंट डेटा जोड़ें।
                        </p>
                        <button
                          onClick={onOpenBulkPaste}
                          className="mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          डेटा पेस्ट करें
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    फ़िल्टर के अनुसार कोई केस नहीं मिला।
                  </td>
                </tr>
              ) : (
                paginatedData.map(item => (
                  <tr key={item.agreementId} className="hover:bg-slate-50/80 transition-colors">
                    {/* Agreement ID */}
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {item.agreementId}
                    </td>

                    {/* Executive */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[10px]">
                          {(item.executiveName[0] || 'U').toUpperCase()}
                        </div>
                        <span className="font-semibold text-slate-800">
                          {item.executiveName}
                        </span>
                      </div>
                    </td>

                    {/* Date */}
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {item.allocationDate}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">{getStatusBadge(item.status)}</td>

                    {/* Last Updated */}
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {item.lastUpdated || '-'}
                    </td>

                    {/* Actions: Transfer (Admin only) & Quick Status Selector (Both) */}
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        {/* Quick Status Dropdown for both User and Admin */}
                        <div className="relative inline-flex items-center">
                          <select
                            value={item.status}
                            onChange={e => onUpdateStatus(item.agreementId, e.target.value)}
                            title="स्थिति अपडेट करें"
                            aria-label={`Update status for ${item.agreementId}`}
                            className="text-[11px] font-semibold py-1 px-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500 cursor-pointer"
                          >
                            <option value="Allocated">Allocated</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Paid">Paid (पेड)</option>
                            <option value="Closed">Closed (क्लोज्ड)</option>
                          </select>
                        </div>

                        {/* Admin-only Transfer button */}
                        {isAdmin && (
                          <button
                            onClick={() => onTransferCase(item)}
                            className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                            title="दूसरे यूजर को केस ट्रांसफर करें"
                          >
                            <ArrowRightLeft className="w-3 h-3" />
                            <span>ट्रांसफर</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {filtered.length > itemsPerPage && (
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>
              दिखा रहा है {(currentPage - 1) * itemsPerPage + 1} से{' '}
              {Math.min(currentPage * itemsPerPage, filtered.length)} (कुल {filtered.length})
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold text-slate-700">
                पृष्ठ {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Offline Excel VBA Macro Guide & Downloader Modal */}
      <MacroGuideModal
        isOpen={showMacroModal}
        onClose={() => setShowMacroModal(false)}
      />
    </div>
  );
};
