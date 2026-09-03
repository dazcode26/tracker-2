import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Layers, ShieldCheck, Sparkles, Laptop, Smartphone, Terminal, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { AuthUser } from '../types';

interface LoginScreenProps {
  onSignInGoogle: () => Promise<void>;
  onDevBypass: () => void;
  isLoading?: boolean;
  error?: string | null;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onSignInGoogle,
  onDevBypass,
  isLoading = false,
  error = null,
}) => {
  const [signingIn, setSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(error);

  // Check if running in development mode (AI Studio preview / localhost)
  // In production builds (Vercel), DEV is strictly false.
  const isDevEnvironment =
    Boolean((import.meta as any)?.env?.DEV) ||
    Boolean((import.meta as any)?.env?.MODE === 'development') ||
    (typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.includes('run.app')));

  const handleGoogleClick = async () => {
    try {
      setSigningIn(true);
      setErrorMessage(null);
      await onSignInGoogle();
    } catch (err: any) {
      console.error('Google Sign-In error:', err);
      setErrorMessage(err?.message || 'Failed to sign in with Google. Please try again.');
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#09090b] text-[#f4f4f5] flex flex-col justify-between relative overflow-hidden font-sans select-none">
      {/* Subtle Background Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-orange-600/[0.03] rounded-full blur-[120px] pointer-events-none" />

      {/* Top Brand Bar */}
      <header className="w-full px-6 py-5 flex items-center justify-between border-b border-[#27272a]/40 backdrop-blur-md relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/20 ring-1 ring-orange-400/30">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              Tracker
              <span className="text-[10px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20">
                Cloud
              </span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-[#a1a1aa]">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="hidden sm:inline">Secure Isolated Workspace</span>
        </div>
      </header>

      {/* Main Centered Gateway Card */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="w-full max-w-md bg-[#121215]/95 border border-[#27272a] rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-xl"
        >
          {/* Card Icon & Title */}
          <div className="text-center mb-7">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 mb-4 shadow-inner">
              <Layers className="w-7 h-7" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white mb-2">
              Welcome to Tracker
            </h2>
            <p className="text-sm text-[#a1a1aa] leading-relaxed max-w-xs mx-auto">
              Access your projects, kanban boards, timelines, and tasks securely across all your devices.
            </p>
          </div>

          {/* Key Feature Badges */}
          <div className="grid grid-cols-2 gap-2.5 mb-6 text-xs text-[#d4d4d8]">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#18181b] border border-[#27272a]/60">
              <Smartphone className="w-4 h-4 text-orange-400 shrink-0" />
              <span className="truncate">Mobile & Tablet Ready</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#18181b] border border-[#27272a]/60">
              <Laptop className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="truncate">Real-Time Cloud Sync</span>
            </div>
          </div>

          {/* Error Message Alert */}
          {errorMessage && (
            <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2 animate-in fade-in">
              <span className="font-semibold shrink-0">Note:</span>
              <p className="leading-normal">{errorMessage}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            {/* Primary Google Sign-In Button */}
            <button
              id="google-signin-btn"
              onClick={handleGoogleClick}
              disabled={signingIn || isLoading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-white hover:bg-neutral-100 text-neutral-900 font-semibold text-sm transition-all shadow-md hover:shadow-lg active:scale-[0.99] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {signingIn ? (
                <Loader2 className="w-4 h-4 animate-spin text-neutral-700" />
              ) : (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              <span>{signingIn ? 'Connecting to Google...' : 'Sign in with Google'}</span>
            </button>

            {/* Development Mode Bypass Button (Only active in development / preview) */}
            {isDevEnvironment && (
              <div className="pt-3 border-t border-[#27272a]/60">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono text-amber-400/90 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5" />
                    Development Mode
                  </span>
                  <span className="text-[10px] text-[#71717a] font-mono">Auto-excluded on Vercel</span>
                </div>
                <button
                  id="dev-bypass-btn"
                  onClick={onDevBypass}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#18181b] hover:bg-[#202024] border border-[#27272a] hover:border-amber-500/40 text-amber-300 hover:text-amber-200 text-xs font-medium transition-all group cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Continue as Developer (Dev Preview)
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-amber-400 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            )}
          </div>

          {/* Privacy Footnote */}
          <div className="mt-6 pt-4 border-t border-[#27272a]/40 text-center">
            <p className="text-[11px] text-[#71717a] flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              Your data is completely private & isolated to your account.
            </p>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-[#52525b] border-t border-[#27272a]/30">
        Tracker &copy; {new Date().getFullYear()} &middot; Multi-Device Productivity Workspace
      </footer>
    </div>
  );
};
