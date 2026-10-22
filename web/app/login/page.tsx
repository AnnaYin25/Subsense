'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signUp, signIn } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>(
    searchParams.get('mode') === 'signup' ? 'signup' : 'signin'
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAuth = async () => {
    if (!email || !password) { setError('Please fill in all fields'); return; }
    setLoading(true); setError('');
    try {
      if (mode === 'signup') {
        await signUp(email, password, 'User');
        router.push('/setup');
      } else {
        await signIn(email, password);
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) throw new Error('No authenticated user found');
        const { data: persona, error: personaError } = await supabase
          .from('user_personas').select('setup_completed').eq('user_id', authUser.id).single();
        if (personaError && personaError.code !== 'PGRST116') throw personaError;
        router.push(persona?.setup_completed ? '/dashboard' : '/setup');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Back to landing */}
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-1.5 text-sm font-semibold text-gray-400 hover:text-gray-600 transition-colors mb-6"
        >
          ← Back
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <img
            src="/subsense-logo.png"
            alt="SubSense"
            className="w-24 h-24 mx-auto mb-3 object-contain"
          />
          <h1 className="text-2xl font-black text-gray-900 mb-1">
            {mode === 'signup' ? 'Create Account' : 'Welcome Back'}
          </h1>
          <p className="text-sm text-gray-500">
            {mode === 'signup' ? 'Start managing your subscriptions' : 'Sign in to your account'}
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAuth()}
              className="w-full h-12 bg-gray-50 border border-gray-200 rounded-xl px-4 text-base text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-400 transition-colors"
              suppressHydrationWarning
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAuth()}
              className="w-full h-12 bg-gray-50 border border-gray-200 rounded-xl px-4 text-base text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-400 transition-colors"
              suppressHydrationWarning
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button onClick={handleAuth} disabled={loading}
            className="w-full h-12 bg-blue-500 hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed rounded-xl font-bold text-white transition-colors shadow-md shadow-blue-100 mt-2">
            {loading
              ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : mode === 'signup' ? 'Sign Up' : 'Sign In'}
          </button>

          <button onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(''); }}
            className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors text-center py-1">
            {mode === 'signup' ? 'Already have an account? ' : "Don't have an account? "}
            <span className="text-blue-500 font-semibold">
              {mode === 'signup' ? 'Sign In' : 'Sign Up'}
            </span>
          </button>
        </div>

      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
