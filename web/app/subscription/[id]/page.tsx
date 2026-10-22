'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSubscriptions } from '@/lib/contexts/SubscriptionContext';
import { useAuth } from '@/lib/contexts/AuthContext';
import { getSubRecentSignals } from '@/lib/utils/database';

const CANCEL_REASONS = [
  { key: 'too_expensive',      label: 'Too expensive' },
  { key: 'not_using',          label: 'Not using it enough' },
  { key: 'found_alternative',  label: 'Found an alternative' },
  { key: 'no_longer_need',     label: 'No longer need it' },
  { key: 'trial_ended',        label: 'Trial ended' },
];

const DELETE_WATCHLIST_REASONS = [
  { key: 'not_interested',     label: 'No longer interested' },
  { key: 'too_expensive',      label: 'Too expensive' },
  { key: 'found_alternative',  label: 'Found an alternative' },
  { key: 'just_exploring',     label: 'Was just exploring' },
  { key: 'already_have_it',    label: 'Already have a similar service' },
];

export default function SubscriptionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { subscriptions, editSubscription, removeSubscription } = useSubscriptions();
  const { user } = useAuth();

  const subscription = subscriptions.find(s => s.id === id);

  const [loading, setLoading] = useState(false);
  const [signals, setSignals] = useState<Array<'right' | 'left' | 'down'>>([]);
  const [modal, setModal] = useState<'cancel' | 'deleteWatchlist' | null>(null);

  useEffect(() => {
    if (user?.id && id) {
      getSubRecentSignals(user.id, id, 6).then(setSignals);
    }
  }, [user?.id, id]);

  if (!subscription) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 font-black text-sm tracking-widest">SUBSCRIPTION NOT FOUND</p>
      </div>
    );
  }

  // ── Date helpers ──────────────────────────────────────────────────────────

  const calculateNextRenewal = () => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const [y, m, d] = subscription.nextRenewalDate.split('-').map(Number);
    const next = new Date(y, m - 1, d);
    while (next <= today) {
      switch (subscription.billingCycle) {
        case 'daily':     next.setDate(next.getDate() + 1); break;
        case 'weekly':    next.setDate(next.getDate() + 7); break;
        case 'monthly':   next.setMonth(next.getMonth() + 1); break;
        case 'quarterly': next.setMonth(next.getMonth() + 3); break;
        case 'yearly':    next.setFullYear(next.getFullYear() + 1); break;
      }
    }
    return next;
  };

  const daysUntilRenewal = () => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.ceil((calculateNextRenewal().getTime() - today.getTime()) / 86400000);
  };

  const daysSinceStart = () => {
    if (!subscription.startDate) return 0;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const [y, m, d] = subscription.startDate.split('-').map(Number);
    return Math.max(0, Math.floor((today.getTime() - new Date(y, m - 1, d).getTime()) / 86400000));
  };

  const nextRenewal  = calculateNextRenewal();
  const daysLeft     = daysUntilRenewal();
  const daysUsed     = daysSinceStart();
  const isWatchlist  = subscription.status === 'watchlist';
  const isPaused     = subscription.status === 'paused';
  const decisionTitle = isWatchlist
    ? 'Ready to decide?'
    : isPaused
      ? 'Paused for now'
      : daysLeft <= 5
        ? 'Renewal is close'
        : 'Manage this subscription';
  const decisionCopy = isWatchlist
    ? 'Subscribe when the value is clear, or remove it if the moment passed.'
    : isPaused
      ? 'Resume it if you miss it, or cancel if the pause already answered the question.'
      : daysLeft <= 5
        ? 'Make the call before the next charge hits.'
        : 'Pause it, cancel it, or leave it alone until the next signal.';
  const primaryActionLabel = isWatchlist
    ? 'Subscribe Now'
    : isPaused
      ? 'Resume Service'
      : daysLeft <= 5
        ? 'Pause Before Renewal'
        : 'Pause';
  const secondaryActionLabel = isWatchlist
    ? 'Remove'
    : daysLeft <= 5
      ? 'Cancel Before Charge'
      : 'Cancel';

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleToggleStatus = async () => {
    setLoading(true);
    const newStatus = subscription.status === 'active' ? 'paused' : 'active';
    await editSubscription(subscription.id, { status: newStatus });
    setLoading(false);
  };

  const handleConfirmCancel = async (reason: string | null) => {
    setModal(null);
    setLoading(true);
    const updates: { status: 'cancelled'; cancellationReason?: string } = { status: 'cancelled' };
    if (reason) updates.cancellationReason = reason;
    const ok = await editSubscription(subscription.id, updates);
    setLoading(false);
    if (ok) router.push('/dashboard');
  };

  const handleConfirmDeleteWatchlist = async () => {
    setModal(null);
    setLoading(true);
    const ok = await removeSubscription(subscription.id);
    setLoading(false);
    if (ok) router.push('/dashboard');
  };

  const handleActivate = async () => {
    setLoading(true);
    const ok = await editSubscription(subscription.id, { status: 'active' });
    setLoading(false);
    if (ok) router.push(`/subscription/${subscription.id}/edit`);
  };

  // ── Badge helpers ─────────────────────────────────────────────────────────

  const statusBadge = () => {
    if (isWatchlist) return <span className="text-[9px] font-black bg-blue-50 text-blue-500 border border-blue-200 rounded px-2 py-0.5">WATCHLIST</span>;
    if (isPaused)    return <span className="text-[9px] font-black bg-gray-100 text-gray-500 border border-gray-200 rounded px-2 py-0.5">PAUSED</span>;
    return <span className="text-[9px] font-black bg-green-50 text-green-600 border border-green-200 rounded px-2 py-0.5">ACTIVE</span>;
  };

  const daysLeftBadge = () => {
    if (isWatchlist) return null;
    const cls = daysLeft <= 3
      ? 'bg-red-50 text-red-500 border-red-200'
      : daysLeft <= 5
        ? 'bg-orange-50 text-orange-500 border-orange-200'
        : 'bg-gray-100 text-gray-500 border-gray-200';
    return <span className={`text-[9px] font-black border rounded px-2 py-0.5 ${cls}`}>{daysLeft === 0 ? 'Today!' : `${daysLeft}d left`}</span>;
  };

  const signalLabel = () => {
    const rights = signals.filter(s => s === 'right').length;
    const lefts  = signals.filter(s => s === 'left').length;
    const ratio  = rights / signals.length;
    if (ratio >= 0.6) return '♥  Loving it';
    if (lefts / signals.length >= 0.5) return '○  On the fence';
    return '◐  Mixed signals';
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-gray-50/90 backdrop-blur border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-xl text-gray-900">←</button>
          <span className="text-sm font-black tracking-[0.15em] text-gray-900">DETAILS</span>
          <button onClick={() => router.push(`/subscription/${subscription.id}/edit`)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors border border-gray-200 text-base">✏️</button>
        </header>

        <div
          className="max-w-lg mx-auto px-4"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 104px)' }}
        >

          {/* Hero */}
          <div className="flex flex-col items-center py-6 gap-2">
            <div className="w-20 h-20 rounded-full bg-blue-50 border-2 border-blue-100 flex items-center justify-center text-4xl shadow-md">
              {subscription.iconEmoji}
            </div>
            <p className="text-3xl font-black text-gray-900">{subscription.name}</p>
          </div>

          {/* Cost card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-center mb-4">
            <div className="mb-1">{statusBadge()}</div>
            <p className="text-5xl font-black text-gray-900 my-2">${subscription.cost.toFixed(2)}</p>
            <p className="text-sm text-gray-400 font-medium mb-3">/ {subscription.billingCycle}</p>
            <div className="flex gap-2 flex-wrap justify-center">
              <span className="text-[9px] font-black bg-gray-100 text-gray-500 border border-gray-200 rounded px-2 py-0.5">{subscription.planName.toUpperCase()}</span>
              <span className="text-[9px] font-black bg-gray-100 text-gray-500 border border-gray-200 rounded px-2 py-0.5">{daysUsed}d used</span>
              {daysLeftBadge()}
            </div>
          </div>

          {/* Plan details */}
          <div className="mb-4">
            <p className="text-[9px] font-black tracking-widest text-gray-400 mb-2">PLAN DETAILS</p>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
              {!isWatchlist && (
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-gray-500">Next Renewal</span>
                  <span className="text-sm font-semibold text-gray-900">{nextRenewal.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
              )}
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-gray-500">Cycle</span>
                <span className="text-sm font-semibold text-gray-900">{subscription.billingCycle.charAt(0).toUpperCase() + subscription.billingCycle.slice(1)}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-gray-500">Category</span>
                <span className="text-sm font-semibold text-gray-900">{subscription.category}</span>
              </div>
              {subscription.startDate && (
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-gray-500">Start Date</span>
                  <span className="text-sm font-semibold text-gray-900">{new Date(subscription.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
              )}
            </div>
          </div>

          {/* Check-in signals */}
          <div className="mb-4">
            <p className="text-[9px] font-black tracking-widest text-gray-400 mb-2">CHECK-IN SIGNALS</p>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              {signals.length === 0 ? (
                <p className="text-sm text-gray-400">No check-ins yet — run a check-in to start tracking.</p>
              ) : (
                <>
                  <div className="flex gap-2 mb-2">
                    {signals.map((dir, i) => (
                      <div key={i} className={`w-3 h-3 rounded-full ${dir === 'right' ? 'bg-green-500' : dir === 'left' ? 'bg-red-400' : 'bg-yellow-400'}`} />
                    ))}
                  </div>
                  <p className="text-sm font-semibold text-gray-900 mb-0.5">{signalLabel()}</p>
                  <p className="text-xs text-gray-400">Based on your last {signals.length} check-in{signals.length > 1 ? 's' : ''}</p>
                </>
              )}
            </div>
          </div>

          {/* Notes */}
          {subscription.notes && (
            <div className="mb-4">
              <p className="text-[9px] font-black tracking-widest text-gray-400 mb-2">NOTES</p>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <p className="text-sm text-gray-500 italic text-center">{subscription.notes}</p>
              </div>
            </div>
          )}

          {/* Decision zone */}
          <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-[9px] font-black tracking-widest text-blue-500 mb-1">DECISION ZONE</p>
            <p className="text-lg font-black text-gray-900">{decisionTitle}</p>
            <p className="text-sm text-gray-400 leading-5 mt-1 mb-4">{decisionCopy}</p>
            <div className="flex gap-3">
            {isWatchlist ? (
              <>
                <button onClick={handleActivate} disabled={loading}
                  className="flex-1 h-14 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition-colors disabled:opacity-60">
                  {loading ? <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : primaryActionLabel}
                </button>
                <button onClick={() => setModal('deleteWatchlist')} disabled={loading}
                  className="flex-1 h-14 bg-white border-2 border-red-400 text-red-500 font-bold rounded-xl hover:bg-red-50 transition-colors disabled:opacity-60">
                  {secondaryActionLabel}
                </button>
              </>
            ) : (
              <>
                <button onClick={handleToggleStatus} disabled={loading}
                  className={`flex-1 h-14 font-bold rounded-xl transition-colors disabled:opacity-60 ${
                    daysLeft <= 5 && !isPaused
                      ? 'bg-blue-500 hover:bg-blue-600 text-white'
                      : 'bg-white border-2 border-blue-500 text-blue-500 hover:bg-blue-50'
                  }`}>
                  {loading ? <span className={`inline-block w-5 h-5 border-2 border-t-transparent rounded-full animate-spin ${daysLeft <= 5 && !isPaused ? 'border-white' : 'border-blue-500'}`} /> : primaryActionLabel}
                </button>
                <button onClick={() => setModal('cancel')} disabled={loading}
                  className="flex-1 h-14 bg-white border-2 border-red-400 text-red-500 font-bold rounded-xl hover:bg-red-50 transition-colors disabled:opacity-60">
                  {secondaryActionLabel}
                </button>
              </>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* Cancel modal */}
      {modal === 'cancel' && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-end justify-center" onClick={() => setModal(null)}>
          <div className="w-full max-w-lg bg-white rounded-t-3xl p-6 pb-10" onClick={e => e.stopPropagation()}>
            <p className="text-lg font-black text-gray-900 text-center mb-1">Why are you canceling?</p>
            <p className="text-sm text-gray-400 text-center mb-4">{subscription.name}</p>
            <div className="space-y-2">
              {CANCEL_REASONS.map(r => (
                <button key={r.key} onClick={() => void handleConfirmCancel(r.key)}
                  className="w-full px-4 py-3 border border-gray-100 rounded-xl text-left text-sm font-medium text-gray-900 hover:bg-gray-50 transition-colors">
                  {r.label}
                </button>
              ))}
            </div>
            <button onClick={() => void handleConfirmCancel(null)} className="w-full mt-3 py-3 text-sm text-gray-400 hover:text-gray-600 transition-colors">Skip</button>
          </div>
        </div>
      )}

      {/* Delete watchlist modal */}
      {modal === 'deleteWatchlist' && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-end justify-center" onClick={() => setModal(null)}>
          <div className="w-full max-w-lg bg-white rounded-t-3xl p-6 pb-10" onClick={e => e.stopPropagation()}>
            <p className="text-lg font-black text-gray-900 text-center mb-1">Why are you removing this?</p>
            <p className="text-sm text-gray-400 text-center mb-4">{subscription.name}</p>
            <div className="space-y-2">
              {DELETE_WATCHLIST_REASONS.map(r => (
                <button key={r.key} onClick={() => void handleConfirmDeleteWatchlist()}
                  className="w-full px-4 py-3 border border-gray-100 rounded-xl text-left text-sm font-medium text-gray-900 hover:bg-gray-50 transition-colors">
                  {r.label}
                </button>
              ))}
            </div>
            <button onClick={() => void handleConfirmDeleteWatchlist()} className="w-full mt-3 py-3 text-sm text-gray-400 hover:text-gray-600 transition-colors">Skip</button>
          </div>
        </div>
      )}
    </>
  );
}
