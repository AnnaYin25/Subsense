
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSubscriptions, formatDate } from '../context/SubscriptionContext';

const COMMON_EMOJIS = [
  '🎬', '🎵', '📺', '🎨', '🤖', '📦', '🍎', '🎮', 
  '🛡️', '🍔', '🚲', '📚', '☁️', '💡', '📧', '🛒',
  '🍿', '🎧', '🎸', '💻', '📱', '🏋️', '🧘', '🥘'
];

const SubscriptionDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getSubscription, removeSubscription, updateSubscription } = useSubscriptions();
  const sub = getSubscription(id || '');

  const [isEditing, setIsEditing] = useState(false);
  const [showUnsubscribeModal, setShowUnsubscribeModal] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  
  const [editPlan, setEditPlan] = useState(sub?.plan || '');
  const [editCost, setEditCost] = useState(sub?.cost?.toString() || '');
  const [editRenewal, setEditRenewal] = useState(sub?.renewalDate || '');
  const [editIcon, setEditIcon] = useState(sub?.icon || '✨');

  // Custom Fields State
  const [customFields, setCustomFields] = useState<{ label: string; value: string }[]>(sub?.customFields || []);
  const [isAddingField, setIsAddingField] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');

  // Notification States
  const [remindThreeDays, setRemindThreeDays] = useState(true);
  const [remindOnDay, setRemindOnDay] = useState(false);
  const [pushAlerts, setPushAlerts] = useState(true);

  if (!sub) {
    return (
      <div className="flex h-screen items-center justify-center bg-background-light dark:bg-background-dark">
        <button onClick={() => navigate(-1)} className="absolute top-4 left-4 p-2 text-slate-900 dark:text-white">
            <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <p className="text-slate-500">Subscription not found</p>
      </div>
    );
  }

  const handleConfirmUnsubscribe = () => {
    removeSubscription(sub.id);
    navigate('/hub');
  };

  const handleSaveEdit = () => {
    setIsEditing(false);
    setShowIconPicker(false);
    updateSubscription(sub.id, {
      plan: editPlan,
      cost: parseFloat(editCost),
      renewalDate: editRenewal,
      customFields: customFields,
      icon: editIcon
    });
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setShowIconPicker(false);
    setEditPlan(sub.plan);
    setEditCost(sub.cost.toString());
    setEditRenewal(sub.renewalDate);
    setEditIcon(sub.icon);
    setCustomFields(sub.customFields || []);
  };

  const handleAddField = () => {
    if (newFieldLabel && newFieldValue) {
      setCustomFields([...customFields, { label: newFieldLabel, value: newFieldValue }]);
      setNewFieldLabel('');
      setNewFieldValue('');
      setIsAddingField(false);
    }
  };

  const removeField = (index: number) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, newValue: string) => {
    const updated = [...customFields];
    updated[index].value = newValue;
    setCustomFields(updated);
  };

  const usageData = sub.usageHistory?.slice(-6) || [50, 50, 50, 50, 50, 50];
  const monthNames = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
  const maxUsage = Math.max(...usageData);
  const minUsage = Math.min(...usageData);

  return (
    <div className="bg-background-light dark:bg-background-dark min-h-screen flex flex-col max-w-md mx-auto shadow-2xl relative">
      <header className="flex items-center justify-between p-4 pt-6 sticky top-0 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-sm z-20">
        <button onClick={() => navigate(-1)} className="flex size-10 items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-slate-900 dark:text-white">
          <span className="material-symbols-outlined text-[24px]">arrow_back</span>
        </button>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Subscription Details</h2>
        <div className="size-10 flex items-center justify-center">
            <button className="flex size-10 items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-slate-900 dark:text-white">
                 <span className="material-symbols-outlined text-[24px]">more_vert</span>
            </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 overflow-y-auto no-scrollbar pb-24">
        {/* Header Card with Inline Editing */}
        <div className="bg-white dark:bg-[#1e2330] rounded-[32px] p-10 shadow-sm border border-slate-100 dark:border-slate-800 mb-8 flex flex-col items-center text-center">
            <div className="relative">
              <div className={`size-24 rounded-3xl ${sub.color} flex items-center justify-center mb-6 shadow-lg overflow-hidden relative border border-slate-100 dark:border-slate-700 bg-opacity-20`}>
                  <span className="text-6xl">{isEditing ? editIcon : sub.icon}</span>
              </div>
              {isEditing && (
                <button 
                  onClick={() => setShowIconPicker(!showIconPicker)}
                  className="absolute -bottom-2 -right-2 size-10 bg-primary text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white dark:border-[#1e2330] active:scale-95 transition-transform z-10"
                >
                  <span className="material-symbols-outlined text-sm">{showIconPicker ? 'close' : 'edit'}</span>
                </button>
              )}
            </div>

            {/* Emoji Picker Popover */}
            {isEditing && showIconPicker && (
              <div className="w-full bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 mb-6 border border-slate-200 dark:border-slate-700 animate-fade-in-up grid grid-cols-6 gap-2">
                {COMMON_EMOJIS.map(emoji => (
                  <button 
                    key={emoji}
                    onClick={() => {
                      setEditIcon(emoji);
                      setShowIconPicker(false);
                    }}
                    className={`text-2xl p-2 rounded-xl hover:bg-white dark:hover:bg-slate-700 transition-colors ${editIcon === emoji ? 'ring-2 ring-primary bg-white dark:bg-slate-700' : ''}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-1">{sub.name}</h1>
            
            {isEditing ? (
                <div className="w-full flex flex-col items-center mb-4">
                  <label className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Plan Name</label>
                  <input 
                      type="text" 
                      value={editPlan} 
                      onChange={(e) => setEditPlan(e.target.value)}
                      className="text-sm text-center bg-slate-50 dark:bg-slate-800 rounded-xl border-none ring-2 ring-primary p-2 w-full max-w-[200px] font-bold uppercase tracking-widest text-slate-900 dark:text-white"
                  />
                </div>
            ) : (
                <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mb-6">{sub.plan}</p>
            )}

            <div className="flex items-baseline gap-1 mb-8">
                {isEditing ? (
                    <div className="flex flex-col items-center">
                        <label className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Monthly Cost</label>
                        <div className="flex items-center gap-1">
                            <span className="text-slate-400 font-bold text-2xl">$</span>
                            <input 
                                type="number" 
                                value={editCost} 
                                onChange={(e) => setEditCost(e.target.value)}
                                className="text-5xl font-black text-gray-900 dark:text-white tracking-tighter w-40 bg-transparent border-none focus:ring-0 p-0 text-center"
                            />
                        </div>
                    </div>
                ) : (
                    <>
                        <span className="text-5xl font-black text-gray-900 dark:text-white tracking-tighter">${sub.cost.toFixed(2)}</span>
                        <span className="text-slate-400 font-bold text-lg">/mo</span>
                    </>
                )}
            </div>
            
            <div className="flex gap-2">
                 <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${sub.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                     {sub.status}
                 </span>
                 <span className="px-4 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest">
                     {sub.category}
                 </span>
            </div>
        </div>

        {/* Plan Details Section */}
        <div className="mb-8">
            <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Plan Details</h3>
                {!isEditing && (
                    <button onClick={() => setIsEditing(true)} className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1 hover:underline">
                        <span className="material-symbols-outlined text-[14px]">edit</span>
                        Edit Plan
                    </button>
                )}
            </div>
            <div className="bg-white dark:bg-[#1e2330] rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 space-y-5">
                <div className="flex justify-between items-center text-sm">
                    <span className="font-medium text-slate-400">First Payment</span>
                    <span className="font-black text-gray-900 dark:text-white">
                        {sub.startDate ? formatDate(sub.startDate) : 'N/A'}
                    </span>
                </div>
                 <div className="flex justify-between items-center text-sm">
                    <span className="font-medium text-slate-400">Renewal Date</span>
                    {isEditing ? (
                        <input 
                            type="date" 
                            value={editRenewal} 
                            onChange={(e) => setEditRenewal(e.target.value)}
                            className="bg-slate-50 dark:bg-slate-800 border-none ring-2 ring-primary rounded px-2 py-1 font-black text-gray-900 dark:text-white"
                        />
                    ) : (
                        <span className="font-black text-gray-900 dark:text-white">{formatDate(sub.renewalDate)}</span>
                    )}
                </div>
                <div className="flex justify-between items-center text-sm">
                    <span className="font-medium text-slate-400">Cycle</span>
                    <span className="font-black text-gray-900 dark:text-white">Monthly</span>
                </div>
            </div>
        </div>

        {/* Custom Fields Section */}
        <div className="mb-8">
            <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Custom Information</h3>
                <button 
                  onClick={() => setIsAddingField(!isAddingField)} 
                  className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1 hover:underline"
                >
                    <span className="material-symbols-outlined text-[14px]">{isAddingField ? 'close' : 'add'}</span>
                    {isAddingField ? 'Cancel' : 'Add Field'}
                </button>
            </div>
            <div className="bg-white dark:bg-[#1e2330] rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 space-y-5">
                {customFields.length === 0 && !isAddingField && (
                    <p className="text-xs text-slate-400 text-center py-2">No custom information added yet.</p>
                )}
                
                {customFields.map((field, index) => (
                    <div key={index} className="flex justify-between items-center text-sm">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-400 text-[10px] uppercase tracking-wider">{field.label}</span>
                          {isEditing ? (
                              <input 
                                  type="text" 
                                  value={field.value} 
                                  onChange={(e) => updateField(index, e.target.value)}
                                  className="font-black text-gray-900 dark:text-white bg-slate-50 dark:bg-slate-800 border-none ring-1 ring-slate-200 dark:ring-slate-700 rounded px-2 py-1 mt-1 text-sm"
                              />
                          ) : (
                              <span className="font-black text-gray-900 dark:text-white">{field.value}</span>
                          )}
                        </div>
                        {isEditing && (
                            <button onClick={() => removeField(index)} className="text-red-500 hover:text-red-600 transition-colors">
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                        )}
                    </div>
                ))}

                {isAddingField && (
                    <div className="flex flex-col gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700 animate-fade-in-up">
                        <input 
                            type="text" 
                            placeholder="Label (e.g. Billing Email)" 
                            value={newFieldLabel}
                            onChange={(e) => setNewFieldLabel(e.target.value)}
                            className="bg-white dark:bg-slate-800 border-none ring-1 ring-slate-200 dark:ring-slate-700 rounded-lg p-2 text-sm font-bold text-slate-900 dark:text-white"
                        />
                        <input 
                            type="text" 
                            placeholder="Value" 
                            value={newFieldValue}
                            onChange={(e) => setNewFieldValue(e.target.value)}
                            className="bg-white dark:bg-slate-800 border-none ring-1 ring-slate-200 dark:ring-slate-700 rounded-lg p-2 text-sm text-slate-900 dark:text-white"
                        />
                        <button 
                            onClick={handleAddField}
                            className="bg-primary text-white rounded-lg py-2 text-xs font-black uppercase tracking-widest shadow-md active:scale-[0.98] transition-transform"
                        >
                            Save Field
                        </button>
                    </div>
                )}
            </div>
        </div>

        {/* Notification Settings Section */}
        <div className="mb-8">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 px-1">Notification Settings</h3>
            <div className="bg-white dark:bg-[#1e2330] rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 space-y-5">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-900 dark:text-white">3-Day Reminder</span>
                        <span className="text-[10px] text-slate-400 font-medium">Alert me 3 days before renewal</span>
                    </div>
                    <button 
                        onClick={() => setRemindThreeDays(!remindThreeDays)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${remindThreeDays ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${remindThreeDays ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>
                <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-900 dark:text-white">Same Day Alert</span>
                        <span className="text-[10px] text-slate-400 font-medium">Alert me on the morning of renewal</span>
                    </div>
                    <button 
                        onClick={() => setRemindOnDay(!remindOnDay)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${remindOnDay ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${remindOnDay ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700 pt-5">
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-900 dark:text-white">Push Notifications</span>
                        <span className="text-[10px] text-slate-400 font-medium">Receive high-priority system alerts</span>
                    </div>
                    <button 
                        onClick={() => setPushAlerts(!pushAlerts)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${pushAlerts ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${pushAlerts ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>
            </div>
        </div>

        {/* Enhanced Usage History Graph */}
        <div className="mb-10">
             <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">6-Month Usage History</h3>
                <div className="flex gap-4">
                    <div className="flex items-center gap-1.5">
                        <div className="size-2 rounded-full bg-primary"></div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">High</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="size-2 rounded-full bg-slate-300 dark:bg-slate-600"></div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Low</span>
                    </div>
                </div>
             </div>
             <div className="bg-white dark:bg-[#1e2330] rounded-2xl p-8 shadow-sm border border-slate-100 dark:border-slate-800">
                <div className="flex items-end justify-between h-48 gap-3 mb-6 relative">
                    {usageData.map((val, i) => {
                        const isPeak = val === maxUsage;
                        const isLow = val === minUsage;
                        const isHigh = val >= 50;

                        return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-3 group relative h-full justify-end">
                                 {isPeak && (
                                     <div className="absolute -top-6 bg-mint-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-widest shadow-sm animate-bounce">
                                         Peak
                                     </div>
                                 )}
                                 {isLow && (
                                     <div className="absolute -top-6 bg-red-400 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-widest shadow-sm">
                                         Drop
                                     </div>
                                 )}

                                 <div className="w-full bg-slate-50 dark:bg-slate-800/50 rounded-xl relative overflow-hidden h-full flex items-end">
                                     <div 
                                        className={`w-full transition-all duration-1000 ease-out rounded-xl relative ${
                                            isHigh ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'
                                        } ${isPeak ? 'shadow-[0_0_15px_rgba(36,99,235,0.4)]' : ''}`} 
                                        style={{ height: `${val}%` }}
                                     >
                                        <div className="absolute inset-x-0 top-1 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-[10px] font-black text-white/80">{val}%</span>
                                        </div>
                                     </div>
                                 </div>
                                 <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${isPeak ? 'text-primary' : 'text-slate-400'}`}>
                                     {monthNames[i]}
                                 </span>
                            </div>
                        );
                    })}
                </div>
                <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700/50">
                    <span className="material-symbols-outlined text-primary text-xl">insights</span>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                        Your usage peaked in <span className="font-bold text-gray-900 dark:text-white">March</span> at {maxUsage}%. Consistent patterns like this suggest the plan is well-suited for your needs.
                    </p>
                </div>
             </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 pt-0 flex flex-col gap-4">
          {isEditing ? (
            <div className="flex gap-3">
              <button 
                  onClick={handleCancelEdit}
                  className="flex-1 h-14 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm font-black text-sm uppercase tracking-widest text-slate-500 active:scale-95 transition-all"
              >
                  Cancel
              </button>
              <button 
                  onClick={handleSaveEdit}
                  className="flex-[2] h-14 bg-primary text-white rounded-2xl shadow-xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                  <span className="material-symbols-outlined">save</span>
                  Save Changes
              </button>
            </div>
          ) : (
            <>
                <button 
                    onClick={() => setIsEditing(true)}
                    className="w-full h-16 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-primary rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm font-black text-sm uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                    <span className="material-symbols-outlined text-[20px]">edit_square</span>
                    Update Subscription Info
                </button>
                <button 
                    onClick={() => setShowUnsubscribeModal(true)}
                    className="w-full h-16 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm text-red-500 font-black text-sm uppercase tracking-widest active:scale-95 transition-all"
                >
                    Unsubscribe
                </button>
            </>
          )}
        </div>
      </main>

      {/* Custom Unsubscribe Confirmation Modal */}
      {showUnsubscribeModal && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center px-4 pb-12 sm:items-center sm:pb-0">
              {/* Backdrop */}
              <div 
                  className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-fade-in"
                  onClick={() => setShowUnsubscribeModal(false)}
              ></div>
              
              {/* Modal Card */}
              <div className="relative w-full max-w-sm bg-white dark:bg-[#1a2233] rounded-[32px] p-8 shadow-2xl animate-slide-up sm:animate-fade-in-up border border-slate-100 dark:border-slate-700 text-center">
                  <div className="size-20 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mb-6 mx-auto">
                      <span className="material-symbols-outlined text-4xl">heart_broken</span>
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-3">Unsubscribe from {sub.name}?</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 leading-relaxed">
                      This will remove the subscription from your manager. You'll need to manually cancel via the provider to stop future billing.
                  </p>
                  
                  <div className="flex flex-col gap-3">
                      <button 
                          onClick={handleConfirmUnsubscribe}
                          className="w-full py-4 bg-red-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-red-500/20 active:scale-95 transition-all"
                      >
                          Yes, Unsubscribe
                      </button>
                      <button 
                          onClick={() => setShowUnsubscribeModal(false)}
                          className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all"
                      >
                          Keep Subscription
                      </button>
                  </div>
              </div>
          </div>
      )}

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up {
          animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default SubscriptionDetail;
