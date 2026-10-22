'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

// SVG icons matching Ionicons used in the app
const Icons = {
  list: (color: string) => (
    <svg width="22" height="22" viewBox="0 0 512 512" fill="none">
      <line x1="160" y1="144" x2="448" y2="144" stroke={color} strokeWidth="44" strokeLinecap="round"/>
      <line x1="160" y1="256" x2="448" y2="256" stroke={color} strokeWidth="44" strokeLinecap="round"/>
      <line x1="160" y1="368" x2="448" y2="368" stroke={color} strokeWidth="44" strokeLinecap="round"/>
      <circle cx="80" cy="144" r="28" fill={color}/>
      <circle cx="80" cy="256" r="28" fill={color}/>
      <circle cx="80" cy="368" r="28" fill={color}/>
    </svg>
  ),
  checkmarkCircleOutline: (color: string) => (
    <svg width="22" height="22" viewBox="0 0 512 512" fill="none">
      <circle cx="256" cy="256" r="224" stroke={color} strokeWidth="40"/>
      <polyline points="160,256 224,320 352,192" stroke={color} strokeWidth="44" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  ),
  search: (color: string) => (
    <svg width="22" height="22" viewBox="0 0 512 512" fill="none">
      <circle cx="218" cy="218" r="170" stroke={color} strokeWidth="44"/>
      <line x1="340" y1="340" x2="464" y2="464" stroke={color} strokeWidth="44" strokeLinecap="round"/>
    </svg>
  ),
  statsChart: (color: string) => (
    <svg width="22" height="22" viewBox="0 0 512 512" fill="none">
      <rect x="32"  y="320" width="80" height="144" rx="12" fill={color}/>
      <rect x="152" y="224" width="80" height="240" rx="12" fill={color}/>
      <rect x="272" y="128" width="80" height="336" rx="12" fill={color}/>
      <rect x="392" y="48"  width="80" height="416" rx="12" fill={color}/>
    </svg>
  ),
};

const TABS = [
  { path: '/dashboard', label: 'Manager',  icon: Icons.list },
  { path: '/checkin',   label: 'Check-In', icon: Icons.checkmarkCircleOutline },
  { path: '/audit',     label: 'Audit',    icon: Icons.search },
  { path: '/report',    label: 'Report',   icon: Icons.statsChart },
];

const HIDE_PATHS = ['/', '/login', '/setup'];

export default function BottomNav() {
  const pathname = usePathname();
  const router   = useRouter();
  const [navHidden, setNavHidden] = useState(false);

  useEffect(() => {
    const handleHide = () => setNavHidden(true);
    const handleShow = () => setNavHidden(false);
    window.addEventListener('hide-bottom-nav', handleHide);
    window.addEventListener('show-bottom-nav', handleShow);
    return () => {
      window.removeEventListener('hide-bottom-nav', handleHide);
      window.removeEventListener('show-bottom-nav', handleShow);
    };
  }, []);

  const hide =
    HIDE_PATHS.includes(pathname) ||
    pathname === '/subscription/new' ||
    pathname.endsWith('/edit');
  if (hide || navHidden) return null;

  const isActive = (path: string) =>
    pathname === path || (path !== '/dashboard' && pathname.startsWith(path));

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-20 bg-white"
      style={{ boxShadow: '0 -2px 10px rgba(0,0,0,0.08)' }}
    >
      <div
        className="max-w-lg mx-auto flex"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {TABS.map(tab => {
          const active = isActive(tab.path);
          const color  = active ? '#3B82F6' : '#9CA3AF';
          return (
            <button
              key={tab.path}
              onClick={() => router.push(tab.path)}
              className="flex-1 flex flex-col items-center pt-1.5 pb-2 gap-0 px-1.5 transition-transform active:scale-110"
              style={{ transform: active ? 'scale(1.05)' : 'scale(1)', transition: 'transform 0.15s cubic-bezier(0.34,1.56,0.64,1)' }}
            >
              <div className="mt-1">{tab.icon(color)}</div>
              <span
                className="text-[10px] font-black tracking-[0.05em] uppercase mt-1"
                style={{ color }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
