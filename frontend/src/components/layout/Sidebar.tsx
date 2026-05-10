'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, TrendingUp, ArrowLeftRight,
  GitCompare, Flame, Search as SearchIcon, ChevronRight, ChevronLeft,
} from 'lucide-react';

const NAV = [
  { href: '/dashboard',      icon: LayoutDashboard, label: 'Dashboard',      color: 'rgba(59,130,246,0.7)'  },
  { href: '/ladder',         icon: TrendingUp,      label: 'Ladder',         color: 'rgba(34,197,94,0.7)'   },
  { href: '/entry-exit',     icon: ArrowLeftRight,  label: 'Entry / Exit',   color: 'rgba(168,85,247,0.7)'  },
  { href: '/compare',        icon: GitCompare,      label: 'Compare',        color: 'rgba(14,165,233,0.7)'  },
  { href: '/rising-falling', icon: Flame,           label: 'Rising & Falling', color: 'rgba(234,179,8,0.7)' },
  { href: '/search',         icon: SearchIcon,      label: 'Search',         color: 'rgba(244,114,182,0.7)' },
];

interface Props {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: Props) {
  const pathname = usePathname();

  return (
    <aside
      className={`fixed left-0 top-0 h-screen flex flex-col z-30 transition-all duration-300 ease-in-out ${
        collapsed ? 'w-14' : 'w-60'
      }`}
      style={{
        background: 'rgba(10,14,26,0.92)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderRight: '1px solid rgba(148,163,184,0.08)',
        boxShadow: '4px 0 24px rgba(0,0,0,0.5), inset -1px 0 0 rgba(255,255,255,0.04)',
      }}
    >
      {/* Ambient glow */}
      <div
        className="absolute top-0 left-0 right-0 h-36 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 120% 80% at 50% -20%, rgba(59,130,246,0.12) 0%, transparent 70%)',
        }}
      />

      {/* Logo */}
      <div
        className={`relative border-b flex items-center ${collapsed ? 'px-3 py-5 justify-center' : 'px-4 py-5'}`}
        style={{ borderColor: 'rgba(148,163,184,0.08)' }}
      >
        {collapsed ? (
          <Link href="/dashboard" className="block">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm cursor-pointer transition-transform duration-200 hover:scale-110"
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                boxShadow: '0 2px 12px rgba(59,130,246,0.5), inset 0 1px 0 rgba(255,255,255,0.25)',
              }}
            >
              N
            </div>
          </Link>
        ) : (
          <Link href="/dashboard" className="flex items-center gap-3 cursor-pointer group">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0 transition-transform duration-200 group-hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                boxShadow: '0 2px 12px rgba(59,130,246,0.5), inset 0 1px 0 rgba(255,255,255,0.25)',
              }}
            >
              NL
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-100 leading-tight tracking-tight">Nifty Ladder</div>
              <div className="text-[10px] text-slate-500 tracking-wide uppercase">Market Cap Trends</div>
            </div>
          </Link>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, icon: Icon, label, color }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium cursor-pointer overflow-hidden transition-all duration-200 ${
                active ? 'text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
              style={
                active
                  ? {
                      background: `linear-gradient(135deg, rgba(59,130,246,0.18) 0%, rgba(59,130,246,0.08) 100%)`,
                      border: '1px solid rgba(59,130,246,0.25)',
                      boxShadow: `0 2px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06), 0 0 20px rgba(59,130,246,0.12)`,
                    }
                  : { border: '1px solid transparent' }
              }
            >
              {active && (
                <div
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r"
                  style={{ background: color }}
                />
              )}
              <Icon
                className="w-4 h-4 shrink-0 transition-transform duration-200"
                style={active ? { filter: `drop-shadow(0 0 6px ${color})` } : {}}
              />
              {!collapsed && (
                <>
                  <span className="flex-1 truncate">{label}</span>
                  {active && <ChevronRight className="w-3 h-3 opacity-50 shrink-0" style={{ color }} />}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div
        className="px-2 py-3 border-t"
        style={{ borderColor: 'rgba(148,163,184,0.08)' }}
      >
        {!collapsed && (
          <p className="text-[10px] text-slate-600 leading-tight px-1 mb-2">Not investment advice.</p>
        )}
        <button
          onClick={onToggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-500 hover:text-slate-300 cursor-pointer transition-all duration-200"
          style={{ border: '1px solid transparent' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(148,163,184,0.06)';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(148,163,184,0.1)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = '';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent';
          }}
        >
          {collapsed
            ? <ChevronRight className="w-4 h-4" />
            : <><ChevronLeft className="w-4 h-4" /><span>Collapse</span></>
          }
        </button>
      </div>
    </aside>
  );
}
