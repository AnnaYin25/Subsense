
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscriptions } from '../context/SubscriptionContext';
import { AssessmentReport, Factor } from '../types';
import { GoogleGenAI, Type } from "@google/genai";

// --- Styled Chat Components ---

const TypingIndicator = () => (
  <div className="flex w-full justify-start mb-6 animate-pulse gap-3 px-4">
    <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
      <span className="material-symbols-outlined text-primary text-[18px]">psychology</span>
    </div>
    <div className="bg-white dark:bg-[#2d3748] px-4 py-3 rounded-2xl rounded-tl-none border border-slate-100 dark:border-slate-800 flex gap-1 items-center shadow-sm">
      <div className="size-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
      <div className="size-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
      <div className="size-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
    </div>
  </div>
);

const ChatBubble: React.FC<{ role: 'user' | 'bot'; text: string; isNew?: boolean }> = ({ role, text, isNew }) => (
  <div className={`flex w-full ${role === 'user' ? 'justify-end' : 'justify-start'} mb-4 ${isNew ? 'animate-fade-in-up' : ''} gap-3 px-4`}>
    {role === 'bot' && (
      <div className="size-8 rounded-full bg-gradient-to-tr from-primary to-blue-400 flex items-center justify-center shrink-0 shadow-sm mt-auto mb-1">
        <span className="material-symbols-outlined text-white text-[16px]">smart_toy</span>
      </div>
    )}
    <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm font-medium ${
      role === 'user' 
        ? 'bg-primary text-white rounded-tr-none ml-auto' 
        : 'bg-white dark:bg-[#2d3748] text-gray-800 dark:text-gray-200 rounded-tl-none border border-slate-100 dark:border-slate-800'
    }`}>
      {text}
    </div>
  </div>
);

const Assessment: React.FC = () => {
  const navigate = useNavigate();
  const { auditReports = [], addAuditReport, subscriptions = [], user, addSubscription } = useSubscriptions();
  
  // App View States
  const [view, setView] = useState<'home' | 'chat' | 'report'>('home');
  const [selectedReport, setSelectedReport] = useState<AssessmentReport | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  
  // Chat States
  const [messages, setMessages] = useState<{role: 'bot'|'user', text: string}[]>([]);
  const [options, setOptions] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logic
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, options]);

  const safeJsonParse = (text: string) => {
    try {
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (e) {
      console.error("AI Response Parsing Error:", e);
      return null;
    }
  };

  // Start the context-aware exploration
  const startAudit = async () => {
    setView('chat');
    setIsTyping(true);
    setMessages([]);
    setOptions([]);

    // Initialize Gemini Client right before making the call
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
      const subsSummary = (subscriptions || []).map(s => `${s.name} ($${s.cost}/mo)`).join(', ');
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Initialize a deep, fun, multi-turn subscription audit for "${user.name}". 
        
        USER CONTEXT:
        - Persona: ${user.persona?.title} (${user.persona?.description})
        - Budget: $${user.monthlyBudget}
        - Existing Subs: ${subsSummary || 'No subs yet.'}
        
        YOUR PERSONALITY:
        You are SubSense AI. You're part financial expert, part lifestyle coach. You're witty, slightly cheeky, but very helpful.
        
        FIRST TURN:
        Greet them warmly, reference their "${user.persona?.title}" persona, and ask what service is on their mind.
        Provide 4 varied options as chips.
        
        SCHEMA:
        {
          "bot_replies": ["string"],
          "options": ["string"]
        }`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              bot_replies: { type: Type.ARRAY, items: { type: Type.STRING } },
              options: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["bot_replies", "options"]
          }
        }
      });

      const data = safeJsonParse(response.text || '{}');
      if (data) {
        for (const reply of (data.bot_replies || [])) {
          await new Promise(r => setTimeout(r, 800));
          setMessages(prev => [...prev, { role: 'bot', text: reply }]);
        }
        setOptions(data.options || []);
      }
    } catch (e) {
      setMessages([{ role: 'bot', text: `Hey ${user.name.split(' ')[0]}! Let's see if this new bill is a 'yes' or a 'yikes'. What service are we looking at?` }]);
      setOptions(["Netflix", "ChatGPT Plus", "Midjourney", "Other..."]);
    } finally {
      setIsTyping(false);
    }
  };

  const processResponse = async (userText: string) => {
    if (!userText.trim()) return;
    
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setOptions([]);
    setInputValue("");
    setIsTyping(true);

    // Initialize Gemini Client right before making the call
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
      const historyStr = messages.slice(-12).map(m => `${m.role}: ${m.text}`).join('\n');
      const subsSummary = (subscriptions || []).map(s => `${s.name} ($${s.cost}/mo)`).join(', ');

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview', // Upgrading to Pro for deeper analysis
        contents: `Continue the deep audit. 
        
        MISSION:
        - Investigate: Name, Cost, Intent (Why do they want it?), Lifestyle alignment, and potential FOMO.
        - Analyze versus existing subs: ${subsSummary}
        - Don't settle for "budget fit". Ask about "mental fit".
        
        TURN RULES:
        - One focused question at a time.
        - Be fun and conversational. 
        - Use "bot_replies" for multi-bubble dialogue (max 2 bubbles).
        - If you have: Name, Cost, and high confidence in their intent/lifestyle fit, set "is_finished" to true.
        - At least 3 questions must be asked before finishing.
        
        USER:
        - Persona: ${user.persona?.title}
        - Budget: $${user.monthlyBudget}
        
        HISTORY:
        ${historyStr}
        Latest Input: "${userText}"

        JSON SCHEMA:
        {
          "is_finished": boolean,
          "bot_replies": ["string"],
          "options": ["string"],
          "report": { 
             "name": "string",
             "score": number, 
             "status": "Good"|"Fair"|"Poor",
             "cost": "string",
             "category": "Entertainment"|"Productivity"|"Utilities"|"Health",
             "recommendation": "string",
             "factors": [{"title": "string", "desc": "string", "type": "risk"|"pass"}]
          }
        }`,
        config: { 
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              is_finished: { type: Type.BOOLEAN },
              bot_replies: { type: Type.ARRAY, items: { type: Type.STRING } },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              report: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  score: { type: Type.NUMBER },
                  status: { type: Type.STRING },
                  cost: { type: Type.STRING },
                  category: { type: Type.STRING },
                  recommendation: { type: Type.STRING },
                  factors: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING },
                        desc: { type: Type.STRING },
                        type: { type: Type.STRING }
                      }
                    }
                  }
                }
              }
            },
            required: ["is_finished", "bot_replies", "options"]
          }
        }
      });

      const data = safeJsonParse(response.text || '{}');
      if (!data) throw new Error("Processing error");

      for (const reply of (data.bot_replies || [])) {
        await new Promise(r => setTimeout(r, 800));
        setMessages(prev => [...prev, { role: 'bot', text: reply }]);
      }

      if (data.is_finished && data.report) {
        setIsTyping(false);
        await new Promise(r => setTimeout(r, 1200));
        setIsFinalizing(true);
        await new Promise(r => setTimeout(r, 3500)); // Simulating AI calculation
        
        const rData = data.report;
        const statusColors: any = { 
          'Good': 'text-mint-600 bg-mint-50 dark:bg-mint-900/20', 
          'Fair': 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20', 
          'Poor': 'text-red-600 bg-red-50 dark:bg-red-900/20' 
        };
        
        const newReport: AssessmentReport = {
          id: `audit-${Date.now()}`,
          name: rData.name || "Unknown Service",
          score: rData.score || 0,
          status: rData.status || "Fair",
          color: statusColors[rData.status] || statusColors['Fair'],
          date: new Date().toISOString(),
          cost: rData.cost || "Varies",
          category: rData.category || "Utilities",
          recommendation: rData.recommendation || "Take your time deciding.",
          factors: (rData.factors || []).map((f: any) => ({
            ...f,
            type: f.type === 'risk' ? 'risk' : 'pass'
          }))
        };

        addAuditReport(newReport);
        setSelectedReport(newReport);
        setIsFinalizing(false);
        setView('report');
      } else {
        setOptions(data.options || []);
      }
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { role: 'bot', text: "Ouch, my brain lagged for a second. What was that price again?" }]);
      setOptions(["$9.99", "$14.99", "$19.99", "Not sure"]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleManualSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isTyping) {
      processResponse(inputValue);
    }
  };

  // --- UI Renders ---

  if (isFinalizing) {
    return (
      <div className="fixed inset-0 z-[100] bg-background-light dark:bg-background-dark flex flex-col items-center justify-center p-10 text-center max-w-md mx-auto shadow-2xl animate-fade-in">
        <div className="relative size-32 mb-12">
           <div className="absolute inset-0 border-4 border-primary/10 rounded-full"></div>
           <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
           <div className="absolute inset-0 flex items-center justify-center">
              <span className="material-symbols-outlined text-5xl text-primary animate-pulse">insights</span>
           </div>
        </div>
        <h2 className="text-3xl font-black mb-4 tracking-tight text-gray-900 dark:text-white leading-none">Crunching the Data...</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium px-4 leading-relaxed">
          Comparing lifestyle goals with <span className="text-primary font-bold">{(subscriptions || []).length} current services</span> and testing against your <span className="text-primary font-bold">${user.monthlyBudget}</span> budget ceiling...
        </p>
      </div>
    );
  }

  if (view === 'home') {
    return (
      <div className="bg-background-light dark:bg-background-dark min-h-screen flex flex-col pb-24 max-w-md mx-auto shadow-2xl animate-fade-in overflow-hidden">
        <header className="px-6 pt-12 pb-6">
          <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1">Financial Intelligence</p>
          <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight leading-none">Subscription Audit</h2>
        </header>

        <main className="flex-1 px-4 overflow-y-auto no-scrollbar space-y-6">
          <div onClick={startAudit} className="relative overflow-hidden rounded-[40px] bg-white dark:bg-[#1a2233] p-10 text-gray-900 dark:text-white shadow-xl border border-slate-100 dark:border-slate-800 cursor-pointer group transition-all hover:scale-[1.01] active:scale-[0.98]">
            <div className="absolute -right-8 -top-8 opacity-5 group-hover:opacity-10 transition-opacity">
               <span className="material-symbols-outlined text-[180px]">psychology_alt</span>
            </div>
            <div className="relative z-10">
              <div className="size-16 rounded-3xl bg-primary text-white flex items-center justify-center mb-8 shadow-lg shadow-primary/20 group-hover:rotate-12 transition-transform">
                <span className="material-symbols-outlined text-4xl">chat_bubble</span>
              </div>
              <h2 className="text-2xl font-black mb-1 tracking-tight">New Insight Chat</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm max-w-[85%] leading-relaxed font-medium">Deep-dive into your spending psychology and lifestyle fit.</p>
            </div>
          </div>

          <div>
            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-4 px-2 flex justify-between items-center">
              <span>Past Insight Reports</span>
              <span className="material-symbols-outlined text-sm">history_edu</span>
            </h3>
            <div className="flex flex-col gap-3">
              {(auditReports || []).length > 0 ? (auditReports || []).map((report) => (
                  <div key={report.id} onClick={() => { setSelectedReport(report); setView('report'); }} className="flex items-center p-5 bg-white dark:bg-[#1e2330] rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm active:scale-[0.98] transition-all cursor-pointer group hover:border-primary/30">
                    <div className={`size-12 rounded-2xl flex items-center justify-center font-black text-lg shrink-0 ${report.score >= 70 ? 'bg-mint-50 text-mint-600' : report.score >= 50 ? 'bg-yellow-50 text-yellow-600' : 'bg-red-50 text-red-600'}`}>
                      {report.score}
                    </div>
                    <div className="ml-4 flex-1 truncate">
                      <h4 className="font-bold text-gray-900 dark:text-white tracking-tight truncate">{report.name}</h4>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{report.category} • {report.cost}</p>
                    </div>
                    <span className="material-symbols-outlined text-slate-300 group-hover:translate-x-1 transition-transform">arrow_forward</span>
                  </div>
                )) : (
                  <div className="text-center py-24 opacity-20">
                    <span className="material-symbols-outlined text-5xl mb-2">find_in_page</span>
                    <p className="text-[10px] font-black uppercase tracking-widest">No insights generated yet</p>
                  </div>
                )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (view === 'chat') {
    return (
      <div className="fixed inset-0 z-50 bg-background-light dark:bg-background-dark flex flex-col max-w-md mx-auto overflow-hidden animate-slide-up">
        <header className="flex items-center p-5 bg-white/80 dark:bg-[#1a2233]/80 backdrop-blur-xl sticky top-0 z-10 border-b border-slate-100 dark:border-slate-800">
           <button onClick={() => setView('home')} className="size-10 flex items-center justify-center rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
             <span className="material-symbols-outlined">close</span>
           </button>
           <div className="flex-1 text-center">
              <h2 className="font-black text-xs uppercase tracking-[0.2em] text-gray-900 dark:text-white">SubSense Audit</h2>
              <p className="text-[8px] font-bold text-mint-500 uppercase tracking-widest animate-pulse">Deep Connection</p>
           </div>
           <div className="size-10"></div>
        </header>

        <main className="flex-1 py-8 overflow-y-auto no-scrollbar bg-slate-50/20 dark:bg-[#111621]">
          <div className="flex flex-col pb-8">
            {(messages || []).map((msg, idx) => (
              <ChatBubble key={idx} role={msg.role} text={msg.text} isNew={idx === messages.length - 1} />
            ))}
            {isTyping && <TypingIndicator />}
            
            {!isTyping && (options || []).length > 0 && (
              <div className="flex flex-wrap gap-2 px-6 py-4 mt-2 animate-fade-in-up">
                {(options || []).map((opt, i) => (
                  <button 
                    key={i} 
                    onClick={() => processResponse(opt)}
                    className="px-6 py-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 font-black text-[11px] uppercase tracking-widest text-primary shadow-sm active:scale-95 transition-all hover:bg-primary hover:text-white hover:border-primary"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </main>

        <footer className="p-6 bg-white dark:bg-[#1a2233] border-t border-slate-100 dark:border-slate-800 pb-safe shadow-2xl">
             <form onSubmit={handleManualSend} className="flex gap-3">
                <input 
                   autoFocus
                   type="text" 
                   value={inputValue}
                   onChange={(e) => setInputValue(e.target.value)}
                   placeholder="Type an honest answer..."
                   disabled={isTyping}
                   className="flex-1 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 text-sm font-medium focus:ring-2 focus:ring-primary shadow-inner"
                 />
                 <button type="submit" disabled={!inputValue.trim() || isTyping} className="size-14 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20 active:scale-95 disabled:opacity-30 transition-all">
                   <span className="material-symbols-outlined">send</span>
                 </button>
             </form>
        </footer>
      </div>
    );
  }

  if (view === 'report' && selectedReport) {
    // Dynamic logic for the primary action button based on the audit verdict
    const getVerdictAction = (report: AssessmentReport) => {
      if (report.status === 'Good') {
        return {
          label: 'Subscribe? Track it!',
          icon: 'add_task',
          color: 'bg-primary shadow-primary/25',
          onClick: () => navigate('/add', { state: { name: report.name, cost: report.cost } })
        };
      } else if (report.status === 'Fair') {
        return {
          label: 'Review in Manager',
          icon: 'list_alt',
          color: 'bg-slate-700 shadow-slate-700/25',
          onClick: () => navigate('/hub')
        };
      } else if (report.status === 'Poor') {
        return {
          label: 'Set 30 days reminder.',
          icon: 'notification_add',
          color: 'bg-red-500 shadow-red-500/25',
          onClick: () => {
            const trialEndDate = new Date();
            trialEndDate.setDate(trialEndDate.getDate() + 30);
            
            // Adjust for local date string to avoid timezone shifts
            const offset = trialEndDate.getTimezoneOffset() * 60000;
            const localISODate = new Date(trialEndDate.getTime() - offset).toISOString().split('T')[0];
            
            addSubscription({
              id: `reminder-${Date.now()}`,
              name: `${report.name} Trial End`,
              plan: 'Reminder',
              cost: 0,
              icon: '⏰',
              color: 'bg-red-500 text-white', 
              status: 'active',
              renewalDate: localISODate,
              category: report.category,
              usageHistory: [],
              usageScore: 0,
              isReminder: true // Specifically flag this as a reminder for the calendar UI
            });
            navigate('/hub');
          }
        };
      } else {
        return {
          label: 'Back to Manager',
          icon: 'arrow_forward',
          color: 'bg-slate-500 shadow-slate-500/25',
          onClick: () => navigate('/hub')
        };
      }
    };

    const action = getVerdictAction(selectedReport);

    return (
      <div className="fixed inset-0 z-50 bg-background-light dark:bg-background-dark flex flex-col max-w-md mx-auto animate-fade-in overflow-hidden">
        <header className="flex items-center justify-between p-6 bg-white/50 dark:bg-transparent backdrop-blur-sm">
          <button onClick={() => setView('home')} className="size-12 rounded-full bg-white dark:bg-[#1a2233] shadow-md flex items-center justify-center hover:bg-slate-50 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Verdict Ready</span>
            <span className="text-xs font-bold text-primary">{selectedReport.name}</span>
          </div>
          <button className="size-12 rounded-full bg-white dark:bg-[#1a2233] shadow-md flex items-center justify-center">
             <span className="material-symbols-outlined">share</span>
          </button>
        </header>

        <main className="flex-1 overflow-y-auto no-scrollbar px-6 pb-24 pt-4">
           <div className="text-center mb-10">
              <div className="size-24 rounded-3xl bg-white dark:bg-[#1a2233] shadow-xl border border-slate-100 dark:border-slate-800 flex items-center justify-center mx-auto mb-6">
                 <span className="text-4xl font-black text-primary">{selectedReport.name[0]}</span>
              </div>
              <h1 className="text-4xl font-black mb-1 tracking-tight text-gray-900 dark:text-white leading-none">{selectedReport.name}</h1>
              <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mt-2">{selectedReport.category} • {selectedReport.cost}</p>
           </div>

           <div className="bg-white dark:bg-[#1a2233] rounded-[48px] p-10 shadow-2xl border border-slate-50 dark:border-slate-800 flex flex-col items-center mb-10">
              <div className="size-48 relative mb-10">
                 <svg className="size-full -rotate-90" viewBox="0 0 100 100">
                    <circle className="text-slate-50 dark:text-slate-800 stroke-current" cx="50" cy="50" fill="transparent" r="44" strokeWidth="8"></circle>
                    <circle className={`${selectedReport.score >= 70 ? 'text-mint-500' : selectedReport.score >= 50 ? 'text-yellow-500' : 'text-red-500'} stroke-current transition-all duration-1000 ease-out`} cx="50" cy="50" fill="transparent" r="44" strokeDasharray="276" strokeDashoffset={276 - (276 * selectedReport.score / 100)} strokeLinecap="round" strokeWidth="8"></circle>
                 </svg>
                 <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-5xl font-black tracking-tighter text-gray-900 dark:text-white">{selectedReport.score}</span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Efficiency</span>
                 </div>
              </div>
              <div className={`px-5 py-2 rounded-full text-[11px] font-black uppercase tracking-widest mb-6 ${selectedReport.color}`}>
                 Fit: {selectedReport.status}
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl w-full border border-slate-100 dark:border-slate-700">
                  <p className="text-xs font-bold leading-relaxed text-slate-600 dark:text-slate-300 italic text-center">"{selectedReport.recommendation}"</p>
              </div>
           </div>

           <div className="space-y-4 mb-10">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-4">Evidence & Logic</h3>
              {(selectedReport.factors || []).map((f, i) => (
                 <div key={i} className={`p-6 rounded-[32px] border transition-all ${f.type === 'risk' ? 'bg-orange-50/40 border-orange-100 dark:bg-orange-900/10 dark:border-orange-900/20 shadow-sm' : 'bg-mint-50/40 border-mint-100 dark:bg-mint-900/10 dark:border-mint-900/20 shadow-sm'}`}>
                    <div className="flex items-center gap-3 mb-2">
                       <span className={`material-symbols-outlined text-[20px] ${f.type === 'risk' ? 'text-orange-500' : 'text-mint-500'}`}>{f.type === 'risk' ? 'warning' : 'verified_user'}</span>
                       <h4 className="font-black text-sm tracking-tight text-gray-900 dark:text-white uppercase">{f.title}</h4>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium pl-8">{f.desc}</p>
                 </div>
              ))}
           </div>
        </main>

        <div className="p-6 bg-white dark:bg-[#1a2233] border-t border-slate-100 dark:border-slate-800 pb-safe">
           <button 
              onClick={action.onClick} 
              className={`w-full h-16 ${action.color} text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2`}
            >
              {action.label}
              <span className="material-symbols-outlined">{action.icon}</span>
           </button>
        </div>
      </div>
    );
  }

  return null;
};

export default Assessment;
