
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSubscriptions, calculateNextRenewal } from '../context/SubscriptionContext';

const AddSubscription: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { addSubscription } = useSubscriptions();

  // Helper for local date string
  const getTodayString = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
  };

  // Form State
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('✨');
  const [cost, setCost] = useState('');
  const [cycle, setCycle] = useState('/mo');
  const [firstPayment, setFirstPayment] = useState(getTodayString());
  const [category, setCategory] = useState<any>('Utilities');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategory, setCustomCategory] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (location.state) {
        const state: any = location.state;
        if (state.name) setName(state.name);
        if (state.cost) {
            const costStr = state.cost.replace(/[^0-9.]/g, '');
            setCost(costStr);
        }
    }
  }, [location.state]);

  const popularServices = [
      { name: 'Netflix', color: 'bg-black text-red-600', cat: 'Entertainment', defaultIcon: '🎬' },
      { name: 'Spotify', color: 'bg-[#1DB954] text-white', cat: 'Entertainment', defaultIcon: '🎵' },
      { name: 'Adobe', color: 'bg-[#FF0000] text-white', cat: 'Productivity', defaultIcon: '🎨' },
      { name: 'Apple One', color: 'bg-gray-900 text-white', cat: 'Utilities', defaultIcon: '🍎' },
  ];

  const handleServiceClick = (service: any) => {
      setName(service.name);
      setCategory(service.cat);
      setIsCustomCategory(false);
      setIcon(service.defaultIcon);
  };

  const handleSave = () => {
      const nextRenewal = calculateNextRenewal(firstPayment, cycle);
      const newSub = {
          id: Date.now().toString(),
          name: name || 'Unknown',
          cost: parseFloat(cost) || 0,
          plan: 'Standard',
          icon: icon || '✨',
          color: 'bg-primary',
          status: 'active' as const,
          startDate: firstPayment, 
          renewalDate: nextRenewal, 
          category: (isCustomCategory ? customCategory : category) || 'Utilities',
          usageScore: 50,
          usageHistory: [50, 50, 50, 50, 50, 50, 50]
      };
      
      addSubscription(newSub);
      navigate('/hub');
  };

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white min-h-screen flex flex-col overflow-hidden max-w-md mx-auto shadow-2xl relative">
      <header className="flex items-center justify-between p-4 pt-6 shrink-0 z-10">
        <button onClick={() => navigate(-1)} className="flex size-10 items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
          <span className="material-symbols-outlined text-[24px]">close</span>
        </button>
        <h2 className="text-lg font-bold">Track Subscription</h2>
        <div className="size-10"></div>
      </header>

      <div className="flex-1 px-4 pt-4 overflow-y-auto pb-24 no-scrollbar">
        <div className="bg-white dark:bg-[#1e2330] p-6 rounded-[32px] shadow-sm border border-slate-100 dark:border-slate-800 mb-6">
            <h3 className="text-[10px] font-black mb-4 uppercase tracking-[0.2em] text-slate-400">Popular Services</h3>
            <div className="grid grid-cols-4 gap-4">
                {popularServices.map((s, i) => (
                    <button key={i} onClick={() => handleServiceClick(s)} className="flex flex-col items-center gap-2 group">
                        <div className={`size-12 rounded-2xl flex items-center justify-center ${s.color} shadow-sm group-active:scale-95 transition-transform ring-2 ring-transparent group-hover:ring-primary/20 bg-opacity-10`}>
                            <span className="text-xl">{s.defaultIcon}</span>
                        </div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter truncate w-full text-center">{s.name}</span>
                    </button>
                ))}
            </div>
        </div>

        <form className="flex flex-col gap-6 px-1">
            <div className="flex gap-4">
                <div className="flex flex-col gap-2 w-20 shrink-0">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Icon</label>
                     <input 
                        type="text" 
                        value={icon}
                        onChange={(e) => setIcon(e.target.value)}
                        className="w-full h-14 text-center text-3xl rounded-2xl border-none bg-white dark:bg-[#1e2330] ring-1 ring-slate-100 dark:ring-slate-800 focus:ring-2 focus:ring-primary p-0 shadow-sm"
                     />
                </div>
                <div className="flex flex-col gap-2 flex-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Service Name</label>
                    <input 
                        type="text" 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Masterclass" 
                        className="w-full h-14 rounded-2xl border-none bg-white dark:bg-[#1e2330] px-5 ring-1 ring-slate-100 dark:ring-slate-800 focus:ring-2 focus:ring-primary placeholder:text-slate-300 font-bold shadow-sm" 
                    />
                </div>
            </div>

             <div className="flex gap-4">
                 <div className="flex flex-col gap-2 flex-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Price</label>
                    <div className="relative">
                        <span className="absolute left-4 top-4 text-slate-300 font-bold">$</span>
                        <input 
                            type="number" 
                            value={cost}
                            onChange={(e) => setCost(e.target.value)}
                            placeholder="0.00" 
                            className="w-full h-14 rounded-2xl border-none bg-white dark:bg-[#1e2330] pl-8 pr-4 ring-1 ring-slate-100 dark:ring-slate-800 focus:ring-2 focus:ring-primary font-black text-xl shadow-sm" 
                        />
                    </div>
                </div>
                <div className="flex flex-col gap-2 w-1/3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cycle</label>
                    <select 
                        value={cycle}
                        onChange={(e) => setCycle(e.target.value)}
                        className="w-full h-14 rounded-2xl border-none bg-white dark:bg-[#1e2330] px-4 ring-1 ring-slate-100 dark:border-slate-800 focus:ring-2 focus:ring-primary font-bold text-sm shadow-sm"
                    >
                        <option value="/mo">Monthly</option>
                        <option value="/yr">Yearly</option>
                        <option value="/qtr">Quarterly</option>
                        <option value="/wk">Weekly</option>
                    </select>
                </div>
             </div>

             <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Billing Start Date</label>
                <input 
                    type="date" 
                    value={firstPayment}
                    onChange={(e) => setFirstPayment(e.target.value)}
                    className="w-full h-14 rounded-2xl border-none bg-white dark:bg-[#1e2330] px-5 ring-1 ring-slate-100 dark:ring-slate-800 focus:ring-2 focus:ring-primary font-bold shadow-sm" 
                />
            </div>

            <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Category</label>
                <div className="flex gap-2 flex-wrap">
                    {['Entertainment', 'Productivity', 'Utilities', 'Health'].map(c => (
                        <button 
                            type="button" 
                            key={c} 
                            onClick={() => { setCategory(c); setIsCustomCategory(false); }}
                            className={`px-5 py-2.5 rounded-full border text-[11px] font-black uppercase tracking-widest transition-all ${
                                category === c && !isCustomCategory
                                    ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' 
                                    : 'bg-white dark:bg-[#1e2330] border-slate-100 dark:border-slate-800 text-slate-500 hover:border-primary/50'
                            }`}
                        >
                            {c}
                        </button>
                    ))}
                    <button type="button" onClick={() => setIsCustomCategory(true)} className={`size-10 rounded-full border flex items-center justify-center transition-all ${isCustomCategory ? 'bg-primary border-primary text-white shadow-lg' : 'bg-white dark:bg-[#1e2330] border-slate-100 dark:border-slate-800 text-slate-300'}`}>
                        <span className="material-symbols-outlined text-xl">add</span>
                    </button>
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Notes</label>
                <textarea 
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Auto-pay setup, family account details..." 
                    className="w-full h-24 rounded-2xl border-none bg-white dark:bg-[#1e2330] p-5 ring-1 ring-slate-100 dark:ring-slate-800 focus:ring-2 focus:ring-primary placeholder:text-slate-300 text-sm font-medium resize-none shadow-sm" 
                />
            </div>
        </form>

        <div className="mt-10 mb-10 px-1">
            <button onClick={handleSave} className="w-full h-16 bg-primary hover:bg-blue-600 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-primary/25 active:scale-[0.98] transition-all flex items-center justify-center gap-3">
                <span className="material-symbols-outlined">verified</span>
                Add Subscription
            </button>
        </div>
      </div>
    </div>
  );
};

export default AddSubscription;
