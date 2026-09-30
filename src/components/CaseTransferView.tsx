import React, { useState, useMemo } from 'react';
import { AllocationItem, ParsedTransferRow, TransferLogItem } from '../types';
import { parseBulkTransferText } from '../utils/parser';
import {
  ArrowRightLeft,
  ClipboardPaste,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  History,
  Send,
  Table,
  RotateCcw,
  ArrowRight,
  ShieldCheck,
  User,
} from 'lucide-react';

interface CaseTransferViewProps {
  allocations: AllocationItem[];
  transferLogs: TransferLogItem[];
  executivesList: string[];
  currentUserEmail?: string;
  currentUserName?: string;
  currentUserUsername?: string;
  userRole?: 'Admin' | 'Executive';
  onExecuteBulkTransfer: (
    transfers: { agreementId: string; fromExecutive: string; toExecutive: string }[],
    reason: string
  ) => void;
  isTransferring: boolean;
}

export const CaseTransferView: React.FC<CaseTransferViewProps> = ({
  allocations,
  transferLogs,
  executivesList,
  currentUserName = '',
  currentUserUsername = '',
  userRole = 'Admin',
  onExecuteBulkTransfer,
  isTransferring,
}) => {
  const isAdmin = userRole === 'Admin';
  const myName = (currentUserName || '').toLowerCase().trim();
  const myUser = (currentUserUsername || '').toLowerCase().trim();

  const isMyCase = (execName: string) => {
    if (!execName) return false;
    const l = execName.toLowerCase().trim();
    return l === myName || l === myUser;
  };

  const [inputText, setInputText] = useState('');
  const [transferReason, setTransferReason] = useState('Bulk Paste Transfer');

  // Real-time parsed rows
  const rawParseResult = useMemo(() => {
    return parseBulkTransferText(inputText, allocations);
  }, [inputText, allocations]);

  // Apply permission validation for regular users
  const parseResult = useMemo(() => {
    const adjustedRows = rawParseResult.rows.map(row => {
      if (!isAdmin && row.isValid) {
        // Executive can ONLY transfer their own assigned cases!
        if (!isMyCase(row.fromExecutive)) {
          return {
            ...row,
            isValid: false,
            validationError: `यह केस आपके पास नहीं है (${row.fromExecutive} के पास है)। आप केवल अपना केस ट्रांसफर कर सकते हैं।`,
          };
        }
      }
      return row;
    });

    const validTransfersCount = adjustedRows.filter(r => r.isValid && r.actionType === 'Transfer').length;
    const newAllocationsCount = adjustedRows.filter(r => r.isValid && r.actionType === 'New Allocation').length;
    const invalidCount = adjustedRows.filter(r => !r.isValid).length;

    return {
      rows: adjustedRows,
      totalParsed: adjustedRows.length,
      validTransfersCount,
      newAllocationsCount,
      invalidCount,
    };
  }, [rawParseResult, isAdmin, myName, myUser]);

  // Valid actionable rows
  const actionableRows = useMemo(() => {
    return parseResult.rows.filter(
      r => r.isValid && (r.actionType === 'Transfer' || (isAdmin && r.actionType === 'New Allocation'))
    );
  }, [parseResult.rows, isAdmin]);

  // Filter logs visible to user
  const visibleLogs = useMemo(() => {
    if (isAdmin) return transferLogs;
    return transferLogs.filter(
      l =>
        isMyCase(l.fromExecutive) ||
        isMyCase(l.toExecutive) ||
        isMyCase(l.transferredBy)
    );
  }, [transferLogs, isAdmin, myName, myUser]);

  const handleLoadSample = () => {
    // If executive, only pick from their own cases
    const eligiblePool = isAdmin
      ? allocations
      : allocations.filter(a => isMyCase(a.executiveName));

    if (eligiblePool.length === 0) {
      if (isAdmin) {
        setInputText(`AGR-2024-001\tPriya Patel\nAGR-2024-002\tAmit Verma`);
      } else {
        setInputText(`AGR-2024-001\tPriya Patel`);
      }
      return;
    }

    const samples: string[] = [];
    const altExecs = executivesList.filter(
      e => e.toLowerCase().trim() !== myName && e.toLowerCase().trim() !== myUser
    );
    const targetExec = altExecs[0] || 'Priya Patel';

    eligiblePool.slice(0, 3).forEach(item => {
      samples.push(`${item.agreementId}\t${targetExec}`);
    });

    setInputText(samples.join('\n'));
  };

  const handleClear = () => {
    setInputText('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (actionableRows.length === 0) return;

    onExecuteBulkTransfer(
      actionableRows.map(r => ({
        agreementId: r.agreementId,
        fromExecutive: r.fromExecutive,
        toExecutive: r.toExecutive,
      })),
      transferReason.trim() || 'Bulk Paste Transfer'
    );
  };

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white p-5 rounded-2xl shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardPaste className="w-6 h-6 text-blue-200" />
              <h2 className="text-xl font-bold">पेस्ट-आधारित केस ट्रांसफर (Paste & Transfer)</h2>
            </div>
            <p className="text-blue-100 text-sm mt-1 max-w-2xl">
              एग्रीमेंट आईडी और नए एग्जीक्यूटिव का नाम सीधे यहाँ पेस्ट करें। सिस्टम स्वतः पहचान लेगा कि केस किसके पास था और उसे सीधे नए एग्जीक्यूटिव को ट्रांसफर कर देगा।
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleLoadSample}
              className="px-3.5 py-2 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold rounded-xl backdrop-blur-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              सैम्पल ट्रांसफर लोड करें
            </button>
            {inputText && (
              <button
                onClick={handleClear}
                className="px-3 py-2 bg-black/20 hover:bg-black/30 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                साफ़ करें
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Paste Area */}
        <div className="lg:col-span-6 space-y-4">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <label htmlFor="transfer-paste-box" className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span>यहाँ एग्रीमेंट आईडी और नया एग्जीक्यूटिव पेस्ट करें:</span>
              </label>
              <span className="text-xs text-slate-500 font-mono">
                {parseResult.totalParsed} लाइन डिटेक्टेड
              </span>
            </div>

            <textarea
              id="transfer-paste-box"
              rows={9}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder={`उदाहरण (Excel / Tab-separated):\nAGR-2024-001\tPriya Patel\nAGR-2024-002\tAmit Verma\n\nउदाहरण (Comma-separated):\nAGR-2024-003, Rahul Sharma`}
              className="w-full p-4 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-hidden transition-all text-slate-800 placeholder-slate-400 resize-y"
            />

            {/* Transfer Reason */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">ट्रांसफर का कारण / टिप्पणी (Transfer Reason):</label>
              <input
                type="text"
                value={transferReason}
                onChange={e => setTransferReason(e.target.value)}
                placeholder="उदा. री-एलोकेशन, वर्कलोड बैलेंस, छुट्टी..."
                className="w-full p-2.5 text-xs rounded-xl border border-slate-300"
              />
            </div>

            {/* Submit Action */}
            <button
              type="submit"
              disabled={actionableRows.length === 0 || isTransferring}
              className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isTransferring ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Google Sheet में ट्रांसफर दर्ज हो रहा है...</span>
                </>
              ) : (
                <>
                  <ArrowRightLeft className="w-4 h-4" />
                  <span>
                    Google Sheet में {actionableRows.length} केस सीधे ट्रांसफर करें
                  </span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right: Live Detection & Matched Preview */}
        <div className="lg:col-span-6 space-y-4">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <p className="text-[11px] font-semibold text-slate-500 uppercase">कुल डिटेक्टेड</p>
              <p className="text-2xl font-black text-slate-800 mt-1">{parseResult.totalParsed}</p>
            </div>
            <div className="bg-blue-50/80 p-4 rounded-xl border border-blue-100 shadow-xs">
              <p className="text-[11px] font-semibold text-blue-700 uppercase">ट्रांसफर होंगे</p>
              <p className="text-2xl font-black text-blue-800 mt-1">{parseResult.validTransfersCount}</p>
            </div>
            <div className="bg-emerald-50/80 p-4 rounded-xl border border-emerald-100 shadow-xs">
              <p className="text-[11px] font-semibold text-emerald-700 uppercase">नये एलोकेशन</p>
              <p className="text-2xl font-black text-emerald-800 mt-1">{parseResult.newAllocationsCount}</p>
            </div>
          </div>

          {/* Preview Table */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Table className="w-4 h-4 text-slate-500" />
                डिटेक्टेड ट्रांसफर प्रीव्यू (Live Preview)
              </h4>
              <span className="text-[11px] text-slate-500">
                {parseResult.rows.length > 0 ? `दिखा रहा है: ${Math.min(parseResult.rows.length, 6)} / ${parseResult.rows.length}` : 'डेटा नहीं है'}
              </span>
            </div>

            {parseResult.rows.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                ऊपर एग्रीमेंट आईडी और नया नाम पेस्ट करते ही यहाँ वर्तमान और नए एग्जीक्यूटिव का मिलान दिखेगा।
              </div>
            ) : (
              <div className="overflow-x-auto max-h-60">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                      <th className="p-2">एग्रीमेंट आईडी</th>
                      <th className="p-2">वर्तमान एग्जीक्यूटिव (From)</th>
                      <th className="p-2">नया एग्जीक्यूटिव (To)</th>
                      <th className="p-2">एक्शन</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parseResult.rows.slice(0, 10).map((row, idx) => (
                      <tr key={idx} className={row.isValid ? 'hover:bg-slate-50' : 'bg-red-50/60'}>
                        <td className="p-2 font-mono font-bold text-slate-900">
                          {row.agreementId}
                        </td>
                        <td className="p-2 text-slate-600">
                          <span className="bg-slate-100 px-2 py-0.5 rounded font-medium">
                            {row.fromExecutive}
                          </span>
                        </td>
                        <td className="p-2 text-blue-700 font-bold">
                          {row.toExecutive}
                        </td>
                        <td className="p-2">
                          {row.actionType === 'Transfer' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              <ArrowRightLeft className="w-3 h-3" />
                              ट्रांसफर होगा
                            </span>
                          ) : row.actionType === 'New Allocation' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              नया केस
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              पहले से इसके पास
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Historical Transfer Logs (From Transfer_Logs Sheet) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-600" />
              <span>ट्रांसफर हिस्ट्री ऑडिट ट्रेल (Transfer_Logs Tab)</span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              गूगल शीट में सुरक्षित समस्त ऐतिहासिक केस ट्रांसफर रिकॉर्ड्स
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">
            कुल: {transferLogs.length} ट्रांसफर
          </span>
        </div>

        {visibleLogs.length === 0 ? (
          <div className="text-center py-10 text-xs text-slate-400">
            अभी तक कोई ट्रांसफर लॉग नहीं है। जब भी आप केस पेस्ट करके ट्रांसफर करेंगे, वो यहाँ तारीख व समय सहित दर्ज होंगे।
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
                  <th className="py-2.5 px-3">समय / दिनांक</th>
                  <th className="py-2.5 px-3">एग्रीमेंट आईडी</th>
                  <th className="py-2.5 px-3">ट्रांसफर फ्रॉम (From)</th>
                  <th className="py-2.5 px-3">ट्रांसफर टू (To)</th>
                  <th className="py-2.5 px-3">ट्रांसफर द्वारा (By)</th>
                  <th className="py-2.5 px-3">कारण (Reason)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleLogs.slice(0, 20).map((log, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">
                      {log.timestamp}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                      {log.agreementId}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 font-medium">
                      {log.fromExecutive}
                    </td>
                    <td className="py-2.5 px-3 text-blue-700 font-bold">
                      {log.toExecutive}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {log.transferredBy}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 italic">
                      {log.reason || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
