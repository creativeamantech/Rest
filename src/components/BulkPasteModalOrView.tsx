import React, { useState, useMemo } from 'react';
import { parseBulkAllocationText } from '../utils/parser';
import { ParsedAllocationRow } from '../types';
import { ClipboardPaste, Sparkles, CheckCircle2, AlertCircle, ArrowRight, Table, HelpCircle, RotateCcw } from 'lucide-react';

interface BulkPasteProps {
  onImplement: (validRows: ParsedAllocationRow[]) => void;
  isImplementing: boolean;
  existingAgreements: Set<string>;
  connectedSheetName: string;
}

export const BulkPasteModalOrView: React.FC<BulkPasteProps> = ({
  onImplement,
  isImplementing,
  existingAgreements,
  connectedSheetName,
}) => {
  const [inputText, setInputText] = useState('');

  // Real-time parsing as user types/pastes
  const parseResult = useMemo(() => {
    return parseBulkAllocationText(inputText);
  }, [inputText]);

  // Distinguish new insertions vs existing updates
  const { newCount, updateCount } = useMemo(() => {
    let n = 0;
    let u = 0;
    for (const r of parseResult.rows) {
      if (r.isValid) {
        if (existingAgreements.has(r.agreementId.toLowerCase())) {
          u++;
        } else {
          n++;
        }
      }
    }
    return { newCount: n, updateCount: u };
  }, [parseResult.rows, existingAgreements]);

  const handleLoadSample = () => {
    const today = new Date().toISOString().split('T')[0];
    const sample = [
      `AGR-2024-001\tRahul Sharma\t${today}`,
      `AGR-2024-002\tPriya Patel\t${today}`,
      `AGR-2024-003\tAmit Verma\t${today}`,
      `AGR-2024-004\tNeha Singh\t${today}`,
      `AGR-2024-005\tRahul Sharma\t${today}`,
      `AGR-2024-006\tVikas Gupta\t${today}`,
      `AGR-2024-007\tPooja Joshi\t${today}`,
    ].join('\n');
    setInputText(sample);
  };

  const handleClear = () => {
    setInputText('');
  };

  const handleProceed = () => {
    const valid = parseResult.rows.filter(r => r.isValid);
    if (valid.length === 0) return;
    onImplement(valid);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Explanation */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-5 rounded-2xl shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardPaste className="w-6 h-6 text-emerald-200" />
              <h2 className="text-xl font-bold">एडमिन मास्टर एलोकेशन (Smart Paste)</h2>
            </div>
            <p className="text-emerald-100 text-sm mt-1 max-w-2xl">
              एक्सेल (Excel), स्प्रेडशीट या किसी भी टेक्स्ट से <strong>एग्रीमेंट आईडी</strong> और <strong>एग्जीक्यूटिव नेम</strong> सीधे यहाँ पेस्ट करें। सिस्टम स्वतः डेटा डिटेक्ट कर के मास्टर गूगल शीट में इम्प्लीमेंट कर देगा।
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleLoadSample}
              className="px-3.5 py-2 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold rounded-xl backdrop-blur-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              सैम्पल डेटा लोड करें
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
        {/* Left Column: Paste Area & Instructions */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <label htmlFor="bulk-paste-input" className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span>यहाँ डेटा पेस्ट करें (Paste Raw Allocation Data)</span>
              </label>
              <span className="text-xs text-slate-500 font-mono">
                {parseResult.totalParsed} लाइन डिटेक्टेड
              </span>
            </div>

            <textarea
              id="bulk-paste-input"
              rows={11}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder={`उदाहरण 1 (Excel / Tab):\nAGR-1001\tRahul Sharma\t2026-09-29\nAGR-1002\tPriya Patel\n\nउदाहरण 2 (Comma):\nAGR-1003, Amit Kumar\n\nउदाहरण 3 (Hyphen):\nAGR-1004 - Neha Singh`}
              className="w-full p-4 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-hidden transition-all text-slate-800 placeholder-slate-400 resize-y"
            />

            {/* Helper tips */}
            <div className="mt-3 p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl text-xs text-amber-800 flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">समर्थित फॉर्मेट (Supported Formats):</p>
                <p className="text-amber-700 text-[11px] mt-0.5">
                  • <strong>एक्सेल से कॉपी-पेस्ट:</strong> 2 कॉलम सीधे कॉपी करके यहाँ पेस्ट करें (Tab separated).<br />
                  • <strong>अल्पविराम या डैश:</strong> AGR-001, ExecutiveName या AGR-001 - ExecutiveName.<br />
                  • यदि एलोकेशन तारीख नहीं दी है, तो आज की तारीख स्वतः दर्ज हो जाएगी।
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Detection & Summary */}
        <div className="lg:col-span-6 space-y-4">
          {/* Status Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <p className="text-[11px] font-semibold text-slate-500 uppercase">कुल डिटेक्टेड</p>
              <p className="text-2xl font-black text-slate-800 mt-1">{parseResult.totalParsed}</p>
            </div>
            <div className="bg-emerald-50/80 p-4 rounded-xl border border-emerald-100 shadow-xs">
              <p className="text-[11px] font-semibold text-emerald-700 uppercase">मान्य केस</p>
              <p className="text-2xl font-black text-emerald-800 mt-1">{parseResult.validCount}</p>
            </div>
            <div className="bg-blue-50/80 p-4 rounded-xl border border-blue-100 shadow-xs">
              <p className="text-[11px] font-semibold text-blue-700 uppercase">एग्जीक्यूटिव्स</p>
              <p className="text-2xl font-black text-blue-800 mt-1">{parseResult.uniqueExecutives.length}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-xs">
              <p className="text-[11px] font-semibold text-slate-500 uppercase">नये / अपडेट</p>
              <p className="text-lg font-bold text-slate-800 mt-1">
                <span className="text-emerald-600">+{newCount}</span> / <span className="text-amber-600">↻{updateCount}</span>
              </p>
            </div>
          </div>

          {/* Action Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-800 mb-2">मास्टर शीट में इम्प्लीमेंटेशन</h3>
            <p className="text-xs text-slate-600 mb-4">
              कनेक्टेड शीट: <strong className="text-slate-900">{connectedSheetName}</strong><br />
              यह प्रक्रिया सीधे आपकी Google Sheets में <strong>{parseResult.validCount}</strong> एलोकेशन रिकॉर्ड्स को अपडेट व इंसर्ट करेगी।
            </p>

            <button
              onClick={handleProceed}
              disabled={parseResult.validCount === 0 || isImplementing}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isImplementing ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>गूगल शीट में डेटा दर्ज हो रहा है...</span>
                </>
              ) : (
                <>
                  <span>मास्टर शीट में इम्प्लीमेंट करें ({parseResult.validCount} केस)</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {/* Preview of Parsed Data */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Table className="w-4 h-4 text-slate-500" />
                डिटेक्शन प्रीव्यू (Live Preview)
              </h4>
              <span className="text-[11px] text-slate-500">
                {parseResult.rows.length > 0 ? `दिखा रहा है: ${Math.min(parseResult.rows.length, 6)} / ${parseResult.rows.length}` : 'डेटा नहीं है'}
              </span>
            </div>

            {parseResult.rows.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                डेटा पेस्ट करते ही यहाँ लाइव प्रीव्यू दिखेगा।
              </div>
            ) : (
              <div className="overflow-x-auto max-h-56">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                      <th className="p-2">एग्रीमेंट आईडी</th>
                      <th className="p-2">एग्जीक्यूटिव</th>
                      <th className="p-2">तारीख</th>
                      <th className="p-2">स्थिति</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parseResult.rows.slice(0, 10).map((row, idx) => (
                      <tr key={idx} className={row.isValid ? 'hover:bg-slate-50' : 'bg-red-50/60'}>
                        <td className="p-2 font-mono font-medium text-slate-900">
                          {row.agreementId || <span className="text-red-500 italic">खाली</span>}
                        </td>
                        <td className="p-2 text-slate-800">
                          {row.executiveName || <span className="text-red-500 italic">खाली</span>}
                        </td>
                        <td className="p-2 text-slate-500 font-mono text-[11px]">
                          {row.allocationDate}
                        </td>
                        <td className="p-2">
                          {row.isValid ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              {existingAgreements.has(row.agreementId.toLowerCase()) ? 'अपडेट होगा' : 'नया दर्ज'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                              <AlertCircle className="w-3 h-3 text-red-600" />
                              अमान्य
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
    </div>
  );
};
