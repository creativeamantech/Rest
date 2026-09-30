import React from 'react';
import { AuthSession } from '../types';
import {
  FileSpreadsheet,
  ExternalLink,
  RefreshCw,
  Database,
  LogOut,
  Shield,
  User as UserIcon,
  UploadCloud,
  Cloud,
} from 'lucide-react';

interface HeaderProps {
  session: AuthSession | null;
  onLogout: () => void;
  activeSpreadsheetId: string | null;
  activeSpreadsheetName: string;
  onOpenSheetSelector: () => void;
  onRefreshData: () => void;
  isRefreshing: boolean;
  lastSynced: Date | null;
  totalAllocationsCount: number;
  pendingQueueCount?: number;
  onFlushPendingQueue?: () => void;
  isGoogleConnected?: boolean;
  onConnectGoogle?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  session,
  onLogout,
  activeSpreadsheetId,
  activeSpreadsheetName,
  onOpenSheetSelector,
  onRefreshData,
  isRefreshing,
  lastSynced,
  totalAllocationsCount,
  pendingQueueCount = 0,
  onFlushPendingQueue,
  isGoogleConnected = false,
  onConnectGoogle,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-4">
          {/* Logo & Title */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
                  Case Allocation Master
                </h1>
                <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">
                  Google Sheet Connected
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate">
                एग्रीमेंट आईडी & एग्जीक्यूटिव एलोकेशन • यूजर ट्रांसफर ट्रैकिंग
              </p>
            </div>
          </div>

          {/* Center: Connected Sheet Indicator */}
          {session && (
            <div className="hidden lg:flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700">
              <div className="flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>शीट:</span>
                <span className="font-semibold text-slate-900 max-w-[150px] truncate" title={activeSpreadsheetName}>
                  {activeSpreadsheetName || 'कोई शीट कनेक्ट नहीं'}
                </span>
              </div>

              {activeSpreadsheetId && session.role === 'Admin' && (
                <a
                  href={`https://docs.google.com/spreadsheets/d/${activeSpreadsheetId}/edit`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-700 hover:text-emerald-800 flex items-center gap-0.5 ml-1 font-semibold underline underline-offset-2"
                  title="Google Sheets में खोलें"
                >
                  खोलें <ExternalLink className="w-3 h-3" />
                </a>
              )}

              {session.role === 'Admin' && (
                <button
                  onClick={onOpenSheetSelector}
                  className="text-blue-600 hover:text-blue-800 ml-2 hover:underline cursor-pointer"
                >
                  (बदलें)
                </button>
              )}
            </div>
          )}

          {/* Right: Actions & User Info */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {session && (
              <>
                {/* Pending Cloud Sync Queue Indicator for Admin */}
                {session.role === 'Admin' && pendingQueueCount > 0 && (
                  <button
                    onClick={onFlushPendingQueue}
                    disabled={isRefreshing}
                    title="एग्जीक्यूटिव्स का पेंडिंग फीडबैक Google Sheet में तुरंत सिंक करें"
                    className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer animate-pulse transition-all"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>{pendingQueueCount} क्लाउड सिंक पेंडिंग</span>
                  </button>
                )}

                {/* Google Connection Status / Connect Button for Admin */}
                {session.role === 'Admin' && !isGoogleConnected && onConnectGoogle && (
                  <button
                    onClick={onConnectGoogle}
                    className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-semibold text-xs rounded-xl flex items-center gap-1 cursor-pointer transition-colors"
                    title="Google Sheets अधिकृत करें"
                  >
                    <Cloud className="w-3.5 h-3.5 text-blue-600" />
                    <span className="hidden sm:inline">Google जोड़ें</span>
                  </button>
                )}

                <button
                  onClick={onRefreshData}
                  disabled={isRefreshing || !activeSpreadsheetId}
                  title="गूगल शीट से रिफ्रेश करें"
                  className="p-2 sm:px-3 sm:py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
                  <span className="hidden sm:inline">
                    {isRefreshing ? 'सिंक...' : 'रिफ्रेश'}
                  </span>
                </button>

                {session.role === 'Admin' && (
                  <button
                    onClick={onOpenSheetSelector}
                    title="शीट सेटिंग्स व चुनाव"
                    className="p-2 sm:px-3 sm:py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Database className="w-3.5 h-3.5 text-slate-600" />
                    <span className="hidden sm:inline">शीट सेटअप</span>
                  </button>
                )}

                {/* Logged in User Profile */}
                <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                  <div className={`w-8 h-8 rounded-full font-bold flex items-center justify-center text-xs text-white shadow-xs ${
                    session.role === 'Admin' ? 'bg-purple-600' : 'bg-blue-600'
                  }`}>
                    {session.role === 'Admin' ? <Shield className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                  </div>

                  <div className="hidden sm:block text-left text-xs">
                    <p className="font-bold text-slate-900 leading-tight truncate max-w-[120px]">
                      {session.fullName || session.username}
                    </p>
                    <div className="flex items-center gap-1 text-[10px]">
                      <span className="text-slate-400 font-mono">@{session.username}</span>
                      <span className={`px-1 rounded font-semibold ${
                        session.role === 'Admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {session.role}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={onLogout}
                    title="साइन आउट / लॉगआउट"
                    className="p-2 text-slate-400 hover:text-red-600 rounded-xl hover:bg-red-50 transition-colors cursor-pointer ml-1"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
