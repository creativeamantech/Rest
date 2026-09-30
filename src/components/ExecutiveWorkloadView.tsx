import React, { useMemo } from 'react';
import { AllocationItem } from '../types';
import {
  Users,
  Briefcase,
  ArrowRightLeft,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  Clock,
  Sparkles,
  UserCheck,
} from 'lucide-react';

interface ExecutiveWorkloadProps {
  allocations: AllocationItem[];
  executivesList: string[];
  onSelectExecutive: (name: string) => void;
  userRole?: 'Admin' | 'Executive';
  currentUserName?: string;
  currentUserUsername?: string;
}

export const ExecutiveWorkloadView: React.FC<ExecutiveWorkloadProps> = ({
  allocations,
  executivesList,
  onSelectExecutive,
  userRole = 'Admin',
  currentUserName = '',
  currentUserUsername = '',
}) => {
  const isAdmin = userRole === 'Admin';
  const myName = currentUserName.toLowerCase().trim();
  const myUser = currentUserUsername.toLowerCase().trim();

  const isMyCase = (caseExec: string) => {
    if (!caseExec) return false;
    const l = caseExec.toLowerCase().trim();
    return l === myName || l === myUser;
  };

  // ─────────────────────────────────────────────────────────────
  // 1. ADMIN VIEW DATA: All Executives & Team Workload
  // ─────────────────────────────────────────────────────────────
  const adminStats = useMemo(() => {
    if (!isAdmin) return [];
    return executivesList
      .map(exec => {
        const cases = allocations.filter(
          a => a.executiveName.toLowerCase().trim() === exec.toLowerCase().trim()
        );
        const allocated = cases.filter(
          c =>
            c.status.toLowerCase().includes('allocated') &&
            !c.status.toLowerCase().includes('unallocated')
        ).length;
        const transferred = cases.filter(c =>
          c.status.toLowerCase().includes('transferred')
        ).length;
        const paid = cases.filter(c => c.status.toLowerCase().includes('paid')).length;
        const closed = cases.filter(c => c.status.toLowerCase().includes('closed')).length;

        return {
          name: exec,
          total: cases.length,
          allocated,
          transferred,
          paid,
          closed,
          percentage:
            allocations.length > 0 ? Math.round((cases.length / allocations.length) * 100) : 0,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [isAdmin, executivesList, allocations]);

  const unallocatedCount = useMemo(() => {
    if (!isAdmin) return 0;
    return allocations.filter(
      a => a.status.toLowerCase().includes('unallocated') || !a.executiveName.trim()
    ).length;
  }, [isAdmin, allocations]);

  // ─────────────────────────────────────────────────────────────
  // 2. USER VIEW DATA: Particularly User's OWN Workload ONLY
  // ─────────────────────────────────────────────────────────────
  const myCases = useMemo(() => {
    return allocations.filter(a => isMyCase(a.executiveName));
  }, [allocations, myName, myUser]);

  const myMetrics = useMemo(() => {
    const total = myCases.length;
    const allocated = myCases.filter(
      c =>
        c.status.toLowerCase().includes('allocated') &&
        !c.status.toLowerCase().includes('unallocated')
    ).length;
    const transferred = myCases.filter(c =>
      c.status.toLowerCase().includes('transferred')
    ).length;
    const paid = myCases.filter(c => c.status.toLowerCase().includes('paid')).length;
    const closed = myCases.filter(c => c.status.toLowerCase().includes('closed')).length;
    const completionRate = total > 0 ? Math.round((paid / total) * 100) : 0;

    return {
      total,
      allocated,
      transferred,
      paid,
      closed,
      completionRate,
    };
  }, [myCases]);

  // ─────────────────────────────────────────────────────────────
  // RENDER FOR NORMAL USER: ONLY THEIR OWN WORKLOAD
  // ─────────────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div className="space-y-6">
        {/* User's Personal Workload Header Banner */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-blue-500/20">
                {(currentUserName[0] || currentUserUsername[0] || 'U').toUpperCase()}
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span>{currentUserName || currentUserUsername}</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                    एग्जीक्यूटिव
                  </span>
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  @{currentUserUsername} • व्यक्तिगत वर्कलोड विवरण
                </p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 px-3.5 py-1.5 rounded-xl text-xs text-blue-800 font-semibold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>प्राइवेट पोर्टल: केवल आपके आवंटित केस</span>
            </div>
          </div>

          <p className="text-xs text-slate-500 pt-3">
            यह आपका व्यक्तिगत डैशबोर्ड है। यहाँ केवल आपके नाम पर आवंटित केसेस की लाइव स्थिति,
            पेड (Paid) प्रगति और वर्कलोड उपलब्ध है।
          </p>
        </div>

        {/* User's 4 Main Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
              <Briefcase className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-slate-500 uppercase">मेरे कुल केस</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{myMetrics.total}</p>
            <p className="text-[11px] text-slate-400 mt-1">आपके नाम पर दर्ज</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center mb-3">
              <Clock className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-slate-600 uppercase">एक्टिव / एलोकेटेड</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{myMetrics.allocated}</p>
            <p className="text-[11px] text-slate-400 mt-1">वर्तमान में जारी</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-amber-700 uppercase">ट्रांसफर्ड केस</p>
            <p className="text-2xl font-black text-amber-900 mt-1">{myMetrics.transferred}</p>
            <p className="text-[11px] text-amber-600/70 mt-1">री-एलोकेटेड रिकॉर्ड</p>
          </div>

          <div className="bg-emerald-50/70 p-5 rounded-2xl border border-emerald-200 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center mb-3 shadow-sm shadow-emerald-600/30">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-emerald-800 uppercase">पेड केस (Paid)</p>
            <p className="text-2xl font-black text-emerald-900 mt-1">{myMetrics.paid}</p>
            <p className="text-[11px] text-emerald-700 font-medium mt-1">सफलतापूर्वक पूर्ण</p>
          </div>
        </div>

        {/* User's Progress Bar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-900">पेड (Paid) प्रगति व परफॉर्मेंस</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                कुल आवंटित केसों में से सफलतापूर्वक पेड केसों का प्रतिशत
              </p>
            </div>
            <span className="text-lg font-black text-emerald-600 font-mono">
              {myMetrics.completionRate}%
            </span>
          </div>

          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
            <div
              className="bg-emerald-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(myMetrics.completionRate, 100)}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 text-xs text-slate-600 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
              <span>पेड केस: {myMetrics.paid}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
              <span>एक्टिव केस: {myMetrics.allocated}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span>ट्रांसफर्ड केस: {myMetrics.transferred}</span>
            </div>
            <button
              onClick={() => onSelectExecutive(currentUserName || currentUserUsername)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
            >
              मास्टर टेबल में अपने केस देखें →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER FOR SYSTEM ADMINISTRATOR: ALL EXECUTIVES' WORKLOAD
  // ─────────────────────────────────────────────────────────────
  const totalAllocatedAll = allocations.filter(
    a =>
      a.status.toLowerCase().includes('allocated') &&
      !a.status.toLowerCase().includes('unallocated')
  ).length;
  const totalPaidAll = allocations.filter(a => a.status.toLowerCase().includes('paid')).length;

  return (
    <div className="space-y-6">
      {/* Top Banner for Admin */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-600" />
            <span>सिस्टम एडमिनिस्ट्रेटर: सभी एग्जीक्यूटिव्स का वर्कलोड (All Executives)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            प्रत्येक एग्जीक्यूटिव के कुल आवंटित, एक्टिव, ट्रांसफर्ड और पेड (Paid) केसेस का संपूर्ण लाइव विवरण:
          </p>
        </div>

        {unallocatedCount > 0 && (
          <div className="px-3.5 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-semibold flex items-center gap-2 shrink-0">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            <span>अनएलोकेटेड केस (Unallocated): {unallocatedCount}</span>
          </div>
        )}
      </div>

      {/* Admin Team Overview Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-semibold text-slate-500 uppercase">कुल एग्जीक्यूटिव्स</p>
          <p className="text-2xl font-black text-slate-900 mt-0.5">{executivesList.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-semibold text-blue-700 uppercase">कुल मास्टर केस</p>
          <p className="text-2xl font-black text-blue-900 mt-0.5">{allocations.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-semibold text-slate-600 uppercase">कुल एक्टिव केस</p>
          <p className="text-2xl font-black text-slate-800 mt-0.5">{totalAllocatedAll}</p>
        </div>
        <div className="bg-emerald-50/80 p-4 rounded-xl border border-emerald-200 shadow-xs">
          <p className="text-[11px] font-semibold text-emerald-800 uppercase">कुल पेड (Paid)</p>
          <p className="text-2xl font-black text-emerald-900 mt-0.5">{totalPaidAll}</p>
        </div>
      </div>

      {/* Grid of All Executives Workload Cards */}
      {adminStats.length === 0 ? (
        <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
          मास्टर शीट में अभी कोई एग्जीक्यूटिव डेटा नहीं है।
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {adminStats.map(item => (
            <div
              key={item.name}
              onClick={() => onSelectExecutive(item.name)}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-purple-400 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-sm">
                    {(item.name[0] || 'U').toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 group-hover:text-purple-600 transition-colors">
                      {item.name}
                    </h4>
                    <p className="text-xs text-slate-400">एग्जीक्यूटिव</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-purple-500 transition-colors" />
              </div>

              {/* Progress bar */}
              <div className="mt-4">
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span className="font-semibold">{item.total} केस</span>
                  <span className="text-slate-400">{item.percentage}% कुल का</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-purple-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(item.percentage, 100)}%` }}
                  />
                </div>
              </div>

              {/* Metrics mini pills: Allocated, Transferred, Paid */}
              <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100 text-center text-[11px]">
                <div className="bg-slate-50 p-2 rounded-lg">
                  <p className="text-slate-500">एलोकेटेड</p>
                  <p className="font-bold text-slate-800">{item.allocated}</p>
                </div>
                <div className="bg-amber-50/70 p-2 rounded-lg">
                  <p className="text-amber-700">ट्रांसफर्ड</p>
                  <p className="font-bold text-amber-800">{item.transferred}</p>
                </div>
                <div className="bg-emerald-50/80 p-2 rounded-lg border border-emerald-100">
                  <p className="text-emerald-700 font-semibold">पेड (Paid)</p>
                  <p className="font-black text-emerald-800">{item.paid}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
