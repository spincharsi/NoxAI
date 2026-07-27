import { useState } from 'react';
import { X, LogIn, UserPlus, User as UserIcon, Mail, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { NoxaiUser } from '@/types';
import { NOXAI_USER_STORAGE_KEY } from '@/types';

type AuthMode = 'signin' | 'signup';

interface AuthModalProps {
  onClose: () => void;
  onSuccess: (user: NoxaiUser) => void;
  initialMode?: AuthMode;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function loadStoredUsers(): Record<string, { name: string; password: string }> {
  try {
    const raw = localStorage.getItem('noxai_users');
    return raw ? (JSON.parse(raw) as Record<string, { name: string; password: string }>) : {};
  } catch {
    return {};
  }
}

function saveStoredUsers(users: Record<string, { name: string; password: string }>) {
  localStorage.setItem('noxai_users', JSON.stringify(users));
}

export default function AuthModal({ onClose, onSuccess, initialMode = 'signin' }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string; form?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const resetFields = () => {
    setName('');
    setEmail('');
    setPassword('');
    setErrors({});
  };

  const switchMode = (next: AuthMode) => {
    if (next === mode) return;
    setMode(next);
    resetFields();
  };

  const validate = (): boolean => {
    const next: typeof errors = {};

    if (mode === 'signup') {
      if (!name.trim()) {
        next.name = 'Full name is required.';
      } else if (name.trim().length < 2) {
        next.name = 'Please enter your full name (at least 2 characters).';
      }
    }

    if (!email.trim()) {
      next.email = 'Email address is required.';
    } else if (!EMAIL_REGEX.test(email.trim())) {
      next.email = 'Please enter a valid email address (e.g. you@example.com).';
    }

    if (!password) {
      next.password = 'Password is required.';
    } else if (password.length < 6) {
      next.password = 'Password must be at least 6 characters long.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setErrors({});
    if (!validate()) return;

    setSubmitting(true);
    const cleanEmail = email.trim().toLowerCase();
    const users = loadStoredUsers();

    if (mode === 'signup') {
      if (users[cleanEmail]) {
        setSubmitting(false);
        setErrors({ email: 'An account with this email already exists. Please sign in instead.' });
        return;
      }
      users[cleanEmail] = { name: name.trim(), password };
      saveStoredUsers(users);
      const user: NoxaiUser = { name: name.trim(), email: cleanEmail, isLoggedIn: true };
      localStorage.setItem(NOXAI_USER_STORAGE_KEY, JSON.stringify(user));
      setSubmitting(false);
      onSuccess(user);
      return;
    }

    // signin
    const record = users[cleanEmail];
    if (!record) {
      setSubmitting(false);
      setErrors({ form: 'No account found with this email. Please create an account first.' });
      return;
    }
    if (record.password !== password) {
      setSubmitting(false);
      setErrors({ form: 'Incorrect password. Please try again.' });
      return;
    }
    const user: NoxaiUser = { name: record.name, email: cleanEmail, isLoggedIn: true };
    localStorage.setItem(NOXAI_USER_STORAGE_KEY, JSON.stringify(user));
    setSubmitting(false);
    onSuccess(user);
  };

  const fieldClass =
    'w-full bg-zinc-800/80 border rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition';
  const errorFieldBorder = 'border-red-500/60';
  const okFieldBorder = 'border-white/15';

  return (
    <div className="fixed inset-0 z-[80] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-zinc-900 border border-white/15 rounded-[28px] p-6 w-full max-w-sm space-y-5 shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-white/10 pb-3">
          <h3 className="font-bold text-sm uppercase tracking-wider text-white">
            {mode === 'signin' ? 'Sign In to NoxAI' : 'Create Your Account'}
          </h3>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded-full hover:bg-white/10 transition">
            <X className="w-4 h-4 text-zinc-400 hover:text-white" />
          </button>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-1 bg-zinc-800/60 p-1 rounded-2xl border border-white/10">
          <button
            type="button"
            onClick={() => switchMode('signin')}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
              mode === 'signin' ? 'bg-white text-black shadow-lg' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" /> Sign In
          </button>
          <button
            type="button"
            onClick={() => switchMode('signup')}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
              mode === 'signup' ? 'bg-white text-black shadow-lg' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" /> Sign Up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {mode === 'signup' && (
            <div>
              <label className="text-xs font-semibold text-zinc-400 block mb-1.5">Full Name</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Abdul Ali"
                  autoFocus={mode === 'signup'}
                  className={`${fieldClass} ${errors.name ? errorFieldBorder : okFieldBorder}`}
                />
              </div>
              {errors.name && (
                <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errors.name}
                </p>
              )}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-zinc-400 block mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoFocus={mode === 'signin'}
                autoComplete="email"
                className={`${fieldClass} ${errors.email ? errorFieldBorder : okFieldBorder}`}
              />
            </div>
            {errors.email && (
              <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.email}
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-400 block mb-1.5">
              Password <span className="text-zinc-600 normal-case font-normal">(min 6 characters)</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'Create a password' : 'Enter your password'}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                className={`${fieldClass} ${errors.password ? errorFieldBorder : okFieldBorder}`}
              />
            </div>
            {errors.password && (
              <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.password}
              </p>
            )}
          </div>

          {errors.form && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-[12px] text-red-300">{errors.form}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-white text-black font-bold py-3.5 rounded-xl text-xs uppercase tracking-wider hover:bg-zinc-200 transition flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg"
          >
            {submitting ? (
              'Please wait...'
            ) : (
              <>
                {mode === 'signin' ? <LogIn className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                {mode === 'signin' ? 'Sign In & Continue' : 'Create Account & Continue'}
              </>
            )}
          </button>

          <p className="text-center text-[11px] text-zinc-500">
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
              className="text-blue-400 font-bold hover:underline underline-offset-2"
            >
              {mode === 'signin' ? 'Sign up here' : 'Sign in here'}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
