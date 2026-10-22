'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import Image from 'next/image';
import { motion, useInView, useScroll, useTransform, PanInfo } from 'framer-motion';

function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

// ── Swipe Check-In Demo ──────────────────────────────────────────────────────

const QUESTIONS = [
  { text: 'Did you use Spotify this week?', sub: 'Weekly usage' },
  { text: 'Would you miss it if it\'s gone?', sub: 'Value check' },
  { text: 'Is $10.99/mo still worth it?', sub: 'Budget fit' },
];

function SwipeDemo() {
  const [idx, setIdx] = useState(0);
  const [flyDir, setFlyDir] = useState<'yes' | 'no' | 'skip' | null>(null);
  const [done, setDone] = useState(false);
  const yesCount = useRef(0);

  function handleSwipe(dir: 'yes' | 'no' | 'skip') {
    if (flyDir) return;
    if (dir === 'yes') yesCount.current++;
    setFlyDir(dir);
    setTimeout(() => {
      setFlyDir(null);
      if (idx >= QUESTIONS.length - 1) {
        setDone(true);
      } else {
        setIdx((i) => i + 1);
      }
    }, 420);
  }

  function reset() {
    yesCount.current = 0;
    setIdx(0);
    setFlyDir(null);
    setDone(false);
  }

  const flyTarget =
    flyDir === 'yes'
      ? { x: 280, rotate: 18, opacity: 0 }
      : flyDir === 'no'
      ? { x: -280, rotate: -18, opacity: 0 }
      : flyDir === 'skip'
      ? { y: 180, opacity: 0 }
      : {};

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Direction labels */}
      <div className="flex items-center justify-between w-[260px]">
        <span className="text-[11px] font-black text-red-400 uppercase tracking-wider">← No</span>
        <span className="text-[11px] font-black text-[#43474e] uppercase tracking-wider">↓ Skip</span>
        <span className="text-[11px] font-black text-[#0052FF] uppercase tracking-wider">Yes →</span>
      </div>

      {/* Card stack */}
      <div className="relative w-[260px] h-[272px]">
        {/* Stacked cards behind */}
        {!done && idx < QUESTIONS.length - 1 && (
          <div className="absolute inset-x-0 bottom-0 top-4 scale-[0.95] origin-bottom bg-[#f2f4f6] rounded-3xl border border-[#e0e4e8]" />
        )}
        {!done && idx < QUESTIONS.length - 2 && (
          <div className="absolute inset-x-0 bottom-0 top-7 scale-[0.90] origin-bottom bg-[#eceff2] rounded-3xl border border-[#e0e4e8]" />
        )}

        {done ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 bg-white rounded-3xl shadow-xl border border-[#e0e4e8] flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="text-[40px] mb-3">{yesCount.current >= 2 ? '💙' : '🤔'}</div>
            <p className="text-[16px] font-black text-[#1a1c1e]">
              {yesCount.current >= 2 ? 'Keep it.' : 'Maybe reconsider.'}
            </p>
            <p className="text-[12px] text-[#43474e] mt-1">{yesCount.current}/3 positive signals</p>
            <button
              onClick={reset}
              className="mt-5 text-[12px] font-black text-[#0052FF] underline underline-offset-2"
            >
              Try again →
            </button>
          </motion.div>
        ) : (
          <motion.div
            key={idx}
            drag
            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
            dragElastic={0.85}
            onDragEnd={(_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
              if (info.offset.x > 70) handleSwipe('yes');
              else if (info.offset.x < -70) handleSwipe('no');
              else if (info.offset.y > 70) handleSwipe('skip');
            }}
            animate={flyDir ? flyTarget : { x: 0, y: 0, rotate: 0, opacity: 1 }}
            transition={
              flyDir
                ? { duration: 0.38, ease: [0.22, 1, 0.36, 1] }
                : { type: 'spring', stiffness: 320, damping: 28 }
            }
            whileDrag={{ scale: 1.03, cursor: 'grabbing' }}
            className="absolute inset-0 bg-white rounded-3xl shadow-xl border border-[#e0e4e8] flex flex-col items-center justify-center p-6 text-center cursor-grab select-none touch-none"
          >
            {/* Progress dots */}
            <div className="flex gap-1.5 mb-5">
              {QUESTIONS.map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-colors duration-200 ${
                    i === idx ? 'bg-[#0052FF]' : i < idx ? 'bg-[#0052FF]/35' : 'bg-[#e0e4e8]'
                  }`}
                />
              ))}
            </div>
            <div className="w-14 h-14 rounded-2xl bg-[#f2f4f6] mb-4 flex items-center justify-center text-2xl">
              🎵
            </div>
            <p className="text-[10px] font-black text-[#0052FF] uppercase tracking-wider mb-2">
              {QUESTIONS[idx].sub}
            </p>
            <p className="text-[15px] font-black text-[#1a1c1e] leading-snug max-w-[180px]">
              {QUESTIONS[idx].text}
            </p>
            <p className="text-[10px] text-[#43474e] font-bold mt-4">Drag to answer</p>
          </motion.div>
        )}
      </div>

      {/* Tap fallbacks */}
      {!done && (
        <div className="flex gap-4">
          <button
            onClick={() => handleSwipe('no')}
            className="w-11 h-11 rounded-full border-2 border-[#e0e4e8] flex items-center justify-center text-[#43474e] font-black text-lg hover:border-red-400 hover:text-red-400 transition-colors"
          >
            ✕
          </button>
          <button
            onClick={() => handleSwipe('skip')}
            className="w-11 h-11 rounded-full border-2 border-[#e0e4e8] flex items-center justify-center text-[#43474e] text-base hover:bg-[#f2f4f6] transition-colors"
          >
            ↓
          </button>
          <button
            onClick={() => handleSwipe('yes')}
            className="w-11 h-11 rounded-full bg-[#0052FF] flex items-center justify-center text-white text-lg font-black active:opacity-80 transition-opacity"
          >
            ✓
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

const SUBS = [
  { name: 'Spotify',  emoji: '🎵', price: '$10.99', renewIn: 3,  color: 'bg-green-500' },
  { name: 'Netflix',  emoji: '📺', price: '$15.49', renewIn: 12, color: 'bg-red-500'   },
  { name: 'Notion',   emoji: '📝', price: '$8.00',  renewIn: 21, color: 'bg-black'     },
  { name: 'Figma',    emoji: '🎨', price: '$12.00', renewIn: 28, color: 'bg-purple-500'},
];

// April 2026 starts on Wednesday (offset = 3)
const CAL_OFFSET = 3;
const CAL_DAYS   = Array.from({ length: 30 }, (_, i) => i + 1);
const TODAY      = 21;
const RENEWAL_DAY = 24; // Spotify renews Apr 24

export default function RootPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { scrollYProgress } = useScroll();
  const navBg = useTransform(
    scrollYProgress,
    [0, 0.04],
    ['rgba(255,255,255,0)', 'rgba(255,255,255,0.95)'],
  );
  const [showScore, setShowScore] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    router.replace('/dashboard');
  }, [user, loading, router]);

  if (loading || user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f9fb] text-[#1a1c1e] overflow-x-hidden">

      {/* ── NAV ── */}
      <motion.nav
        style={{ backgroundColor: navBg }}
        className="fixed top-0 w-full z-50 backdrop-blur-md border-b border-[#e0e4e8]/60"
      >
        <div className="flex justify-between items-center px-5 h-14 max-w-md mx-auto">
          <div className="flex items-center gap-2">
            <Image src="/subsense-logo.png" alt="SubSense" width={30} height={30} className="object-contain" />
            <span className="text-[17px] font-black tracking-tight text-[#1a1c1e]">SubSense</span>
          </div>
          <button
            onClick={() => router.push('/login?mode=signup')}
            className="bg-black text-white text-[13px] font-bold px-4 py-2 rounded-lg active:scale-95 transition-transform"
          >
            Try SubSense
          </button>
        </div>
      </motion.nav>

      <main className="pt-14">

        {/* ── HERO ── */}
        <section className="relative px-5 pt-14 pb-20 flex flex-col items-center text-center overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[320px] h-[320px] bg-[#0052FF]/8 rounded-full blur-[80px] pointer-events-none" />

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: 'backOut' }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0052FF]/8 border border-[#0052FF]/20 mb-7"
          >
            <span className="text-[11px] text-[#0052FF] uppercase tracking-widest font-black">
              ✦ Full-lifecycle subscription intelligence
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-[40px] font-black leading-[1.1] tracking-[-0.025em] text-[#1a1c1e] mb-5 max-w-[300px]"
          >
            One app for every<br />
            <em className="text-[#0052FF] not-italic">subscription decision</em>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="text-[15px] text-[#43474e] leading-relaxed mb-10 max-w-[280px]"
          >
            From tracking what you have, to deciding what to add, to knowing when to quit —
            SubSense covers the full lifecycle.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[300px]"
          >
            <button
              onClick={() => router.push('/login?mode=signup')}
              className="w-full h-14 bg-[#0052FF] text-white font-black text-[15px] rounded-2xl shadow-lg shadow-[#0052FF]/25 active:scale-[0.97] hover:scale-105 hover:shadow-2xl hover:shadow-[#0052FF]/35 transition-all duration-200"
            >
              Try SubSense
            </button>
          </motion.div>

          {/* Mini dashboard preview */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="mt-14 w-full max-w-[320px] rounded-2xl border border-[#e0e4e8] shadow-2xl bg-white p-2"
          >
            <div className="rounded-xl bg-[#f7f9fb] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-[#43474e] uppercase tracking-wider">Monthly Spend</span>
                <span className="text-[11px] font-black text-[#0052FF]">Health: 82</span>
              </div>
              <div className="text-[28px] font-black text-[#1a1c1e] tracking-tighter">$142.50</div>
              <div className="flex gap-2">
                {SUBS.slice(0, 3).map((s) => (
                  <div key={s.name} className="flex-1 bg-white rounded-xl p-2.5 border border-[#e0e4e8]">
                    <div className={`w-5 h-5 ${s.color} rounded-md mb-1.5`} />
                    <div className="text-[10px] font-black text-[#1a1c1e]">{s.name}</div>
                    <div className="text-[9px] text-[#43474e] font-bold">{s.price}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </section>

        {/* ── THE PROBLEM ── */}
        <section className="px-5 py-16 bg-[#f2f4f6] border-y border-[#e0e4e8]">
          <div className="max-w-md mx-auto">
            <Reveal className="text-center mb-10">
              <p className="text-[11px] font-black text-[#0052FF] uppercase tracking-widest mb-2">The Problem</p>
              <h2 className="text-[32px] font-black leading-[1.1] tracking-[-0.02em] text-[#1a1c1e]">
                Prevention over<br />remediation
              </h2>
              <p className="text-[14px] text-[#43474e] mt-3 leading-relaxed">
                We help you make the right choice upfront, not clean up the mess later.
              </p>
            </Reveal>
            <div className="space-y-3">
              {[
                { icon: '⏰', bg: 'bg-black', title: 'Forgotten Renewals', body: 'Most people lose $180/year on services they intended to cancel.', delay: 0.05 },
                { icon: '💳', bg: 'bg-[#0052FF]', title: 'Subscription Fatigue', body: "It's impossible to manually track 12+ monthly billing cycles.", delay: 0.15 },
              ].map((card) => (
                <Reveal key={card.title} delay={card.delay}>
                  <div className="bg-white rounded-2xl border border-[#e0e4e8] p-5 flex gap-4 items-start hover:border-[#0052FF] transition-colors">
                    <div className={`w-11 h-11 rounded-xl ${card.bg} flex items-center justify-center flex-shrink-0 text-xl`}>
                      {card.icon}
                    </div>
                    <div>
                      <p className="text-[15px] font-black text-[#1a1c1e] mb-1">{card.title}</p>
                      <p className="text-[13px] text-[#43474e] leading-relaxed">{card.body}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── STEP 01: MANAGER ── */}
        <section className="px-5 py-20 bg-white">
          <div className="max-w-md mx-auto">
            <Reveal className="text-center mb-10">
              <span className="text-[11px] text-[#0052FF] font-black uppercase tracking-widest block mb-3">
                Step 01 · Manage
              </span>
              <h2 className="text-[36px] font-black leading-[1.05] tracking-[-0.025em] text-[#1a1c1e] mb-4">
                Your Subscription<br />Hub
              </h2>
              <p className="text-[14px] text-[#43474e] leading-relaxed max-w-[280px] mx-auto">
                Add every subscription you have. See renewal dates at a glance and get notified before anything auto-charges.
              </p>
            </Reveal>

            {/* Calendar */}
            <Reveal delay={0.05}>
              <div className="bg-white rounded-2xl border border-[#e0e4e8] p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[13px] font-black text-[#1a1c1e]">April 2026</p>
                  <span className="text-[11px] font-black text-[#0052FF]">2 renewals</span>
                </div>
                <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
                  {['S','M','T','W','T','F','S'].map((d, i) => (
                    <div key={i} className="text-[9px] font-black text-[#43474e] py-1">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-0.5 text-center">
                  {Array.from({ length: CAL_OFFSET }).map((_, i) => <div key={`e${i}`} />)}
                  {CAL_DAYS.map((d) => (
                    <div
                      key={d}
                      className={`text-[11px] font-black w-7 h-7 rounded-full mx-auto flex items-center justify-center transition-colors
                        ${d === TODAY ? 'bg-black text-white' : ''}
                        ${d === RENEWAL_DAY ? 'bg-[#0052FF] text-white' : ''}
                        ${d !== TODAY && d !== RENEWAL_DAY ? 'text-[#1a1c1e]' : ''}
                      `}
                    >
                      {d}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#e0e4e8]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-black" />
                    <span className="text-[10px] font-bold text-[#43474e]">Today</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-[#0052FF]" />
                    <span className="text-[10px] font-bold text-[#43474e]">Renewal</span>
                  </div>
                </div>
              </div>
            </Reveal>

            {/* Notification banner */}
            <Reveal delay={0.1}>
              <motion.div
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                className="bg-[#f7f9fb] rounded-2xl border border-[#e0e4e8] p-4 flex gap-3 items-start"
              >
                <div className="w-10 h-10 bg-[#0052FF] rounded-xl flex items-center justify-center text-white text-base flex-shrink-0">
                  🔔
                </div>
                <div>
                  <p className="text-[13px] font-black text-[#1a1c1e]">Spotify renews in 3 days</p>
                  <p className="text-[11px] text-[#43474e] mt-0.5 leading-relaxed">
                    $10.99 · Apr 24 · Tap to review before it charges
                  </p>
                </div>
              </motion.div>
            </Reveal>
          </div>
        </section>

        {/* ── STEP 02: AI AUDIT ── */}
        <section className="px-5 py-20 bg-black text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 w-56 h-56 bg-[#0052FF]/25 blur-[100px] rounded-full pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-[#0052FF]/15 blur-[80px] rounded-full pointer-events-none" />

          <div className="max-w-md mx-auto relative z-10">
            <Reveal className="text-center mb-10">
              <span className="text-[11px] text-[#0052FF] font-black uppercase tracking-widest block mb-3">
                Step 02 · Decide
              </span>
              <h2 className="text-[36px] font-black leading-[1.05] tracking-[-0.025em] text-white mb-4">
                AI Audit<br />Protocol
              </h2>
              <p className="text-[14px] text-white/65 leading-relaxed max-w-[280px] mx-auto">
                Thinking about a new subscription? Our AI walks through 5 dimensions with you in a real conversation,
                then generates a score — before you commit.
              </p>
            </Reveal>

            {/* Step indicators */}
            <Reveal delay={0.05}>
              <div className="flex items-center justify-center gap-2 mb-8">
                {['Chat', 'Analyze', 'Score'].map((step, i) => (
                  <div key={step} className="flex items-center gap-2">
                    <div className={`px-3 py-1.5 rounded-full text-[11px] font-black transition-colors ${
                      (showScore && i === 2) ? 'bg-[#0052FF] text-white' : 'bg-white/10 text-white/60'
                    }`}>
                      {step}
                    </div>
                    {i < 2 && <div className="w-4 h-px bg-white/20" />}
                  </div>
                ))}
              </div>
            </Reveal>

            {/* Conversation or Score */}
            <Reveal delay={0.1}>
              {!showScore ? (
                <div className="bg-white/5 rounded-3xl p-5 border border-white/10 space-y-4">
                  {[
                    { from: 'ai',   text: "How often do you think you'd use Masterclass each week?" },
                    { from: 'user', text: 'Maybe once or twice?' },
                    { from: 'ai',   text: "You already have Skillshare. Have you finished most of what's available there?" },
                    { from: 'user', text: "Honestly no, there's still a lot left." },
                    { from: 'ai',   text: "Got it. Based on our conversation, I'm ready to generate your score." },
                  ].map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: msg.from === 'ai' ? -16 : 16 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.45, delay: i * 0.12 }}
                      className={`flex ${msg.from === 'user' ? 'justify-end' : 'items-start gap-3'}`}
                    >
                      {msg.from === 'ai' && (
                        <div className="w-8 h-8 rounded-xl bg-[#0052FF] flex items-center justify-center flex-shrink-0 text-sm">🤖</div>
                      )}
                      <div className={`px-3 py-2.5 rounded-2xl text-[12px] leading-relaxed max-w-[220px] ${
                        msg.from === 'ai'
                          ? 'bg-white/10 border border-white/5 rounded-tl-none'
                          : 'bg-[#0052FF] rounded-tr-none font-bold'
                      }`}>
                        {msg.text}
                      </div>
                    </motion.div>
                  ))}

                  <motion.button
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.7 }}
                    onClick={() => setShowScore(true)}
                    className="w-full h-11 bg-[#0052FF] text-white font-black text-[13px] rounded-2xl active:opacity-80 transition-opacity mt-2"
                  >
                    View Score →
                  </motion.button>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  className="bg-white/5 rounded-3xl p-5 border border-white/10"
                >
                  <div className="text-center mb-6">
                    <p className="text-[11px] font-black text-[#0052FF] uppercase tracking-widest mb-2">Masterclass</p>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.5, delay: 0.1, ease: 'backOut' }}
                      className="text-[64px] font-black text-white leading-none tracking-tighter"
                    >
                      62
                    </motion.div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/20 mt-3">
                      <span className="text-[12px] font-black text-red-400">Skip it for now</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {[
                      { label: 'Need Fit',       score: 6, bar: 'bg-yellow-400' },
                      { label: 'Usage Estimate', score: 4, bar: 'bg-red-400'    },
                      { label: 'Budget Fit',     score: 7, bar: 'bg-green-400'  },
                      { label: 'Overlap Risk',   score: 2, bar: 'bg-red-400'    },
                      { label: 'Commitment',     score: 8, bar: 'bg-green-400'  },
                    ].map((dim, i) => (
                      <div key={dim.label}>
                        <div className="flex justify-between mb-1">
                          <span className="text-[11px] font-black text-white/65">{dim.label}</span>
                          <span className="text-[11px] font-black text-white">{dim.score}/10</span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <motion.div
                            className={`h-full ${dim.bar} rounded-full`}
                            initial={{ width: 0 }}
                            animate={{ width: `${dim.score * 10}%` }}
                            transition={{ duration: 0.7, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => setShowScore(false)}
                    className="w-full mt-5 text-[12px] font-black text-white/40 hover:text-white/70 transition-colors"
                  >
                    ← See conversation
                  </button>
                </motion.div>
              )}
            </Reveal>
          </div>
        </section>

        {/* ── STEP 03: WEEKLY CHECK-IN ── */}
        <section className="px-5 py-20 bg-white">
          <div className="max-w-md mx-auto text-center">
            <Reveal>
              <span className="text-[11px] text-[#0052FF] font-black uppercase tracking-widest block mb-3">
                Step 03 · Stay Synced
              </span>
              <h2 className="text-[36px] font-black leading-[1.05] tracking-[-0.025em] text-[#1a1c1e] mb-4">
                Weekly<br />Check-In
              </h2>
              <p className="text-[14px] text-[#43474e] leading-relaxed max-w-[280px] mx-auto mb-10">
                Once a week, swipe through a few quick questions about each subscription.
                30 seconds. Keeps everything honest.
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <SwipeDemo />
            </Reveal>
          </div>
        </section>

        {/* ── STEP 04: MONTHLY REPORT ── */}
        <section className="px-5 py-20 bg-[#f2f4f6]">
          <div className="max-w-md mx-auto text-center">
            <Reveal>
              <span className="text-[11px] text-[#0052FF] font-black uppercase tracking-widest block mb-3">
                Step 04 · Review
              </span>
              <h2 className="text-[36px] font-black leading-[1.05] tracking-[-0.025em] text-[#1a1c1e] mb-4">
                Monthly<br />Report
              </h2>
              <p className="text-[14px] text-[#43474e] leading-relaxed max-w-[280px] mx-auto mb-12">
                See your full subscription ecosystem — how you feel, what changed, and what needs attention.
              </p>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="relative w-52 h-52 mx-auto mb-10">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle className="text-[#e0e4e8] stroke-current" cx="50" cy="50" r="45" fill="transparent" strokeWidth="7" />
                  <motion.circle
                    className="text-[#0052FF] stroke-current"
                    cx="50" cy="50" r="45" fill="transparent"
                    strokeWidth="7" strokeLinecap="round"
                    strokeDasharray="282.7"
                    initial={{ strokeDashoffset: 282.7 }}
                    whileInView={{ strokeDashoffset: 56.5 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.4, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <motion.span
                    initial={{ opacity: 0, scale: 0.5 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.6 }}
                    className="text-[56px] font-black text-[#1a1c1e] leading-none tracking-tighter"
                  >
                    82
                  </motion.span>
                  <span className="text-[11px] text-[#0052FF] font-black uppercase tracking-widest mt-1">Score</span>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.15}>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-4 rounded-2xl border border-[#e0e4e8] text-left">
                  <p className="text-[10px] text-[#43474e] uppercase font-black mb-1 tracking-wider">Monthly Spend</p>
                  <p className="text-[22px] font-black text-[#1a1c1e] tracking-tight">$142.50</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-[#0052FF]/25 text-left">
                  <p className="text-[10px] text-[#0052FF] uppercase font-black mb-1 tracking-wider">Total Savings</p>
                  <p className="text-[22px] font-black text-[#0052FF] tracking-tight">+$24.99</p>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── FINAL CTA ── */}
        <section className="px-5 py-24 bg-[#f7f9fb] text-center">
          <Reveal>
            <h2 className="text-[40px] font-black leading-[1.05] tracking-[-0.025em] text-[#1a1c1e] mb-5">
              Stop the Waste.<br />
              <em className="text-[#0052FF] not-italic">SENSE THE FUTURE.</em>
            </h2>
            <p className="text-[14px] text-[#43474e] mb-10 max-w-[240px] mx-auto leading-relaxed">
              Take control of your digital spend with intelligent precision.
            </p>
          </Reveal>
          <Reveal delay={0.1} className="max-w-[280px] mx-auto">
            <button
              onClick={() => router.push('/login?mode=signup')}
              className="w-full h-14 bg-black text-white font-black text-[15px] rounded-2xl active:scale-[0.97] transition-transform shadow-xl shadow-black/10"
            >
              Try SubSense
            </button>
          </Reveal>
        </section>
      </main>

      {/* ── FOOTER ── */}
      <footer className="bg-black py-12 border-t border-white/5">
        <div className="flex flex-col items-center text-center gap-8 px-5">
          <div className="flex items-center gap-2">
            <Image src="/subsense-logo.png" alt="Subsense" width={28} height={28} className="object-contain rounded-lg" />
            <span className="text-[16px] font-black text-white tracking-tight">Subsense</span>
          </div>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-3">
            {['FEATURES', 'PRECISION', 'SECURITY', 'PRIVACY'].map((link) => (
              <a key={link} href="#" className="text-white/35 text-[12px] font-black hover:text-white transition-colors tracking-wider">
                {link}
              </a>
            ))}
          </div>
          <div className="w-full h-px bg-white/10" />
          <p className="text-[10px] font-black text-white/25 uppercase tracking-[0.2em]">
            © 2026 SubSense
          </p>
        </div>
      </footer>
    </div>
  );
}
