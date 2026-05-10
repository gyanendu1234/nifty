'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clearAdminToken } from '@/components/admin/AdminGate';
import { Upload, List, BarChart3, LogOut, Settings } from 'lucide-react';

const NAV = [
  { href: '/admin',          icon: BarChart3,  label: 'Overview'   },
  { href: '/admin/upload',   icon: Upload,     label: 'Upload File' },
  { href: '/admin/periods',  icon: List,       label: 'Periods'    },
  { href: '/admin/companies',icon: Settings,   label: 'Companies'  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-slate-900 border-r border-slate-800 flex flex-col z-30">
      <div className="px-5 py-5 border-b border-slate-800">
        <p className="text-sm font-semibold text-slate-100">Admin Portal</p>
        <p className="text-xs text-slate-500">Nifty Ladder</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-slate-800">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800 mb-1"
        >
          <BarChart3 className="w-4 h-4" />View Dashboard
        </Link>
        <button
          onClick={clearAdminToken}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-900/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />Sign Out
        </button>
      </div>
    </aside>
  );
}
