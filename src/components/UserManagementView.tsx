import React, { useState } from 'react';
import { UserAccount } from '../types';
import {
  Users,
  UserPlus,
  Shield,
  Key,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Search,
  Lock,
  Calendar,
  Save,
  X,
  ExternalLink,
  FileSpreadsheet,
} from 'lucide-react';

interface UserManagementProps {
  usersList: UserAccount[];
  onAddUser: (user: UserAccount) => Promise<void>;
  onUpdateUser: (user: UserAccount) => Promise<void>;
  isProcessing: boolean;
  connectedSheetName: string;
  activeSpreadsheetId?: string | null;
  onOpenSheetSettings?: () => void;
}

export const UserManagementView: React.FC<UserManagementProps> = ({
  usersList,
  onAddUser,
  onUpdateUser,
  isProcessing,
  connectedSheetName,
  activeSpreadsheetId,
  onOpenSheetSettings,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  // New User Form State
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<'Admin' | 'Executive'>('Executive');

  // Edit User State
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState<'Admin' | 'Executive'>('Executive');
  const [editStatus, setEditStatus] = useState<'Active' | 'Inactive'>('Active');

  const filteredUsers = usersList.filter(
    u =>
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const togglePasswordVisibility = (username: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [username]: !prev[username],
    }));
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim()) return;

    await onAddUser({
      username: newUsername.trim(),
      password: newPassword.trim(),
      fullName: newFullName.trim() || newUsername.trim(),
      role: newRole,
      status: 'Active',
      createdDate: new Date().toISOString().split('T')[0],
    });

    setNewUsername('');
    setNewPassword('');
    setNewFullName('');
    setNewRole('Executive');
    setShowAddModal(false);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    await onUpdateUser({
      ...editingUser,
      password: editPassword.trim() || editingUser.password,
      role: editRole,
      status: editStatus,
    });

    setEditingUser(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-purple-700 to-indigo-800 text-white p-5 rounded-2xl shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-6 h-6 text-purple-200" />
              <h2 className="text-xl font-bold">यूजर व क्रेडेंशियल्स प्रबंधन (Users_Auth)</h2>
            </div>
            <p className="text-purple-100 text-sm mt-1 max-w-2xl">
              सभी एडमिन और एग्जीक्यूटिव्स के <strong>यूजरनेम, पासवर्ड व रोल्स</strong> Google Sheet के <code>Users_Auth</code> टैब में सुरक्षित रहते हैं। यहाँ से आप नए यूजर जोड़ सकते हैं या पासवर्ड बदल सकते हैं।
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 bg-white text-purple-900 font-bold text-xs sm:text-sm rounded-xl shadow-xs hover:bg-purple-50 transition-colors flex items-center gap-2 cursor-pointer shrink-0"
          >
            <UserPlus className="w-4 h-4 text-purple-700" />
            <span>+ नया यूजर जोड़ें</span>
          </button>
        </div>
      </div>

      {/* Google Sheet Live Connection Location Box */}
      <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-emerald-600/30">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-800">
                Google Drive फ़ाइल:
              </span>
              <span className="text-xs font-black text-emerald-800 bg-white px-2 py-0.5 rounded-md border border-emerald-200">
                {connectedSheetName}
              </span>
              <span className="text-[11px] font-semibold text-slate-600">
                • टैब: <code className="bg-white px-1.5 py-0.5 rounded font-mono font-bold text-purple-700 border border-purple-200">Users_Auth</code> (पहला टैब)
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              सभी एडमिन और यूज़र्स के लॉगिन क्रेडेंशियल्स (यूजरनेम, पासवर्ड, रोल) इसी Google Sheet में लाइव सेव और सिंक होते हैं।
            </p>
          </div>
        </div>

        {activeSpreadsheetId ? (
          <a
            href={`https://docs.google.com/spreadsheets/d/${activeSpreadsheetId}/edit`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
            title="Google Sheets में यह स्प्रेडशीट खोलें"
          >
            <span>Google Sheets में खोलें</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        ) : (
          onOpenSheetSettings && (
            <button
              onClick={onOpenSheetSettings}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all shrink-0 cursor-pointer"
            >
              शीट कनेक्ट / क्रिएट करें
            </button>
          )
        )}
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="यूजरनेम या नाम से खोजें..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="font-semibold text-slate-700">
            कुल यूजर: {usersList.length}
          </span>
          <span className="text-purple-700 font-medium">
            एडमिन: {usersList.filter(u => u.role === 'Admin').length}
          </span>
          <span className="text-blue-700 font-medium">
            एग्जीक्यूटिव्स: {usersList.filter(u => u.role === 'Executive').length}
          </span>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">यूजरनेम (User ID)</th>
                <th className="py-3.5 px-4">पूरा नाम (Full Name)</th>
                <th className="py-3.5 px-4">पासवर्ड (Password)</th>
                <th className="py-3.5 px-4">रोल (Role)</th>
                <th className="py-3.5 px-4">स्थिति (Status)</th>
                <th className="py-3.5 px-4">तारीख</th>
                <th className="py-3.5 px-4 text-right">कार्रवाई (Action)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    कोई यूजर नहीं मिला।
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => {
                  const isPassVisible = showPasswords[user.username] || false;
                  return (
                    <tr key={user.username} className="hover:bg-slate-50/80 transition-colors">
                      {/* Username */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {user.username}
                      </td>

                      {/* Full Name */}
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {user.fullName}
                      </td>

                      {/* Password */}
                      <td className="py-3 px-4 font-mono">
                        <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-1 rounded-md text-[11px]">
                          <span>{isPassVisible ? user.password : '••••••••'}</span>
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(user.username)}
                            className="text-slate-400 hover:text-slate-600 cursor-pointer ml-1"
                            title={isPassVisible ? 'छुपाएं' : 'दिखाएं'}
                          >
                            {isPassVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3 px-4">
                        {user.role === 'Admin' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                            <Shield className="w-3 h-3 text-purple-600" />
                            Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                            Executive
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {user.status === 'Active' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                            <XCircle className="w-3 h-3 text-slate-400" />
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="py-3 px-4 text-slate-400 text-[11px] font-mono">
                        {user.createdDate || '-'}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setEditingUser(user);
                            setEditPassword(user.password);
                            setEditRole(user.role);
                            setEditStatus(user.status);
                          }}
                          className="px-2.5 py-1 text-xs text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg font-medium cursor-pointer transition-colors"
                        >
                          एडिट / पासवर्ड
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add New User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-200 text-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-purple-600" />
                <h3 className="text-base font-bold text-slate-900">नया यूजर / एग्जीक्यूटिव जोड़ें</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">यूजर आईडी / यूजरनेम *:</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                  placeholder="उदा. sunil, pooja, admin2"
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-300 font-mono"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">पूरा नाम (Full Name):</label>
                <input
                  type="text"
                  value={newFullName}
                  onChange={e => setNewFullName(e.target.value)}
                  placeholder="उदा. Sunil Kumar"
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-300"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">पासवर्ड (Password) *:</label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="उदा. pass123"
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-300 font-mono"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">रोल (Role):</label>
                <select
                  value={newRole}
                  onChange={e => setNewRole(e.target.value as 'Admin' | 'Executive')}
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-300 bg-white"
                >
                  <option value="Executive">Executive (एग्जीक्यूटिव / केस असाइनी)</option>
                  <option value="Admin">Admin (सिस्टम एडमिनिस्ट्रेटर)</option>
                </select>
              </div>

              <div className="p-3 bg-purple-50/70 rounded-xl border border-purple-100 text-[11px] text-purple-900">
                यह यूजर क्रेडेंशियल सीधे Google Sheet के <code>Users_Auth</code> टैब में दर्ज होगा।
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={isProcessing}
                  className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  रद्द करें
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl cursor-pointer shadow-xs"
                >
                  {isProcessing ? 'सेव हो रहा है...' : 'शीट में जोड़ें'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-200 text-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                यूजर एडिट: <span className="font-mono text-purple-700">{editingUser.username}</span>
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">नया पासवर्ड:</label>
                <input
                  type="text"
                  value={editPassword}
                  onChange={e => setEditPassword(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-300 font-mono"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">रोल (Role):</label>
                <select
                  value={editRole}
                  onChange={e => setEditRole(e.target.value as 'Admin' | 'Executive')}
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-300 bg-white"
                >
                  <option value="Executive">Executive</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">स्थिति (Status):</label>
                <select
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value as 'Active' | 'Inactive')}
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-300 bg-white"
                >
                  <option value="Active">Active (सक्रिय)</option>
                  <option value="Inactive">Inactive (निष्क्रिय)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  disabled={isProcessing}
                  className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  रद्द करें
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl cursor-pointer shadow-xs"
                >
                  {isProcessing ? 'अपडेट हो रहा है...' : 'शीट में अपडेट करें'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
