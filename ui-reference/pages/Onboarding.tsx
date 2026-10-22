
import React from 'react';
import { useNavigate } from 'react-router-dom';

const Onboarding: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden max-w-md mx-auto shadow-2xl bg-background-light dark:bg-background-dark">
      {/* Top Bar */}
      <div className="flex items-center justify-between p-6 pt-8 z-10">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center size-10 rounded-xl bg-primary/10 text-primary dark:bg-primary/20 dark:text-blue-400">
            <span className="material-symbols-outlined text-2xl">diamond</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">SubSense</h2>
        </div>
        <button onClick={() => navigate('/hub')} className="text-sm font-medium text-gray-500 hover:text-primary dark:text-gray-400 transition-colors">
          Log In
        </button>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 flex flex-col items-center overflow-y-auto px-6 pb-24">
        {/* Hero Text */}
        <div className="mt-4 flex flex-col items-center text-center space-y-4 max-w-xs mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold leading-tight tracking-tight text-gray-900 dark:text-white">
            Stop paying for <span className="text-primary">subscriptions</span> you don't use.
          </h1>
          <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed">
            We'll help you track expenses, cancel unwanted services, and decide smarter.
          </p>
        </div>

        {/* Visual / Video Placeholder */}
        <div className="w-full mt-10 mb-6 flex-1 flex flex-col justify-center min-h-[300px]">
          <div className="relative w-full aspect-[4/3] rounded-3xl overflow-hidden shadow-xl bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-800 dark:to-gray-900 border border-white/20 dark:border-white/5 group cursor-pointer">
            {/* Background Image */}
            <div 
              className="absolute inset-0 bg-cover bg-center opacity-90 transition-transform duration-700 group-hover:scale-105" 
              style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuA3qBSFNbRZeFk8q3n4FhwHNwCLokNTweIo3JeQGY62JwK9G4TzX-B6fwEjOhrks6QnZ9-QFO4tlds10EatG5DC5Qg0SM_E3SCgpk1-YKkM5UWLfOdx8W7x81lgSS4qF27ycZTvc3jIz8OBCOwhbxa6N-xy2pmeOCUa7jMXCeRHomfiJBLROv1K35ZdMsxD11t_zVD_UBMOIiZ4pfnmiXHheVZNomfi0w4syYREG3Dk-0uGzoIn-fa2mnJ_Gd8A0uLG9d_1c6rmMss')" }}
            >
            </div>
            {/* Overlay Gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
            
            {/* Play Button */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="size-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 text-white shadow-lg transition-transform transform group-hover:scale-110">
                <span className="material-symbols-outlined text-3xl ml-1">play_arrow</span>
              </div>
            </div>

            {/* Floating decorative pill */}
            <div className="absolute bottom-6 left-6 right-6 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-4 rounded-xl shadow-lg border border-white/50 dark:border-white/10 flex items-center gap-3 animate-pulse">
              <div className="size-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-500 dark:text-red-400">
                <span className="material-symbols-outlined">unsubscribe</span>
              </div>
              <div className="flex-1">
                <div className="h-2 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-1.5"></div>
                <div className="h-2 w-16 bg-gray-100 dark:bg-gray-600 rounded"></div>
              </div>
              <span className="text-xs font-bold text-gray-400 dark:text-gray-500">-$14.99</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action Area */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background-light via-background-light/95 to-transparent dark:from-background-dark dark:via-background-dark/95 pt-12">
        <button 
          onClick={() => navigate('/setup')} 
          className="w-full h-14 bg-mint-600 hover:bg-[#059669] active:scale-[0.98] transition-all rounded-xl text-white font-bold text-lg shadow-lg shadow-mint-500/20 flex items-center justify-center gap-2 group"
        >
          Get Started
          <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
        </button>
        <div className="mt-6 flex justify-center gap-1.5">
          <div className="h-1.5 w-6 rounded-full bg-primary"></div>
          <div className="h-1.5 w-1.5 rounded-full bg-gray-300 dark:bg-gray-700"></div>
          <div className="h-1.5 w-1.5 rounded-full bg-gray-300 dark:bg-gray-700"></div>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
