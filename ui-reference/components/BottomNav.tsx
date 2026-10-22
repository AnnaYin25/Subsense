
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const getButtonClass = (path: string) => {
    const isActive = location.pathname === path;
    return isActive 
      ? "flex flex-col items-center justify-center w-full h-full text-primary gap-1"
      : "flex flex-col items-center justify-center w-full h-full text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 gap-1";
  };

  // Only show on main app pages
  const showNav = ['/hub', '/checkin', '/report', '/assessment', '/add'].some(path => location.pathname.startsWith(path));
  if (!showNav) return null;

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#1e2430] border-t border-slate-200 dark:border-slate-800 shrink-0 pb-safe z-40 max-w-md mx-auto">
        <div className="flex justify-between items-end h-16 px-2 relative">
          
          {/* Left Side */}
          <div className="flex flex-1 justify-around h-full">
            <button onClick={() => navigate('/assessment')} className={getButtonClass('/assessment')}>
              <span style={{ fontVariationSettings: location.pathname === '/assessment' ? "'FILL' 1" : "'FILL' 0" }} className="material-symbols-outlined text-[24px]">fact_check</span>
              <span className="text-[10px] font-medium">Audit</span>
            </button>
            <button onClick={() => navigate('/checkin')} className={getButtonClass('/checkin')}>
              <span style={{ fontVariationSettings: location.pathname === '/checkin' ? "'FILL' 1" : "'FILL' 0" }} className="material-symbols-outlined text-[24px]">check_circle</span>
              <span className="text-[10px] font-medium">Check-in</span>
            </button>
          </div>

          {/* Center Plus Button (Floating Effect) */}
          <div className="relative -top-5 mx-2">
            <button 
              onClick={() => navigate('/add')} 
              className="flex items-center justify-center size-14 rounded-full bg-primary text-white shadow-lg shadow-primary/40 active:scale-95 transition-transform hover:bg-blue-600 ring-4 ring-background-light dark:ring-background-dark"
            >
              <span className="material-symbols-outlined text-[32px]">add</span>
            </button>
          </div>

          {/* Right Side */}
          <div className="flex flex-1 justify-around h-full">
            <button onClick={() => navigate('/report')} className={getButtonClass('/report')}>
              <span style={{ fontVariationSettings: location.pathname === '/report' ? "'FILL' 1" : "'FILL' 0" }} className="material-symbols-outlined text-[24px]">pie_chart</span>
              <span className="text-[10px] font-medium">Reports</span>
            </button>
            <button onClick={() => navigate('/hub')} className={getButtonClass('/hub')}>
              <span style={{ fontVariationSettings: location.pathname === '/hub' ? "'FILL' 1" : "'FILL' 0" }} className="material-symbols-outlined text-[24px]">list_alt</span>
              <span className="text-[10px] font-medium">Manager</span>
            </button>
          </div>

        </div>
      </nav>
      {/* Safe Area spacing for bottom nav */}
      <div className="h-16 bg-white dark:bg-[#1e2330] w-full shrink-0 max-w-md mx-auto"></div>
    </>
  );
};
