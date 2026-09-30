import React, { useState } from 'react';
import { VBA_MACRO_CODE, downloadVbaModuleFile } from '../services/vbaMacroService';
import { exportBlankTemplateWithValidation } from '../services/excelExportService';
import {
  FileCode,
  Copy,
  Check,
  Download,
  Terminal,
  ShieldAlert,
  Sparkles,
  ExternalLink,
  Lock,
  History,
  Clock,
  FileSpreadsheet,
} from 'lucide-react';

interface MacroGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MacroGuideModal: React.FC<MacroGuideModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  const [isDownloadingMacro, setIsDownloadingMacro] = useState(false);

  if (!isOpen) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(VBA_MACRO_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadMacroFile = async () => {
    try {
      setIsDownloadingMacro(true);
      await exportBlankTemplateWithValidation();
    } catch (e) {
      console.error(e);
    } finally {
      setIsDownloadingMacro(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold flex items-center gap-2">
                <span>ऑफलाइन Excel मैक्रो ऑटोमेशन (.xlsm / VBA)</span>
                <span className="text-[10px] bg-emerald-500 text-slate-950 font-extrabold px-2 py-0.5 rounded-full uppercase">
                  Ready to Run
                </span>
              </h3>
              <p className="text-xs text-slate-300">
                ऑफलाइन Excel में ऑटो-टाइमस्टैम्प (यूनिक सेकंड्स) और ऑटो-फीडबैक हिस्ट्री का फुल सॉल्यूशन
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer text-sm"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Quick Value Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-teal-50 border border-teal-200 rounded-2xl flex items-start gap-2.5 text-xs text-teal-950">
              <Clock className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">7 फीडबैक कॉलम्स + टाइमस्टैम्प</strong>
                <span className="text-slate-600 text-[11px]">Availability, Standard, Notes, Ref 1 व Ref 2 सबका अलग टाइम</span>
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-2.5 text-xs text-blue-950">
              <History className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">कॉल अंतर (Time Gap) हिस्ट्री</strong>
                <span className="text-slate-600 text-[11px]">कॉल ड्यूरेशन की जगह एक इनपुट से दूसरे इनपुट के बीच का समय अंतराल</span>
              </div>
            </div>

            <div className="p-3 bg-purple-50 border border-purple-200 rounded-2xl flex items-start gap-2.5 text-xs text-purple-950">
              <Lock className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">100% टैम्पर-प्रूफ ऑटो लॉक</strong>
                <span className="text-slate-600 text-[11px]">ऑडिट व हिस्ट्री शीट्स पासवर्ड से लॉक रहती हैं</span>
              </div>
            </div>
          </div>

          {/* 3-Step Setup Instructions */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-slate-700" />
              <span>30 सेकंड में एक्टिवेट करने का आसान तरीका:</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white font-bold text-[11px] inline-flex items-center justify-center">
                  1
                </span>
                <p className="font-bold text-slate-800">Excel फ़ाइल खोलें</p>
                <p className="text-[11px] text-slate-500">
                  डाउनलोड की गई Excel फ़ाइल खोलें और कीबोर्ड पर <strong>Alt + F11</strong> दबाएं।
                </p>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white font-bold text-[11px] inline-flex items-center justify-center">
                  2
                </span>
                <p className="font-bold text-slate-800">Calling_Feedback पर क्लिक करें</p>
                <p className="text-[11px] text-slate-500">
                  बाएं पैनल में <code>Sheet1 (Calling_Feedback)</code> पर डबल क्लिक करें और नीचे का कोड पेस्ट कर दें।
                </p>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[11px] inline-flex items-center justify-center">
                  3
                </span>
                <p className="font-bold text-emerald-800">.xlsm के रूप में सेव करें</p>
                <p className="text-[11px] text-slate-500">
                  फ़ाइल को <strong>Save As → Excel Macro-Enabled (*.xlsm)</strong> चुनकर सेव कर लें। बस, मैक्रो सक्रिय है!
                </p>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>रेडी-टू-यूज़ VBA मैक्रो कोड:</span>
            </span>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadMacroFile}
                disabled={isDownloadingMacro}
                className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-purple-200" />
                <span>{isDownloadingMacro ? 'डाउनलोड हो रहा है...' : 'डायरेक्ट मैक्रो फ़ाइल (.xlsm) डाउनलोड करें'}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyCode}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'कोड कॉपी हो गया!' : 'मैक्रो कोड कॉपी'}</span>
              </button>

              <button
                type="button"
                onClick={downloadVbaModuleFile}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>.bas फ़ाइल</span>
              </button>
            </div>
          </div>

          {/* Code Viewer */}
          <div className="relative rounded-2xl bg-slate-950 p-4 border border-slate-800 overflow-hidden text-xs font-mono text-emerald-400">
            <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap leading-relaxed">
              {VBA_MACRO_CODE}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 text-xs">
          <p className="text-slate-500 text-[11px]">
            🔒 पासवर्ड लॉक: <code>AuditLock@Secure2026</code> (यह पासवर्ड बैकग्राउंड में शीट्स को लॉक रखता है)
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition-colors cursor-pointer text-xs"
          >
            समझ गया (बंद करें)
          </button>
        </div>
      </div>
    </div>
  );
};
