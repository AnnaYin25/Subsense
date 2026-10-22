
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscriptions, calculateNextRenewal } from '../context/SubscriptionContext';
import { GoogleGenAI, Type } from "@google/genai";

interface AppOption {
  id: string;
  name: string;
  icon: string;
  color: string;
  category: string;
}

const APP_OPTIONS: AppOption[] = [
  { id: 'netflix', name: 'Netflix', icon: '🎬', color: 'bg-black text-red-600', category: 'Entertainment' },
  { id: 'spotify', name: 'Spotify', icon: '🎵', color: 'bg-[#1DB954] text-white', category: 'Entertainment' },
  { id: 'youtube', name: 'YouTube', icon: '▶️', color: 'bg-white text-[#FF0000]', category: 'Entertainment' },
  { id: 'prime', name: 'Prime', icon: '📦', color: 'bg-[#00A8E1] text-white', category: 'Utilities' },
  { id: 'disney', name: 'Disney+', icon: '🏰', color: 'bg-[#113CCF] text-white', category: 'Entertainment' },
  { id: 'chatgpt', name: 'ChatGPT', icon: '🤖', color: 'bg-[#74AA9C] text-white', category: 'Productivity' },
  { id: 'figma', name: 'Figma', icon: '🎨', color: 'bg-[#1e1e1e] text-white', category: 'Productivity' },
  { id: 'calm', name: 'Calm', icon: '🧘', color: 'bg-blue-400 text-white', category: 'Health' },
];

const AVATAR_SEEDS = ['Alex', 'Jordan', 'Casey', 'Riley', 'Skyler', 'Taylor', 'Morgan', 'Charlie', 'Sasha', 'Jamie'];

