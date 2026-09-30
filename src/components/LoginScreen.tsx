import React, { useState } from 'react';
import { UserAccount } from '../types';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  KeyRound,
  ArrowRight,
  Shield,
} from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (user: UserAccount) => void;
  usersList: UserAccount[];
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  usersList,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanUser || !cleanPass) {
      setErrorMessage('कृपया यूजर आईडी और पासवर्ड दोनों दर्ज करें।');
      return;
    }

    setIsSubmitting(true);

    // Look for matching user in usersList (loaded from Users_Auth sheet)
    const matchedUser = usersList.find(
      u => u.username.toLowerCase() === cleanUser && u.password === cleanPass
    );

    if (!matchedUser) {
      setIsSubmitting(false);
      setErrorMessage('अमान्य यूजर आईडी या पासवर्ड! कृपया दोबारा जांचें।');
      return;
    }

    if (matchedUser.status.toLowerCase() === 'inactive') {
      setIsSubmitting(false);
      setErrorMessage('यह अकाउंट निष्क्रिय (Inactive) कर दिया गया है। एडमिन से संपर्क करें।');
      return;
    }

    // Success
    setIsSubmitting(false);
    onLoginSuccess(matchedUser);
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-700 to-emerald-800 text-white p-7 text-center relative">
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-xs flex items-center justify-center mx-auto mb-3 shadow-inner">
            <Shield className="w-8 h-8 text-emerald-200" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            केस एलोकेशन पोर्टल
          </h2>
          <p className="text-xs sm:text-sm text-emerald-100 mt-1">
            सुरक्षित यूजर लॉगिन ऑथेंटिकेशन
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {errorMessage && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username / User ID */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-500" />
                <span>यूजर आईडी (User ID)</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="अपनी यूजर आईडी दर्ज करें"
                  className="w-full px-4 py-3 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium text-slate-800 placeholder-slate-400"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>पासवर्ड (Password)</span>
                </label>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="पासवर्ड दर्ज करें"
                  className="w-full pl-4 pr-11 py-3 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium text-slate-800 placeholder-slate-400"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>सत्यापन हो रहा है...</span>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>साइन इन करें (Login)</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Clean Minimal Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200/80 text-center text-xs text-slate-400">
          <span>अधिकृत यूज़र्स केवल • सुरक्षित ऑथेंटिकेशन पोर्टल</span>
        </div>
      </div>
    </div>
  );
};
