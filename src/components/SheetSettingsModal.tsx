import React, { useState } from 'react';
import { SpreadsheetInfo } from '../types';
import {
  FileSpreadsheet,
  PlusCircle,
  FolderOpen,
  Link2,
  X,
  CheckCircle,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';

interface SheetSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSpreadsheetId: string | null;
  activeSpreadsheetName: string;
  driveSpreadsheets: SpreadsheetInfo[];
  isLoadingDrive: boolean;
  onSelectExistingSheet: (id: string, name: string) => Promise<void>;
  onCreateNewSheet: (title: string) => Promise<void>;
  onRefreshDriveList: () => void;
  isProcessing: boolean;
}

export const SheetSettingsModal: React.FC<SheetSettingsModalProps> = ({
  isOpen,
  onClose,
  activeSpreadsheetId,
  activeSpreadsheetName,
  driveSpreadsheets,
  isLoadingDrive,
  onSelectExistingSheet,
  onCreateNewSheet,
  onRefreshDriveList,
  isProcessing,
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'select' | 'custom'>('create');
  const [newSheetTitle, setNewSheetTitle] = useState('Case Allocation Master Sheet');
  const [customInput, setCustomInput] = useState('');

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSheetTitle.trim()) return;
    await onCreateNewSheet(newSheetTitle.trim());
    onClose();
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;

    // Extract ID if full URL pasted
    let id = customInput.trim();
    const match = id.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      id = match[1];
    }

    await onSelectExistingSheet(id, 'Custom Connected Sheet');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800">
        {/* Modal Header */}
        <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Google Sheet कनेक्शन सेटिंग्स</h3>
              <p className="text-xs text-slate-500">मास्टर डेटा व ट्रांसफर लॉग्स के लिए स्प्रेडशीट चुनें</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Connected Sheet Banner */}
        {activeSpreadsheetId && (
          <div className="p-4 bg-emerald-50/70 border-b border-emerald-100 flex items-center justify-between text-xs text-emerald-900">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <span className="font-semibold">वर्तमान एक्टिव शीट: </span>
                <span className="font-bold">{activeSpreadsheetName}</span>
              </div>
            </div>
            <a
              href={`https://docs.google.com/spreadsheets/d/${activeSpreadsheetId}/edit`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-700 hover:text-emerald-900 underline flex items-center gap-1 font-semibold"
            >
              खोलें <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 text-xs font-semibold bg-white">
          <button
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 border-b-2 cursor-pointer transition-colors ${
              activeTab === 'create'
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/30'
                : 'border-transparent text-slate-600 hover:bg-slate-50'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>नई शीट बनाएं (1-Click)</span>
          </button>
          <button
            onClick={() => setActiveTab('select')}
            className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 border-b-2 cursor-pointer transition-colors ${
              activeTab === 'select'
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/30'
                : 'border-transparent text-slate-600 hover:bg-slate-50'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            <span>ड्राइव से चुनें ({driveSpreadsheets.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 border-b-2 cursor-pointer transition-colors ${
              activeTab === 'custom'
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/30'
                : 'border-transparent text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Link2 className="w-4 h-4" />
            <span>URL / Sheet ID</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'create' && (
            <form onSubmit={handleCreate} className="space-y-4">
              <p className="text-xs text-slate-600">
                यह आपके Google Drive में आवश्यक दोनों टैब्स (<code>Master_Allocations</code> और <code>Transfer_Logs</code>) के साथ बिल्कुल नई स्प्रेडशीट स्वचालित बना देगा।
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">शीट का नाम (Spreadsheet Name):</label>
                <input
                  type="text"
                  value={newSheetTitle}
                  onChange={e => setNewSheetTitle(e.target.value)}
                  className="w-full p-3 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  placeholder="उदा. Case Allocation Master Sheet"
                  required
                />
              </div>

              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-slate-800">स्वतः तैयार होने वाले टैब:</p>
                <p>• <strong>Master_Allocations:</strong> Agreement ID, Executive Name, Allocation Date, Status, Last Updated, Notes</p>
                <p>• <strong>Transfer_Logs:</strong> Timestamp, Agreement ID, From Executive, To Executive, Transferred By, Reason</p>
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? 'शीट बनाई जा रही है...' : 'नई Google Sheet बनाएं व कनेक्ट करें'}
              </button>
            </form>
          )}

          {activeTab === 'select' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>आपकी Google Drive की स्प्रेडशीट्स:</span>
                <button
                  type="button"
                  onClick={onRefreshDriveList}
                  disabled={isLoadingDrive}
                  className="text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingDrive ? 'animate-spin' : ''}`} />
                  रिफ्रेश करें
                </button>
              </div>

              {isLoadingDrive ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  Google Drive से शीट्स खोजी जा रही हैं...
                </div>
              ) : driveSpreadsheets.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  ड्राइव में कोई स्प्रेडशीट नहीं मिली। आप 'नई शीट बनाएं' विकल्प से 1-क्लिक में शीट बना सकते हैं।
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-2 border border-slate-200 rounded-xl p-2 bg-slate-50/50">
                  {driveSpreadsheets.map(sheet => {
                    const isSelected = sheet.id === activeSpreadsheetId;
                    return (
                      <div
                        key={sheet.id}
                        onClick={async () => {
                          await onSelectExistingSheet(sheet.id, sheet.name);
                          onClose();
                        }}
                        className={`p-3 rounded-xl flex items-center justify-between text-xs cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-emerald-50 border border-emerald-300 font-bold text-emerald-900'
                            : 'bg-white hover:bg-slate-100 border border-slate-200 text-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <FileSpreadsheet className={`w-4 h-4 shrink-0 ${isSelected ? 'text-emerald-600' : 'text-slate-400'}`} />
                          <span className="truncate">{sheet.name}</span>
                        </div>
                        {isSelected && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full shrink-0 font-bold">
                            कनेक्टेड
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'custom' && (
            <form onSubmit={handleCustomSubmit} className="space-y-4">
              <p className="text-xs text-slate-600">
                अपनी किसी भी मौजूदा Google Spreadsheet का URL या आईडी यहाँ पेस्ट करें:
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Google Sheet URL / Spreadsheet ID:</label>
                <input
                  type="text"
                  value={customInput}
                  onChange={e => setCustomInput(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
                  className="w-full p-3 text-xs font-mono rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? 'कनेक्ट हो रहा है...' : 'शीट कनेक्ट करें'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
