import React, { useState, useMemo } from 'react';
import { AllocationItem, TransferLogItem } from '../types';
import {
  Search,
  CheckCircle,
  Clock,
  User,
  Calendar,
  ArrowRightLeft,
  FileText,
  ShieldCheck,
  AlertCircle,
  Copy,
  Check,
  History,
  TrendingUp,
  Lock,
} from 'lucide-react';

interface StatusTrackerProps {
  allocations: AllocationItem[];
  transferLogs: TransferLogItem[];
  onQuickTransfer: (item: AllocationItem) => void;
  onUpdateStatus: (agreementId: string, newStatus: string, notes?: string) => Promise<void>;
  isUpdating: boolean;
  userRole?: 'Admin' | 'Executive';
  currentUserName?: string;
  currentUserUsername?: string;
}

export const StatusTrackerView: React.FC<StatusTrackerProps> = ({
  allocations,
  transferLogs,
  onQuickTransfer,
  onUpdateStatus,
  isUpdating,
  userRole = 'Admin',
  currentUserName = '',
  currentUserUsername = '',
}) => {
  const isAdmin = userRole === 'Admin';
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [statusNote, setStatusNote] = useState<string>('');
  const [showStatusModal, setShowStatusModal] = useState(false);

  // Find exact match or list of close matches
  const exactMatch = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.trim().toLowerCase();
    return allocations.find(a => a.agreementId.toLowerCase() === q);
  }, [searchQuery, allocations]);

  const suggestions = useMemo(() => {
    if (!searchQuery.trim() || exactMatch) return [];
    const q = searchQuery.trim().toLowerCase();
    return allocations
      .filter(
        a =>
          a.agreementId.toLowerCase().includes(q) ||
          (isAdmin && a.executiveName.toLowerCase().includes(q))
      )
      .slice(0, 5);
  }, [searchQuery, exactMatch, allocations, isAdmin]);

  // Logs for the matched agreement
  const caseHistory = useMemo(() => {
    if (!exactMatch) return [];
    return transferLogs.filter(
      l => l.agreementId.toLowerCase() === exactMatch.agreementId.toLowerCase()
    );
  }, [exactMatch, transferLogs]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStatusSubmit = async () => {
    if (!exactMatch || !selectedStatus) return;
    await onUpdateStatus(exactMatch.agreementId, selectedStatus, statusNote);
    setShowStatusModal(false);
    setStatusNote('');
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('paid')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
          Paid (पेड)
        </span>
      );
    }
    if (s.includes('closed')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-200 text-slate-700 border border-slate-300">
          Closed (क्लोज्ड)
        </span>
      );
    }
    if (s.includes('transfer')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
          <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600" />
          Transferred (स्थानांतरित)
        </span>
      );
    }
    if (s.includes('unallocated')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          Unallocated (अनएलोकेटेड)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
        <ShieldCheck className="w-3.5 h-3.5 text-slate-600" />
        {status || 'Allocated'}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Search Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="max-w-2xl mx-auto text-center space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
            {isAdmin ? 'मास्टर केस स्टेटस सर्च' : 'मेरा केस स्टेटस ट्रैकर (Search My Cases)'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            {isAdmin
              ? 'यहाँ किसी भी एग्रीमेंट आईडी को दर्ज करें। सिस्टम तुरंत चेक करके वर्तमान एग्जीक्यूटिव, स्थिति और हिस्ट्री दिखाएगा।'
              : 'अपनी एग्रीमेंट आईडी दर्ज करें और अपने आवंटित केस की वर्तमान स्थिति, नोट्स और टाइमलाइन देखें।'}
          </p>

          <div className="relative mt-4">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={
                isAdmin
                  ? 'एग्रीमेंट आईडी दर्ज करें (उदा. AGR-2024-001)...'
                  : 'अपनी एग्रीमेंट आईडी दर्ज करें (उदा. AGR-2024-001)...'
              }
              className="w-full pl-12 pr-10 py-3.5 text-sm sm:text-base font-medium rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Suggestions if partial match */}
          {suggestions.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">सुझाव (Suggestions):</span>
              {suggestions.map(s => (
                <button
                  key={s.agreementId}
                  onClick={() => setSearchQuery(s.agreementId)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 rounded-lg text-slate-700 border border-slate-200 font-mono transition-colors cursor-pointer"
                >
                  {s.agreementId}
                  {isAdmin ? ` (${s.executiveName})` : ''}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Search Result Display */}
      {exactMatch ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Case Card */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
              {/* Card Header */}
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      एग्रीमेंट आईडी
                    </span>
                    <button
                      onClick={() => handleCopy(exactMatch.agreementId)}
                      className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                      title="कॉपी करें"
                    >
                      {copied ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 font-mono mt-0.5">
                    {exactMatch.agreementId}
                  </h3>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    वर्तमान स्थिति
                  </span>
                  <div>{getStatusBadge(exactMatch.status)}</div>
                </div>
              </div>

              {/* Grid of Key Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Executive Assigned */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase mb-1">
                    <User className="w-4 h-4 text-blue-600" />
                    <span>आवंटित यूजर</span>
                  </div>
                  <p className="text-base font-bold text-slate-900">
                    {exactMatch.executiveName}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isAdmin ? 'यूजर आईडी / असाइनी' : 'आपके नाम पर आवंटित'}
                  </p>
                </div>

                {/* Allocation Date */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase mb-1">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    <span>एलोकेशन दिनांक</span>
                  </div>
                  <p className="text-base font-bold text-slate-900 font-mono">
                    {exactMatch.allocationDate}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">मास्टर शीट एंट्री</p>
                </div>
              </div>

              {/* Extra Details / Notes */}
              {exactMatch.notes && (
                <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-slate-700">
                  <div className="flex items-center gap-1.5 font-semibold text-blue-800 mb-1">
                    <FileText className="w-3.5 h-3.5" />
                    <span>टिप्पणी / विवरण (Notes):</span>
                  </div>
                  <p className="leading-relaxed">{exactMatch.notes}</p>
                </div>
              )}

              {exactMatch.lastUpdated && (
                <p className="text-xs text-slate-400 italic">
                  अंतिम अपडेट: {exactMatch.lastUpdated}
                </p>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap items-center gap-3">
                {/* Admin-only Transfer button */}
                {isAdmin && (
                  <button
                    onClick={() => onQuickTransfer(exactMatch)}
                    className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    <span>केस दूसरे यूजर को ट्रांसफर करें</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setSelectedStatus(exactMatch.status);
                    setShowStatusModal(true);
                  }}
                  className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-xl transition-all flex items-center gap-2 cursor-pointer"
                >
                  <TrendingUp className="w-4 h-4" />
                  <span>स्थिति अपडेट करें (Update Status)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Case Transfer & Audit Trail */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <History className="w-4 h-4 text-blue-600" />
                  <span>ट्रांसफर व गतिविधि हिस्ट्री (Audit Trail)</span>
                </h4>
                <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                  {caseHistory.length} रिकॉर्ड
                </span>
              </div>

              {caseHistory.length === 0 ? (
                <div className="text-center py-8 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                  <p className="text-xs font-semibold text-slate-700">
                    यह केस अपने मूल असाइनी के पास है
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    अभी तक इस केस को किसी अन्य यूजर को ट्रांसफर नहीं किया गया है।
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {caseHistory.map((log, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 hover:bg-blue-50/40 rounded-xl border border-slate-200 transition-colors text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-slate-400 text-[11px]">
                        <span>{log.timestamp}</span>
                        <span className="font-semibold text-slate-600">
                          द्वारा: {log.transferredBy}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-semibold text-slate-800">
                        <span className="px-2 py-0.5 bg-slate-200 rounded">
                          {log.fromExecutive}
                        </span>
                        <ArrowRightLeft className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                          {log.toExecutive}
                        </span>
                      </div>
                      {log.reason && (
                        <p className="text-slate-600 italic text-[11px]">
                          कारण: {log.reason}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : searchQuery.trim() ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-lg mx-auto space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 mx-auto flex items-center justify-center">
            {isAdmin ? <AlertCircle className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
          </div>
          <h4 className="text-sm font-bold text-slate-800">
            {isAdmin
              ? `एग्रीमेंट "${searchQuery}" नहीं मिला`
              : `केस "${searchQuery}" आपके पास नहीं मिला`}
          </h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            {isAdmin
              ? 'कृपया जांचें कि एग्रीमेंट आईडी सही है या कनेक्टेड Google Sheet में दर्ज है।'
              : 'सुरक्षा नियम: आप केवल अपने नाम पर आवंटित केस ही देख और खोज सकते हैं। यदि यह केस आपका है तो कृपया आईडी दोबारा जांचें।'}
          </p>
        </div>
      ) : null}

      {/* Quick Status Update Modal */}
      {showStatusModal && exactMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                <span>केस स्थिति अपडेट करें</span>
              </h3>
              <button
                onClick={() => setShowStatusModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <span className="text-slate-500">एग्रीमेंट आईडी:</span>{' '}
                <strong className="text-slate-900 font-mono">{exactMatch.agreementId}</strong>
                <br />
                <span className="text-slate-500">वर्तमान स्थिति:</span>{' '}
                <strong className="text-blue-700">{exactMatch.status}</strong>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">नई स्थिति चुनें:</label>
                <select
                  value={selectedStatus}
                  onChange={e => setSelectedStatus(e.target.value)}
                  className="w-full p-2.5 text-xs font-semibold rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="Allocated">Allocated (एलोकेटेड)</option>
                  <option value="In Progress">In Progress (कार्य प्रगति पर)</option>
                  <option value="Paid">Paid (सफलतापूर्वक पेड)</option>
                  <option value="Closed">Closed (क्लोज्ड / पूर्ण)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">टिप्पणी / नोट्स (वैकल्पिक):</label>
                <textarea
                  rows={3}
                  value={statusNote}
                  onChange={e => setStatusNote(e.target.value)}
                  placeholder="उदा. ग्राहक से बात हुई, पेमेंट प्राप्त हुआ..."
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowStatusModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                रद्द करें
              </button>
              <button
                type="button"
                disabled={isUpdating}
                onClick={handleStatusSubmit}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                {isUpdating ? 'अपडेट हो रहा है...' : 'हाँ, स्थिति अपडेट करें'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
