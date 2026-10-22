
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscriptions } from '../context/SubscriptionContext';

const CheckIn: React.FC = () => {
  const navigate = useNavigate();
  const { subscriptions, user } = useSubscriptions();
  // Filter only active subscriptions for check-in
  const activeSubs = subscriptions.filter(s => s.status === 'active');
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // 'card' shows details. 'question' shows the feedback form on the card.
  const [cardMode, setCardMode] = useState<'card' | 'question'>('card');
  const [questionType, setQuestionType] = useState<'usage' | 'value'>('usage');
  const [questionStep, setQuestionStep] = useState(0);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);

  // Gesture State
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  
  const currentSub = activeSubs[currentIndex];
  const nextSub = activeSubs[currentIndex + 1];
  const nextNextSub = activeSubs[currentIndex + 2];
  const isDone = currentIndex >= activeSubs.length;

  const resetCard = () => {
    setOffset({ x: 0, y: 0 });
    setIsDragging(false);
  };

  const nextCard = () => {
    setCardMode('card'); // Reset mode for next card
    setQuestionStep(0);
    setSelectedReason(null);
    setCurrentIndex(prev => prev + 1);
    resetCard();
  };

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    if (cardMode === 'question') return; // Disable swipe on question mode
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    setStartPos({ x: clientX, y: clientY });
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging || cardMode === 'question') return;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    const deltaX = clientX - startPos.x;
    const deltaY = clientY - startPos.y;
    
    // Adding slight resistance to vertical movement if horizontal is dominant
    const dampenedY = Math.abs(deltaX) > Math.abs(deltaY) ? deltaY * 0.5 : deltaY;
    
    setOffset({ x: deltaX, y: dampenedY });
  };

  const handleTouchEnd = () => {
    if (!isDragging || cardMode === 'question') return;
    setIsDragging(false);
    
    const threshold = 120; // Increased threshold for more deliberate action

    if (offset.x > threshold) {
      handleSwipeComplete('right');
    } else if (offset.x < -threshold) {
      handleSwipeComplete('left');
    } else if (offset.y > threshold) {
      handleSwipeComplete('down');
    } else {
      resetCard();
    }
  };

  const handleSwipeComplete = (dir: 'left' | 'right' | 'down') => {
      if (dir === 'right') {
          // Keep it!
          setOffset({ x: window.innerWidth + 400, y: offset.y });
          setTimeout(() => nextCard(), 300);
      } else if (dir === 'left') {
           // Low usage / Cancel check
           setOffset({ x: 0, y: 0 }); 
           setQuestionType('usage');
           setQuestionStep(0);
           setCardMode('question');
      } else if (dir === 'down') {
           // Value check
           setOffset({ x: 0, y: 0 }); 
           setQuestionType('value');
           setQuestionStep(0);
           setCardMode('question');
      }
  };

  const triggerAction = (action: 'barely' | 'occasional' | 'love') => {
      if (action === 'love') {
          setOffset({ x: 300, y: 0 }); 
          setTimeout(() => {
              setOffset({ x: window.innerWidth + 400, y: 0 });
              setTimeout(nextCard, 300);
          }, 100);
      } else if (action === 'barely') {
          setQuestionType('usage');
          setQuestionStep(0);
          setCardMode('question');
      } else if (action === 'occasional') {
          setQuestionType('value');
          setQuestionStep(0);
          setCardMode('question');
      }
  };

  const handleQuestionSelect = (reason: string) => {
    setSelectedReason(reason);
    setQuestionStep(1); // Move to follow-up step
  };

  const getRotation = () => {
    if (cardMode === 'question') return 0;
    return offset.x / 12; 
  };

  // Emotional Feedback logic for the avatar
  const getAvatarStyle = () => {
    const threshold = 150;
    const progressX = Math.min(1, Math.max(-1, offset.x / threshold));
    const progressY = Math.min(1, Math.max(0, offset.y / threshold));
    
    if (progressX < -0.2) {
      // Swiping Left (Unhappy/Concerned)
      const severity = Math.abs(progressX);
      return {
        filter: `grayscale(${severity * 0.8}) brightness(${1 - severity * 0.2})`,
        transform: `scale(${1 - severity * 0.15}) translateY(${severity * 8}px) rotate(${severity * -10}deg)`,
        opacity: 1
      };
    } else if (progressX > 0.2) {
      // Swiping Right (Happy/Excited)
      const severity = progressX;
      return {
        filter: `brightness(${1 + severity * 0.3})`,
        transform: `scale(${1 + severity * 0.25}) translateY(${severity * -12}px) rotate(${severity * 12}deg)`,
        boxShadow: severity > 0.5 ? `0 0 ${severity * 25}px rgba(34, 197, 94, ${severity * 0.4})` : 'none',
        opacity: 1
      };
    } else if (progressY > 0.3) {
      // Swiping Down (Thinking)
      const severity = progressY;
      return {
        transform: `scale(${1 - severity * 0.05}) translateY(${severity * 4}px) rotate(0deg)`,
        opacity: 1
      };
    }
    
    return { transform: 'scale(1)', opacity: 1 };
  };

  const Graph = ({ color }: { color: string }) => (
    <div className="w-full h-24 relative mt-2">
      <svg className="w-full h-full overflow-visible" viewBox="0 0 100 50" preserveAspectRatio="none">
         <defs>
           <linearGradient id={`grad-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
             <stop offset="0%" stopColor={color} stopOpacity="0.25" />
             <stop offset="100%" stopColor={color} stopOpacity="0" />
           </linearGradient>
         </defs>
         <path 
           d="M0 50 L0 35 C20 42, 40 10, 50 20 C60 30, 80 5, 100 15 V50 Z" 
           fill={`url(#grad-${color})`} 
         />
         <path 
           d="M0 35 C20 42, 40 10, 50 20 C60 30, 80 5, 100 15" 
           fill="none" 
           stroke={color} 
           strokeWidth="2.5" 
           strokeLinecap="round" 
           strokeLinejoin="round"
         />
      </svg>
      <div className="flex justify-between mt-1 text-[10px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-wider px-1">
        <span>Week 1</span>
        <span>Week 4</span>
      </div>
    </div>
  );

  if (isDone) {
      return (
        <div className="bg-background-light dark:bg-background-dark font-display min-h-screen flex flex-col items-center justify-center max-w-md mx-auto text-center px-6 relative overflow-hidden">
            <div className="absolute inset-0 z-0">
               <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-mint-400/10 to-primary/10 opacity-50"></div>
            </div>
            <div className="relative z-10 bg-white dark:bg-[#1a2233] p-8 rounded-3xl shadow-xl border border-white/20">
                <div className="size-20 bg-mint-500 text-white rounded-full flex items-center justify-center mb-6 mx-auto shadow-lg shadow-mint-500/30">
                   <span className="material-symbols-outlined text-5xl">check</span>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">All Caught Up!</h1>
                <p className="text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">You've reviewed all your subscriptions.<br/>See you next month!</p>
                <button 
                  onClick={() => navigate('/hub')}
                  className="w-full h-12 bg-gray-900 dark:bg-white text-white dark:text-black rounded-xl font-bold shadow-lg active:scale-95 transition-transform"
                >
                  Back to Hub
                </button>
            </div>
        </div>
      );
  }

  const isNegative = (currentSub.usageScore || 0) < 50;
  const graphColor = isNegative ? '#ef4444' : '#3b82f6';

  // --- Follow up Logic ---
  const getFollowUps = () => {
    if (questionType === 'usage') {
      switch (selectedReason) {
        case 'Found an alternative': return ["Which one?", "Is it cheaper?", "Ready to switch now?"];
        case 'Too expensive': return ["Target price?", "Downgrade possible?", "Nudge if sale?"];
        case 'Just busy lately': return ["Nudge next week?", "Keep for now?", "Snooze alerts?"];
        case 'Forgot I had it': return ["Cancel immediately", "Remind in 2 days", "Set usage alert"];
        default: return [];
      }
    } else {
      switch (selectedReason) {
        case 'Rarely use it': return ["Wait for content?", "Downgrade plan?", "Pause instead?"];
        case 'Plan is too large': return ["Switch to basic?", "Cost-share info?", "Downgrade now"];
        case 'Value has dropped': return ["Check alternatives?", "Wait for updates", "Flag for review"];
        case 'Thinking of pausing': return ["Pause 1 month", "Pause indefinitely", "Remind to resume"];
        default: return [];
      }
    }
  };

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white h-screen flex flex-col overflow-hidden max-w-md mx-auto relative select-none">
      
      {/* Header */}
      <header className="flex items-center justify-center p-4 pt-6 shrink-0 z-10 relative">
        <h2 className="text-lg font-bold leading-tight tracking-[-0.015em] flex items-center gap-2">
            Check-in
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{currentIndex + 1} / {activeSubs.length}</span>
        </h2>
      </header>

      {/* Main Card Area */}
      <main className="flex-1 flex flex-col items-center justify-center w-full relative perspective-1000 px-4">
        
        {/* Card Stack Effect */}
        {nextNextSub && (
             <div className="absolute w-[80%] aspect-[3/4] bg-white dark:bg-[#1a2233] rounded-[32px] shadow-sm border border-slate-100 dark:border-slate-700 transform scale-[0.85] translate-y-12 -z-20 opacity-40 transition-transform duration-500"></div>
        )}
        {nextSub && (
            <div className="absolute w-[85%] aspect-[3/4] bg-white dark:bg-[#1a2233] rounded-[32px] shadow-md border border-slate-100 dark:border-slate-700 transform scale-[0.92] translate-y-6 -z-10 opacity-70 transition-all duration-500">
                 <div className="w-full h-24 bg-gray-50 dark:bg-white/5 rounded-t-[32px]"></div>
            </div>
        )}

        {/* Current Draggable Card */}
        <div 
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleTouchStart}
          onMouseMove={handleTouchMove}
          onMouseUp={handleTouchEnd}
          onMouseLeave={handleTouchEnd}
          style={{ 
            transform: `translate(${offset.x}px, ${offset.y}px) rotate(${getRotation()}deg)`,
            transition: isDragging ? 'none' : 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            cursor: isDragging ? 'grabbing' : 'grab'
          }}
          className={`w-full max-w-[340px] aspect-[3/4] bg-white dark:bg-[#1a2233] rounded-[32px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.15)] dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col relative border border-slate-100 dark:border-slate-700 z-20 ${cardMode === 'question' ? 'pointer-events-none' : ''}`}
        >
            {cardMode === 'card' ? (
                <>
                    {/* Emotional Avatar Overlay */}
                    <div 
                      className="absolute top-8 left-1/2 -translate-x-1/2 z-40 transition-all duration-300 pointer-events-none"
                      style={getAvatarStyle()}
                    >
                      <div className="size-16 rounded-full bg-white dark:bg-slate-800 border-4 border-white dark:border-slate-700 shadow-xl overflow-hidden p-0.5">
                        <img src={user.avatar} alt="User Mood" className="w-full h-full object-cover rounded-full" />
                      </div>
                    </div>

                    {/* Swipe Stamp Indicators */}
                    <div className="absolute top-12 left-8 z-50 border-4 border-green-500 text-green-500 font-black text-2xl px-4 py-1 rounded-xl -rotate-12 pointer-events-none uppercase tracking-tighter shadow-sm transition-opacity" style={{ opacity: Math.max(0, (offset.x - 50) / 100) }}>
                        Love It
                    </div>
                    <div className="absolute top-12 right-8 z-50 border-4 border-red-500 text-red-500 font-black text-2xl px-4 py-1 rounded-xl rotate-12 pointer-events-none uppercase tracking-tighter shadow-sm transition-opacity" style={{ opacity: Math.max(0, (-offset.x - 50) / 100) }}>
                        Review
                    </div>
                    <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-50 border-4 border-blue-500 text-blue-500 font-black text-2xl px-4 py-1 rounded-xl pointer-events-none uppercase tracking-tighter shadow-sm transition-opacity" style={{ opacity: Math.max(0, (offset.y - 50) / 100) }}>
                        Unsure
                    </div>

                    {/* Swipe Overlay Backgrounds */}
                    <div className="absolute inset-0 z-30 pointer-events-none bg-green-500/5 transition-opacity" style={{ opacity: Math.max(0, offset.x / 150) }}></div>
                    <div className="absolute inset-0 z-30 pointer-events-none bg-red-500/5 transition-opacity" style={{ opacity: Math.max(0, -offset.x / 150) }}></div>
                    <div className="absolute inset-0 z-30 pointer-events-none bg-blue-500/5 transition-opacity" style={{ opacity: Math.max(0, offset.y / 150) }}></div> 
                    
                    {/* Top Section */}
                    <div className="flex flex-col items-center pt-32 px-6 shrink-0 relative z-10 text-center">
                        <div className={`size-16 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4 shadow-sm p-1 ring-1 ring-slate-100 dark:ring-slate-700 ${currentSub.color} bg-opacity-10 text-3xl`}>
                            {currentSub.icon}
                        </div>
                        <h1 className="text-3xl font-black tracking-tight mb-1 text-gray-900 dark:text-white leading-none">{currentSub.name}</h1>
                        <p className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                          ${currentSub.cost}
                          <span className="text-sm font-bold text-slate-400 dark:text-slate-500 ml-1">/mo</span>
                        </p>
                    </div>

                    <div className="flex-1 w-full flex flex-col justify-end pb-8 relative z-10">
                        <div className="px-6 flex justify-between items-end mb-2">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Usage Trend</p>
                                <div className="flex items-center gap-2">
                                    <span className={`text-3xl font-black tracking-tighter ${isNegative ? 'text-red-500' : 'text-blue-500'}`}>
                                        {isNegative ? '-8%' : '+12%'}
                                    </span>
                                    <span className={`${isNegative ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'} text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-widest`}>
                                        {isNegative ? 'Low' : 'High'}
                                    </span>
                                </div>
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Feb 2026</span>
                        </div>

                        <div className="px-2">
                          <Graph color={graphColor} />
                        </div>
                    </div>
                </>
            ) : (
                <div className="w-full h-full flex flex-col p-8 bg-white dark:bg-[#1a2233] relative z-40 pointer-events-auto overflow-hidden">
                     {/* Stepper Header */}
                     <div className="flex items-center justify-between mb-8">
                        <button 
                          onClick={() => {
                            if (questionStep > 0) setQuestionStep(0);
                            else setCardMode('card');
                          }} 
                          className="size-10 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-100 transition-colors"
                        >
                            <span className="material-symbols-outlined text-lg">arrow_back</span>
                        </button>
                        <div className="flex gap-1.5 items-center">
                           <div className={`size-1.5 rounded-full transition-all ${questionStep === 0 ? 'bg-primary w-4' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                           <div className={`size-1.5 rounded-full transition-all ${questionStep === 1 ? 'bg-primary w-4' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                        </div>
                        <div className="size-10"></div>
                     </div>

                     <div className="flex-1 flex flex-col justify-start text-center relative">
                        {/* Step 1: Initial Reason */}
                        <div className={`transition-all duration-300 transform absolute inset-0 ${questionStep === 0 ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'}`}>
                           <div className={`size-16 rounded-2xl ${questionType === 'usage' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'} flex items-center justify-center mb-6 mx-auto shadow-sm`}>
                               <span className="material-symbols-outlined text-3xl">
                                  {questionType === 'usage' ? 'trending_down' : 'question_mark'}
                               </span>
                           </div>
                           <h3 className="text-2xl font-black mb-3 text-gray-900 dark:text-white leading-tight">
                               {questionType === 'usage' ? "Why the low usage?" : "Is it still valuable?"}
                           </h3>
                           <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 leading-relaxed px-4 font-medium">
                               Your input helps us optimize your monthly spend.
                           </p>

                           <div className="w-full space-y-3">
                               {(questionType === 'usage' ? ['Found an alternative', 'Too expensive', 'Just busy lately', 'Forgot I had it'] : ['Rarely use it', 'Plan is too large', 'Value has dropped', 'Thinking of pausing']).map((opt) => (
                                   <button 
                                      key={opt} 
                                      onClick={() => handleQuestionSelect(opt)} 
                                      className="w-full py-4 px-5 rounded-xl border border-slate-100 dark:border-slate-700 font-bold text-sm bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-primary/50 text-left flex justify-between items-center group text-gray-700 dark:text-gray-200 transition-all active:scale-[0.98]"
                                    >
                                       {opt}
                                       <span className="material-symbols-outlined text-primary opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">arrow_forward</span>
                                   </button>
                               ))}
                           </div>
                        </div>

                        {/* Step 2: Follow up */}
                        <div className={`transition-all duration-300 transform absolute inset-0 ${questionStep === 1 ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'}`}>
                           <div className={`size-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-6 mx-auto shadow-sm`}>
                               <span className="material-symbols-outlined text-3xl">psychology</span>
                           </div>
                           <h3 className="text-2xl font-black mb-3 text-gray-900 dark:text-white leading-tight">
                               Quick Follow-up
                           </h3>
                           <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 leading-relaxed px-4 font-medium">
                               Based on "{selectedReason}", what's the next best step for you?
                           </p>

                           <div className="w-full space-y-3">
                               {getFollowUps().map((opt) => (
                                   <button 
                                      key={opt} 
                                      onClick={nextCard} 
                                      className="w-full py-4 px-5 rounded-xl border border-primary/20 font-black text-sm bg-primary/5 dark:bg-primary/10 hover:bg-primary hover:text-white transition-all text-primary dark:text-blue-400 active:scale-[0.98] text-center"
                                    >
                                       {opt}
                                   </button>
                               ))}
                           </div>
                        </div>
                     </div>
                </div>
            )}
        </div>
      </main>

      {/* Footer Controls */}
      <div className="w-full max-w-md mx-auto px-8 pb-32 pt-6 flex items-center justify-between z-30">
          <div className="flex flex-col items-center gap-2 group">
            <button 
                onClick={() => triggerAction('barely')}
                className="size-16 rounded-full bg-white dark:bg-[#2d3748] shadow-[0_8px_25px_-6px_rgba(239,68,68,0.25)] border border-slate-50 dark:border-slate-700 text-red-500 flex items-center justify-center active:scale-90 transition-transform group-hover:bg-red-50 dark:group-hover:bg-red-900/10"
            >
                <span className="material-symbols-outlined text-3xl">close</span>
            </button>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-red-400 transition-colors">Review</span>
          </div>

          <div className="flex flex-col items-center gap-2 -mt-4 group">
            <button 
                onClick={() => triggerAction('occasional')}
                className="size-12 rounded-full bg-white dark:bg-[#2d3748] shadow-sm border border-slate-100 dark:border-slate-700 text-slate-400 hover:text-blue-500 flex items-center justify-center active:scale-90 transition-transform"
            >
                <span className="material-symbols-outlined text-xl">arrow_downward</span>
            </button>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-blue-400 transition-colors">Maybe</span>
          </div>

          <div className="flex flex-col items-center gap-2 group">
            <button 
                onClick={() => triggerAction('love')}
                className="size-16 rounded-full bg-primary text-white shadow-[0_12px_25px_-6px_rgba(37,99,235,0.45)] flex items-center justify-center active:scale-90 transition-transform hover:bg-blue-600 hover:shadow-primary/60"
            >
                <span className="material-symbols-outlined text-3xl">favorite</span>
            </button>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-primary transition-colors">Keep It</span>
          </div>
      </div>

      <style>{`
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
            animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .perspective-1000 {
            perspective: 1000px;
        }
      `}</style>
    </div>
  );
};

export default CheckIn;