const Setup: React.FC = () => {
  const navigate = useNavigate();
  const { addSubscription, updateUser, user } = useSubscriptions();

  // Helper for local date string to avoid timezone issues
  const getTodayString = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
  };

  const [currentStep, setCurrentStep] = useState(1);
  const [name, setName] = useState(user.name || '');
  const [age, setAge] = useState(user.age || '');
  const [avatarSeed, setAvatarSeed] = useState('Alex');

  const [interviewTurn, setInterviewTurn] = useState(0);
  const [interviewHistory, setInterviewHistory] = useState<{q: string, a: string}[]>([]);
  const [currentAIQuestion, setCurrentAIQuestion] = useState({
    question: "How would you describe your current subscription management style?",
    options: ["I'm a pro, I track everything", "I often forget what I pay for", "I only have a few essentials", "I'm always trying new trials"]
  });
  const [isAiLoading, setIsAiLoading] = useState(false);

  const [selectedAppIds, setSelectedAppIds] = useState<Set<string>>(new Set());
  const [configIndex, setConfigIndex] = useState(0);
  
  const [editApp, setEditApp] = useState({
    cost: '14.99',
    cycle: '/mo',
    startDate: getTodayString(),
    category: 'Entertainment',
    plan: 'Standard',
    note: ''
  });

  const [persona, setPersona] = useState<any>(null);

  const selectedList = APP_OPTIONS.filter(app => selectedAppIds.has(app.id));
  const currentApp = selectedList[configIndex];

  useEffect(() => {
    if (currentApp) {
      setEditApp(prev => ({ ...prev, category: currentApp.category, plan: 'Standard' }));
    }
  }, [configIndex, currentApp]);

  const toggleApp = (id: string) => {
    const newSet = new Set(selectedAppIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedAppIds(newSet);
  };

  const safeJsonParse = (text: string) => {
    try {
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (e) {
      return null;
    }
  };

  const fetchNextAIQuestion = async (userAnswer: string) => {
    setIsAiLoading(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const context = interviewHistory.map(h => `Q: ${h.q}\nA: ${h.a}`).join('\n');
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Q History:\n${context}\nAnswer: ${userAnswer}\nAsk a follow-up and provide 4 options as JSON.`,
        config: { 
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["question", "options"]
          }
        }
      });
      const data = safeJsonParse(response.text || '{}');
      if (data && data.options) setCurrentAIQuestion(data);
    } catch (e) {
      setCurrentAIQuestion({
        question: "How much of your monthly income goes toward subscriptions?",
        options: ["Less than 5%", "Around 10%", "More than 20%", "I'm too scared to look"]
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  const generatePersona = async () => {
    setIsAiLoading(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const context = interviewHistory.map(h => `Q: ${h.q}\nA: ${h.a}`).join('\n');
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `History:\n${context}\nGenerate Persona JSON.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              tip: { type: Type.STRING },
              emoji: { type: Type.STRING }
            },
            required: ["title", "description", "tip", "emoji"]
          }
        }
      });
      const data = safeJsonParse(response.text || '{}');
      if (data) {
        setPersona(data);
        updateUser({ persona: data });
      }
    } catch (e) {
      const fallback = { title: "The Balanced User", description: "You have a mix of essential and fun apps.", tip: "Audit your list every 3 months!", emoji: "⚖️" };
      setPersona(fallback);
      updateUser({ persona: fallback });
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAIAnswer = async (option: string) => {
    const turn = { q: currentAIQuestion.question, a: option };
    const updatedHistory = [...interviewHistory, turn];
    setInterviewHistory(updatedHistory);
    
    if (interviewTurn < 2) {
      setInterviewTurn(prev => prev + 1);
      await fetchNextAIQuestion(option);
    } else {
      setCurrentStep(3);
    }
  };

  const handleNext = async () => {
    if (currentStep === 1) {
      if (!name.trim()) return;
      updateUser({ name, age, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}` });
      setCurrentStep(2);
    } else if (currentStep === 3) {
      if (selectedAppIds.size > 0) setCurrentStep(4);
      else navigate('/hub');
    } else if (currentStep === 4) {
      const nextRenewal = calculateNextRenewal(editApp.startDate, editApp.cycle);
      addSubscription({
        id: `setup-${currentApp.id}-${Date.now()}`,
        name: currentApp.name,
        plan: editApp.plan,
        cost: parseFloat(editApp.cost) || 0,
        icon: currentApp.icon,
        color: currentApp.color,
        status: 'active',
        renewalDate: nextRenewal,
        startDate: editApp.startDate,
        category: editApp.category as any,
        usageHistory: [50, 50, 50, 50, 50, 50, 50],
        usageScore: 50,
        customFields: editApp.note ? [{ label: 'Note', value: editApp.note }] : []
      });

      if (configIndex < selectedList.length - 1) {
        setConfigIndex(prev => prev + 1);
        setEditApp({ cost: '14.99', cycle: '/mo', startDate: getTodayString(), category: 'Entertainment', plan: 'Standard', note: '' });
      } else {
        setCurrentStep(5);
        await generatePersona();
      }
    } else if (currentStep === 5) {
      navigate('/hub');
    }
  };

  const CUTE_BOT_AVATAR = "https://api.dicebear.com/7.x/bottts-neutral/svg?seed=SubSense&backgroundColor=b6e3f4";

  return (
    <div className="bg-background-light dark:bg-background-dark font-display antialiased text-[#0e121b] dark:text-[#f8f9fc] overflow-hidden h-screen flex flex-col max-w-md mx-auto shadow-2xl relative">
      <header className="flex items-center justify-between px-4 py-3 shrink-0">
        <button onClick={() => currentStep > 1 ? setCurrentStep(currentStep - 1) : navigate(-1)} className="flex size-10 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h2 className="text-lg font-bold">
            {currentStep === 1 && "Profile"}
            {currentStep === 2 && "Insights"}
            {currentStep === 3 && "Services"}
            {currentStep === 4 && "Configure"}
            {currentStep === 5 && "Your Persona"}
        </h2>
        <div className="size-10"></div>
      </header>

      <div className="flex flex-col items-center gap-2 py-4 shrink-0">
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(s => (
            <div key={s} className={`h-1.5 rounded-full transition-all duration-300 ${currentStep === s ? 'w-8 bg-primary' : (s < currentStep ? 'w-2 bg-primary/40' : 'w-2 bg-slate-300 dark:bg-slate-700')}`}></div>
          ))}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto no-scrollbar px-6 pb-24">
        <div className="flex flex-col gap-6 max-w-sm mx-auto">
          {currentStep < 5 && (
            <div className="flex items-end gap-3 animate-fade-in-up">
              <div className="size-12 rounded-full border border-slate-200 dark:border-slate-700 bg-white shadow-sm shrink-0 overflow-hidden">
                <img src={CUTE_BOT_AVATAR} alt="SubSense AI" />
              </div>
              <div className="bg-white dark:bg-[#2d3748] p-4 rounded-2xl rounded-tl-none shadow-sm border border-slate-100 dark:border-slate-700 max-w-[85%]">
                <p className="text-sm font-medium leading-relaxed">
                  {currentStep === 1 && "Hey! Let's start by personalizing your manager profile."}
                  {currentStep === 2 && (isAiLoading ? "Thinking..." : currentAIQuestion.question)}
                  {currentStep === 3 && "Got it! Which services are you currently using? You can add more later too."}
                  {currentStep === 4 && `Let's get the details right for ${currentApp?.name}.`}
                </p>
              </div>
            </div>
          )}

          {currentStep === 1 && (
            <div className="flex flex-col gap-6 animate-fade-in-up">
              <div className="flex flex-col items-center gap-4">
                <div className="size-28 rounded-full bg-slate-100 dark:bg-slate-800 border-4 border-white dark:border-slate-700 shadow-xl overflow-hidden group relative">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`} alt="User Avatar" />
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {AVATAR_SEEDS.map(seed => (
                    <button key={seed} onClick={() => setAvatarSeed(seed)} className={`size-10 rounded-full border-2 transition-all ${avatarSeed === seed ? 'border-primary ring-2 ring-primary/20 scale-110' : 'border-transparent opacity-60'}`}>
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`} alt={seed} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Display Name</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full h-14 bg-white dark:bg-slate-800 rounded-2xl border-none ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-primary px-5 font-bold text-lg" placeholder="Alex" />
                </div>
                <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Age (Optional)</label>
                    <input type="number" value={age} onChange={(e) => setAge(e.target.value)} className="w-full h-14 bg-white dark:bg-slate-800 rounded-2xl border-none ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-primary px-5 font-bold text-lg" placeholder="25" />
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="flex flex-col gap-4 animate-fade-in-up">
              {isAiLoading ? (
                <div className="flex justify-center py-10">
                  <div className="size-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {(currentAIQuestion.options || []).map((opt, i) => (
                    <button 
                      key={i} 
                      onClick={() => handleAIAnswer(opt)}
                      className="w-full p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 text-left font-bold text-sm hover:border-primary hover:bg-primary/5 transition-all active:scale-[0.98] shadow-sm"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {currentStep === 3 && (
            <div className="grid grid-cols-2 gap-3 animate-fade-in-up">
              {APP_OPTIONS.map(app => (
                <button key={app.id} onClick={() => toggleApp(app.id)} className={`flex flex-col items-center justify-center gap-3 p-5 rounded-3xl border transition-all active:scale-95 ${selectedAppIds.has(app.id) ? 'bg-primary/5 border-primary ring-1 ring-primary' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                  <span className={`text-4xl ${selectedAppIds.has(app.id) ? 'scale-110' : ''} transition-transform`}>{app.icon}</span>
                  <span className={`text-sm font-bold ${selectedAppIds.has(app.id) ? 'text-primary' : 'text-slate-500'}`}>{app.name}</span>
                </button>
              ))}
            </div>
          )}

          {currentStep === 4 && (
            <div className="flex flex-col gap-6 animate-fade-in-up">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
                <div className={`size-16 rounded-2xl flex items-center justify-center text-3xl ${currentApp?.color}`}>
                  {currentApp?.icon}
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-none">{currentApp?.name}</h3>
                  <p className="text-xs text-slate-400 mt-1 uppercase font-black tracking-widest">Configuring {configIndex + 1} of {selectedList.length}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Cost</label>
                      <div className="relative">
                        <span className="absolute left-4 top-4 text-slate-400 font-bold">$</span>
                        <input type="number" value={editApp.cost} onChange={(e) => setEditApp({...editApp, cost: e.target.value})} className="w-full h-14 bg-white dark:bg-slate-800 rounded-2xl border-none ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-primary pl-8 pr-4 font-bold" />
                      </div>
                  </div>
                  <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Cycle</label>
                      <select value={editApp.cycle} onChange={(e) => setEditApp({...editApp, cycle: e.target.value})} className="w-full h-14 bg-white dark:bg-slate-800 rounded-2xl border-none ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-primary px-4 font-bold text-sm">
                        <option value="/mo">Monthly</option>
                        <option value="/yr">Yearly</option>
                      </select>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Renewal Date</label>
                    <input type="date" value={editApp.startDate} onChange={(e) => setEditApp({...editApp, startDate: e.target.value})} className="w-full h-14 bg-white dark:bg-slate-800 rounded-2xl border-none ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-primary px-5 font-bold" />
                </div>
                <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Plan / Tier</label>
                    <input type="text" value={editApp.plan} onChange={(e) => setEditApp({...editApp, plan: e.target.value})} className="w-full h-14 bg-white dark:bg-slate-800 rounded-2xl border-none ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-primary px-5 font-bold" placeholder="e.g. Premium" />
                </div>
                <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Note (Optional)</label>
                    <textarea value={editApp.note} onChange={(e) => setEditApp({...editApp, note: e.target.value})} className="w-full h-24 bg-white dark:bg-slate-800 rounded-2xl border-none ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-primary px-5 py-4 font-medium text-sm resize-none" placeholder="Billing email, shared with..." />
                </div>
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div className="flex flex-col items-center text-center gap-6 animate-fade-in-up py-8">
              {isAiLoading ? (
                <div className="flex flex-col items-center gap-4 py-20">
                  <div className="size-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Generating Persona...</p>
                </div>
              ) : persona && (
                <>
                  <div className="size-32 bg-primary/10 rounded-[40px] flex items-center justify-center text-7xl shadow-xl shadow-primary/10">
                    {persona.emoji}
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-3xl font-black text-primary tracking-tight">{persona.title}</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed px-4">{persona.description}</p>
                  </div>
                  <div className="w-full bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm mt-4 text-left">
                    <div className="flex items-center gap-2 mb-2 text-primary">
                      <span className="material-symbols-outlined text-[20px]">lightbulb</span>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em]">Top Savings Tip</span>
                    </div>
                    <p className="text-sm font-bold text-gray-800 dark:text-slate-200">{persona.tip}</p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="p-6 bg-background-light dark:bg-background-dark border-t border-slate-100 dark:border-slate-800 flex flex-col gap-3 shrink-0">
        {(currentStep === 1 || currentStep === 3 || currentStep === 4 || currentStep === 5) && (
          <button 
            onClick={handleNext} 
            disabled={isAiLoading || (currentStep === 1 && !name.trim())} 
            className="w-full h-14 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-primary/20 flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {currentStep === 5 ? "Go to Manager" : (currentStep === 4 && configIndex === selectedList.length - 1 ? "Finish Configuration" : "Continue")}
            <span className="material-symbols-outlined">arrow_forward</span>
          </button>
        )}
        {(currentStep < 3) && (
            <button onClick={() => navigate('/hub')} className="w-full h-10 text-slate-400 text-xs font-black uppercase tracking-widest transition-colors hover:text-slate-600">Skip Setup</button>
        )}
      </footer>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in-up { animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </div>
  );
};

export default Setup;
