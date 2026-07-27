import { useEffect, useRef, useState } from 'react';
import {
  Home,
  ScanSearch,
  History,
  User,
  Camera,
  Upload,
  CheckCircle,
  Loader2,
  X,
  AlertTriangle,
  Bell,
  Lightbulb,
  ChevronRight,
  ArrowDownRight,
  Zap,
  Layers,
  CheckCircle2,
  ShieldCheck,
  UserCheck,
  LogOut,
  Calendar,
  TrendingDown,
  Sparkles,
  Globe,
  LogIn,
  Shield,
  Pill,
  FileText,
  Clock,
  Mail,
  RotateCcw,
  Plus,
  Trash2,
} from 'lucide-react';
import NorixAIHeader from './components/NorixAIHeader';
import AuthModal from './components/AuthModal';
import { scanPrescription } from './lib/gemini';
import { useCamera } from './lib/useCamera';
import type { NoxaiUser, PrescriptionScanResult } from './types';
import { NOXAI_USER_STORAGE_KEY } from './types';

type TabId = 'home' | 'scan' | 'history' | 'profile';
type ModalId = 'none' | 'calendar' | 'notif' | 'tips' | 'auth';
type Language = 'en' | 'ur';

interface Medicine {
  original: string;
  formula: string;
  origPrice: string;
  altPrice: string;
  alternative: string;
  savings: string;
  purposeEn?: string;
  purposeUr?: string;
  dosageEn?: string;
  dosageUr?: string;
}

interface ScanRecord {
  id: string;
  disease: string;
  diseaseUr?: string;
  medicines: Medicine[];
  scannedAt: string;
  source: 'upload' | 'camera';
}

interface PillReminder {
  id: string;
  medicineName: string;
  time: string;
  dayKey: string;
}

function toRecord(result: PrescriptionScanResult, source: 'upload' | 'camera'): ScanRecord {
  return {
    id: `${Date.now()}`,
    disease: result.diseaseEn,
    diseaseUr: result.diseaseUr,
    scannedAt: result.scanned_at,
    source,
    medicines: result.medications.map((m) => ({
      original: m.originalBrand,
      formula: m.altMed,
      origPrice: `PKR ${m.originalPrice}`,
      altPrice: `PKR ${m.altPrice}`,
      alternative: m.altMed,
      savings: `Save PKR ${m.originalPrice - m.altPrice} (${m.savings}%)`,
      purposeEn: m.purposeEn,
      purposeUr: m.purposeUr,
      dosageEn: m.dosageEn,
      dosageUr: m.dosageUr,
    })),
  };
}

function buildWeekSchedule() {
  const today = new Date();
  const dayOfWeek = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - dayOfWeek);
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return labels.map((day, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { day, date: d.getDate(), active: d.toDateString() === today.toDateString() };
  });
}

const featureBadges = [
  { icon: Zap, title: 'Active Salt Detection', desc: 'Exact Formula Match' },
  { icon: Layers, title: 'Cheaper Alternatives', desc: 'Lowest-priced local equivalents' },
  { icon: CheckCircle2, title: 'Instant Dosage Verification', desc: 'Verified safety limits & guidelines' },
];

const tipsContent = [
  { id: 1, title: 'Active Salt Identification', desc: 'Always check the API (Active Pharmaceutical Ingredient) name on your prescription to find safe, cheaper generic alternatives.' },
  { id: 2, title: 'Storage Conditions', desc: 'Store antibiotics and sensitive medications between 2°C - 8°C to maintain full potency.' },
  { id: 3, title: 'Generic Price Comparison', desc: 'Certified local generic medicine equivalents can save you between 50% to 70% on standard retail prices.' },
  { id: 4, title: 'Dosage Regularity', desc: 'Never skip or leave an antibiotic course incomplete, as it can cause bacterial resistance.' },
  { id: 5, title: 'Expiry & Seal Verification', desc: 'Always inspect the printed expiration date and security strip seal before consuming generic salt medication.' },
  { id: 6, title: 'Hydration Guidelines', desc: 'Maintain adequate water intake during active antibiotic courses to optimize drug absorption.' },
  { id: 7, title: 'Consultation Standards', desc: 'Verify salt equivalence with a certified pharmacist when switching from innovator brands.' },
];

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function App() {
  const [isGuest, setIsGuest] = useState<boolean>(
    () => typeof window !== 'undefined' && localStorage.getItem('noxai_guest_mode') === 'true'
  );
  const [currentScreen, setCurrentScreen] = useState<'welcome' | 'app' | 'privacy'>(() => {
    if (typeof window === 'undefined') return 'welcome';
    if (localStorage.getItem('noxai_guest_mode') === 'true') return 'app';
    try {
      const raw = localStorage.getItem(NOXAI_USER_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as NoxaiUser;
        if (parsed && parsed.isLoggedIn && parsed.name && parsed.email) return 'app';
      }
    } catch {
      // ignore malformed storage
    }
    return 'welcome';
  });
  const [privacyReturnTo, setPrivacyReturnTo] = useState<'welcome' | 'app'>('welcome');
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (typeof window === 'undefined') return 'home';
    const hash = window.location.hash.replace('#', '');
    const stored = localStorage.getItem('noxai_active_tab');
    const candidate = (hash || stored || 'home') as TabId;
    const valid: TabId[] = ['home', 'scan', 'history', 'profile'];
    return valid.includes(candidate) ? candidate : 'home';
  });
  const [loading, setLoading] = useState(false);
  const [currentScan, setCurrentScan] = useState<ScanRecord | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [history, setHistory] = useState<ScanRecord[]>([]);
  const [activeModal, setActiveModal] = useState<ModalId>('none');
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [user, setUser] = useState<NoxaiUser | null>(null);
  const [authInitialMode, setAuthInitialMode] = useState<'signin' | 'signup'>('signin');
  const [language, setLanguage] = useState<Language>('en');
  const [selectedDay, setSelectedDay] = useState<{ short: string; date: number }>(() => {
    const today = new Date();
    return { short: months[today.getMonth()], date: today.getDate() };
  });
  const [reminders, setReminders] = useState<PillReminder[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem('noxai_reminders');
      return raw ? (JSON.parse(raw) as PillReminder[]) : [];
    } catch {
      return [];
    }
  });
  const [newReminderName, setNewReminderName] = useState('');
  const [newReminderTime, setNewReminderTime] = useState('');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickerHour, setPickerHour] = useState(8);
  const [pickerMinute, setPickerMinute] = useState(0);
  const [pickerPeriod, setPickerPeriod] = useState<'AM' | 'PM'>('AM');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scanningRef = useRef(false);

  const camera = useCamera();

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(NOXAI_USER_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as NoxaiUser;
        if (parsed && parsed.isLoggedIn && parsed.name && parsed.email) {
          setUser(parsed);
        }
      }
    } catch {
      // ignore malformed storage
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('noxai_reminders', JSON.stringify(reminders));
  }, [reminders]);

  const isLoggedIn = user !== null;
  const userName = user?.name ?? 'Guest User';
  const userEmail = user?.email ?? '';

  const openAuth = (mode: 'signin' | 'signup') => {
    setAuthInitialMode(mode);
    setActiveModal('auth');
  };

  const handleAuthSuccess = (nextUser: NoxaiUser) => {
    setUser(nextUser);
    setIsGuest(false);
    setActiveModal('none');
    setActiveTab('home');
    localStorage.setItem('noxai_active_tab', 'home');
    window.location.hash = 'home';
    setCurrentScreen('app');
  };

  const handleLogout = () => {
    localStorage.removeItem(NOXAI_USER_STORAGE_KEY);
    localStorage.removeItem('noxai_guest_mode');
    setIsGuest(false);
    setUser(null);
    if (window.location.hash) window.location.hash = '';
    setCurrentScreen('welcome');
  };

  // Reusable tab navigation: syncs state, localStorage, and URL hash
  const navigateTo = (tab: TabId) => {
    setActiveTab(tab);
    localStorage.setItem('noxai_active_tab', tab);
    window.location.hash = tab;
  };

  const handleContinueAsGuest = () => {
    localStorage.setItem('noxai_guest_mode', 'true');
    setIsGuest(true);
    setActiveTab('home');
    localStorage.setItem('noxai_active_tab', 'home');
    window.location.hash = 'home';
    setCurrentScreen('app');
  };

  const exitToWelcome = () => {
    localStorage.removeItem('noxai_guest_mode');
    setIsGuest(false);
    if (window.location.hash) window.location.hash = '';
    setCurrentScreen('welcome');
  };

  // Keep active tab in sync with browser back/forward buttons
  useEffect(() => {
    const validTabs: TabId[] = ['home', 'scan', 'history', 'profile'];
    const syncFromHash = () => {
      const raw = window.location.hash.replace('#', '');
      if (validTabs.includes(raw as TabId)) {
        setActiveTab(raw as TabId);
        localStorage.setItem('noxai_active_tab', raw as TabId);
      } else if (raw === '' || raw === 'welcome') {
        // Empty hash: keep guests inside the app on Home instead of exiting
        if (localStorage.getItem('noxai_guest_mode') === 'true') {
          setActiveTab('home');
          localStorage.setItem('noxai_active_tab', 'home');
          window.location.hash = 'home';
        } else {
          setCurrentScreen('welcome');
        }
      }
    };
    window.addEventListener('hashchange', syncFromHash);
    window.addEventListener('popstate', syncFromHash);
    return () => {
      window.removeEventListener('hashchange', syncFromHash);
      window.removeEventListener('popstate', syncFromHash);
    };
  }, []);

  useEffect(() => {
    if (showCameraModal) {
      camera.start();
    } else {
      camera.stop();
    }
  }, [showCameraModal]);

  const runScan = async (file: File | null, source: 'upload' | 'camera') => {
    if (scanningRef.current) return;
    scanningRef.current = true;
    setLoading(true);
    setCurrentScan(null);
    setScanError(null);
    try {
      const result = await scanPrescription(file);
      const record = toRecord(result, source);
      setCurrentScan(record);
      setHistory((h) => [record, ...h].slice(0, 20));
      navigateTo('scan');
    } catch (err) {
      setCurrentScan(null);
      setScanError(err instanceof Error ? err.message : 'Scan failed. Please try again.');
      navigateTo('scan');
    } finally {
      setLoading(false);
      scanningRef.current = false;
    }
  };

  const resetScan = () => {
    setCurrentScan(null);
    setScanError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addReminder = () => {
    const name = newReminderName.trim();
    if (!name || !newReminderTime) {
      openTimePicker();
      return;
    }
    const key = `${selectedDay.short} ${selectedDay.date}`;
    setReminders((prev) => [...prev, { id: `${Date.now()}`, medicineName: name, time: newReminderTime, dayKey: key }]);
    setNewReminderName('');
    setNewReminderTime('');
    setShowTimePicker(false);
  };

  const openTimePicker = () => {
    const m = newReminderTime.match(/(\d{2}):(\d{2})\s*(AM|PM)/i);
    if (m) {
      setPickerHour(Number(m[1]));
      setPickerMinute(Number(m[2]));
      setPickerPeriod(m[3].toUpperCase() as 'AM' | 'PM');
    }
    setShowTimePicker(true);
  };

  const confirmTime = () => {
    const hh = String(pickerHour).padStart(2, '0');
    const mm = String(pickerMinute).padStart(2, '0');
    setNewReminderTime(`${hh}:${mm} ${pickerPeriod}`);
    setShowTimePicker(false);
  };

  const removeReminder = (id: string) => {
    setReminders((prev) => prev.filter((r) => r.id !== id));
  };

  const handleUploadClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFile = (file: File | undefined) => {
    if (file) runScan(file, 'upload');
  };

  const openCameraModal = () => setShowCameraModal(true);
  const closeCameraModal = () => setShowCameraModal(false);

  const handleCameraCapture = async () => {
    const file = await camera.capture();
    if (file) {
      closeCameraModal();
      await runScan(file, 'camera');
    }
  };

  const navItems: { name: TabId; label: string; icon: typeof Home }[] = [
    { name: 'home', label: 'Home', icon: Home },
    { name: 'scan', label: 'Scan', icon: ScanSearch },
    { name: 'history', label: 'History', icon: History },
    { name: 'profile', label: 'Profile', icon: User },
  ];

  const weekSchedule = buildWeekSchedule();
  const dayKey = `${selectedDay.short} ${selectedDay.date}`;
  const dayReminders = reminders.filter((r) => r.dayKey === dayKey);
  const monthLabel = new Date().toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
  const now = new Date();
  const currentMonthShort = now.toLocaleDateString('en-US', { month: 'short' });
  const currentMonthFull = now.toLocaleDateString('en-US', { month: 'long' });
  const currentYear = now.getFullYear();
  const currentMonthIndex = now.getMonth();
  const daysInCurrentMonth = new Date(currentYear, currentMonthIndex + 1, 0).getDate();
  const nextMonthDate = new Date(currentYear, currentMonthIndex + 1, 1);
  const nextMonthShort = nextMonthDate.toLocaleDateString('en-US', { month: 'short' });
  const nextMonthFull = nextMonthDate.toLocaleDateString('en-US', { month: 'long' });
  const nextMonthYear = nextMonthDate.getFullYear();
  const daysInNextMonth = new Date(nextMonthYear, nextMonthDate.getMonth() + 1, 0).getDate();
  const currentMonthStartDay = new Date(currentYear, currentMonthIndex, 1).getDay();
  const currentMonthOffset = currentMonthStartDay === 0 ? 6 : currentMonthStartDay - 1;
  const nextMonthStartDay = new Date(nextMonthYear, nextMonthDate.getMonth(), 1).getDay();
  const nextMonthOffset = nextMonthStartDay === 0 ? 6 : nextMonthStartDay - 1;

  const closeModal = () => setActiveModal('none');

  if (currentScreen === 'welcome') {
    return (
      <div className="flex flex-col items-center justify-between min-h-[100dvh] w-full bg-black text-white px-4 py-6 relative font-sans selection:bg-zinc-700 selection:text-white overflow-hidden">
        <div className="flex flex-col items-center justify-center mx-auto text-center max-w-sm w-full my-auto">
          <div className="mb-6 flex flex-col items-start gap-1.5 w-14 mx-auto">
            <div className="w-full h-1.5 bg-white rounded-full"></div>
            <div className="w-3/4 h-1.5 bg-zinc-400 rounded-full"></div>
            <div className="w-1/2 h-1.5 bg-zinc-600 rounded-full"></div>
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">Welcome to NoxAI</h1>
          <p className="text-xs text-zinc-400 mb-8">
            AI-Powered Medicine Salt Analysis &amp; Smart Savings Platform
          </p>

          <button
            onClick={handleContinueAsGuest}
            className="w-full py-3.5 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs tracking-wider uppercase rounded-2xl border border-zinc-700 transition-all mb-3"
          >
            Continue as Guest
          </button>
          <button
            onClick={() => openAuth('signin')}
            className="w-full py-3.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-semibold text-xs tracking-wider uppercase rounded-2xl border border-zinc-800 transition-all"
          >
            Log In
          </button>
        </div>

        {/* Footer: anchored to bottom edge */}
        <div className="absolute bottom-6 left-0 right-0 text-center text-xs text-zinc-400 max-w-sm mx-auto px-4 z-10 space-y-2">
          <p className="text-zinc-400">
            Don't have an account?{' '}
            <button
              type="button"
              onClick={() => openAuth('signup')}
              className="text-white font-bold underline underline-offset-4 hover:text-blue-400 transition md:text-sm"
            >
              Register Now
            </button>
          </p>
          <p className="text-zinc-500">
            By continuing, you agree to our{' '}
            <button
              type="button"
              onClick={() => { setPrivacyReturnTo('welcome'); setCurrentScreen('privacy'); }}
              className="text-zinc-300 underline hover:text-white md:text-sm"
            >
              Privacy Policy
            </button>{' '}
            &amp; Terms
          </p>
        </div>

        {activeModal === 'auth' && (
          <AuthModal
            initialMode={authInitialMode}
            onClose={() => setActiveModal('none')}
            onSuccess={handleAuthSuccess}
          />
        )}
      </div>
    );
  }

  if (currentScreen === 'privacy') {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_center,_#27272a_0%,_#09090b_65%,_#000000_100%)] text-white p-6 md:p-12 font-sans overflow-y-auto">
        <div className="max-w-2xl mx-auto space-y-6 pt-4 pb-12">
          <div className="flex justify-between items-center border-b border-white/10 pb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/10 rounded-xl border border-white/15">
                <Shield className="w-5 h-5 text-blue-400" />
              </div>
              <h1 className="text-xl font-bold uppercase tracking-wider">NoxAI Privacy Policy</h1>
            </div>
            <button
              onClick={() => setCurrentScreen(privacyReturnTo)}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold uppercase tracking-wider transition border border-white/15"
            >
              Back
            </button>
          </div>

          <div className="bg-white/[0.04] border border-white/10 rounded-[28px] p-6 md:p-8 space-y-6 backdrop-blur-xl text-xs md:text-sm text-zinc-300 leading-relaxed">
            <div className="space-y-2">
              <h2 className="text-white font-bold text-base">1. Introduction &amp; Data Commitment</h2>
              <p>Welcome to NoxAI. We respect your privacy and are committed to protecting your medical prescription scans, personal health data, and salt search queries.</p>
            </div>
            <div className="space-y-2">
              <h2 className="text-white font-bold text-base">2. Prescription Scans &amp; OCR Data</h2>
              <p>When you upload prescription images, our AI engine processes active chemical salts to find cheaper local generic alternatives. Your data is secure and never shared.</p>
            </div>
            <div className="space-y-2">
              <h2 className="text-white font-bold text-base">3. Local Storage &amp; Security</h2>
              <p>If you use NoxAI in Guest Mode, your data remains locally managed. Signed-in accounts maintain scan history continuity safely.</p>
            </div>
            <div className="pt-4 border-t border-white/10 text-xs text-zinc-500">
              Last Updated: July 2026 • NoxAI Security Standard v2.5
            </div>
          </div>

          <button
            onClick={() => setCurrentScreen(privacyReturnTo)}
            className="w-full py-4 bg-white/10 hover:bg-white/20 border border-white/15 rounded-2xl text-xs font-bold uppercase tracking-widest transition"
          >
            Accept &amp; {privacyReturnTo === 'app' ? 'Return to Dashboard' : 'Return to Welcome Screen'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen md:h-screen bg-[radial-gradient(circle_at_center,_#27272a_0%,_#09090b_65%,_#000000_100%)] text-white flex flex-col md:flex-row font-sans selection:bg-zinc-700 selection:text-white relative overflow-x-hidden md:overflow-hidden">

      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:justify-between p-6 border-r border-white/10 bg-white/[0.03] backdrop-blur-3xl shrink-0">
        <div className="space-y-8">
          <div className="flex items-center space-x-3">
            <div className="flex flex-col items-start gap-1 w-6 cursor-pointer flex-shrink-0">
              <div className="w-full h-0.5 bg-white rounded-full"></div>
              <div className="w-3/4 h-0.5 bg-zinc-400 rounded-full"></div>
              <div className="w-1/2 h-0.5 bg-zinc-600 rounded-full"></div>
            </div>
            <span className="text-xl font-bold tracking-wide text-white">NoxAI</span>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.name;
              return (
                <button
                  key={item.name}
                  onClick={() => navigateTo(item.name)}
                  className={`w-full flex items-center space-x-3.5 px-4 py-3 rounded-2xl transition-all duration-200 ${
                    isActive
                      ? 'bg-white/15 text-white font-bold border border-white/20 shadow-lg'
                      : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm tracking-wide">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="pt-4 border-t border-white/10 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigateTo('profile')}
            className="flex items-center space-x-3 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-full bg-zinc-800 border border-white/20 flex items-center justify-center group-hover:border-white transition">
              <User className="w-4 h-4 text-zinc-300" />
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-white truncate max-w-[100px]">{userName}</p>
              {isLoggedIn && userEmail && (
                <span className="text-[9px] text-zinc-500 truncate max-w-[100px] block">{userEmail}</span>
              )}
              <span className="text-[9px] text-zinc-500 uppercase">{isLoggedIn ? 'Verified User' : 'Guest Mode'}</span>
            </div>
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveModal('notif')}
              className="p-2 rounded-full hover:bg-white/10 text-zinc-400 transition"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
            </button>
            <button
              onClick={exitToWelcome}
              className="p-2 rounded-full hover:bg-white/10 text-zinc-400 transition"
              aria-label="Exit to welcome screen"
              title="Exit"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* MOBILE HEADER */}
      <div className="md:hidden">
        <NorixAIHeader onBellClick={() => setActiveModal('notif')} />
      </div>

      {/* MAIN CONTENT */}
      <main className="flex-1 w-full px-4 sm:px-6 mx-auto flex flex-col overflow-y-auto pb-32 pt-3 md:pt-5">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        {/* HOME TAB */}
        {activeTab === 'home' && (
          <div className="gap-3 md:gap-5 animate-fadeIn flex flex-col">

            {/* Hero Section */}
            <button
              onClick={() => navigateTo('scan')}
              className="text-left w-full mb-2 cursor-pointer group"
            >
              <div className="flex flex-col items-start gap-2 text-left w-full mb-2">
                <p className="text-[10px] md:text-xs font-bold tracking-wider text-zinc-400 uppercase">
                  SMART MEDICINE SAVINGS ASSISTANT
                </p>
                <div className="flex items-end justify-between gap-4 w-full">
                  <h2 className="block md:hidden text-2xl font-bold text-white max-w-md leading-tight group-hover:text-blue-50 transition-colors">
                    <span className="bg-gradient-to-r from-white via-slate-200 to-gray-400 bg-clip-text text-transparent font-black drop-shadow-[0_2px_10px_rgba(255,255,255,0.2)]">AI</span>-Powered<br />
                    Medicine Salt<br />
                    Comparison Assistant
                  </h2>
                  <h2 className="hidden md:flex md:flex-col md:gap-1.5 leading-tight group-hover:text-blue-50 transition-colors">
                    <span className="text-xl md:text-3xl font-bold text-zinc-200 tracking-tight">
                      <span className="bg-gradient-to-r from-white via-slate-200 to-gray-400 bg-clip-text text-transparent font-black drop-shadow-[0_2px_10px_rgba(255,255,255,0.2)]">AI</span>-Powered Medicine
                    </span>
                    <span className="text-2xl md:text-4xl font-bold text-white tracking-tight">
                      Salt Comparison Assistant
                    </span>
                  </h2>
                  <ArrowDownRight className="w-6 h-6 text-white flex-shrink-0 mb-1 group-hover:text-blue-400 group-hover:translate-y-1 transition-all" />
                </div>
              </div>
              <div className="w-full h-0.5 bg-zinc-800 rounded-full my-2 overflow-hidden">
                <div className="w-1/2 h-full bg-white rounded-full group-hover:w-3/4 transition-all duration-500"></div>
              </div>
              <div className="flex items-center justify-between text-xs font-bold text-white tracking-wider uppercase pt-0.5 group-hover:text-blue-100 transition-colors">
                <span>VIEW MORE</span>
                <ChevronRight className="w-4 h-4 text-white group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            {/* Top Row: 3 Main Cards with High Roundness */}
            <div className="w-full flex flex-col md:grid md:grid-cols-3 gap-4 md:gap-6 md:items-stretch">

              {/* Card 1: AI Scan Prescription (Mobile: 3rd | Desktop: 1st) */}
              <div className="w-full h-auto md:h-full flex flex-col justify-between bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-4 md:p-8 shadow-xl order-3 md:order-1 md:col-start-1 md:row-start-1">
                <div className="flex flex-col flex-1">
                  <div className="flex items-center justify-between mb-2 md:mb-4">
                    <h2 className="text-xs font-bold tracking-wider text-white uppercase">
                      AI Scan Prescription
                    </h2>
                    <span className="text-[10px] font-semibold bg-zinc-800 text-zinc-300 px-2.5 py-0.5 rounded-full border border-zinc-700">
                      AI OCR V2
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-1 gap-3 md:gap-4 my-2 md:my-3 md:flex-1 relative">
                    <button
                      onClick={openCameraModal}
                      disabled={loading}
                      className="flex flex-col items-center justify-center py-5 md:py-8 px-3 bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/60 hover:border-white/30 rounded-2xl shadow-inner hover:shadow-[0_0_15px_rgba(255,255,255,0.08)] transition-all duration-300 group disabled:opacity-50 disabled:cursor-not-allowed md:flex-1 md:min-h-[120px]"
                    >
                      <Camera className="w-7 h-7 md:w-10 md:h-10 text-zinc-200 mb-1.5 md:mb-2 group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] md:text-xs font-bold tracking-wider text-zinc-200 uppercase">
                        Capture
                      </span>
                    </button>
                    <button
                      onClick={handleUploadClick}
                      disabled={loading}
                      className="flex flex-col items-center justify-center py-5 md:py-8 px-3 bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/60 hover:border-white/30 rounded-2xl shadow-inner hover:shadow-[0_0_15px_rgba(255,255,255,0.08)] transition-all duration-300 group disabled:opacity-50 disabled:cursor-not-allowed md:flex-1 md:min-h-[120px]"
                    >
                      <Upload className="w-7 h-7 md:w-10 md:h-10 text-zinc-200 mb-1.5 md:mb-2 group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] md:text-xs font-bold tracking-wider text-zinc-200 uppercase">
                        Upload File
                      </span>
                    </button>
                    {loading && (
                      <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center col-span-2 md:col-span-1">
                        <span className="text-xs font-semibold text-white bg-white/10 px-3 py-1.5 rounded-md flex items-center gap-1.5 border border-white/20">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing...
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 pt-2.5 border-t border-white/20 mt-2 md:mt-3 md:pt-3 md:space-y-2">
                  {featureBadges.map((f) => {
                    const Icon = f.icon;
                    return (
                      <div key={f.title} className="flex items-center gap-1.5 text-[11px] md:text-xs text-zinc-400">
                        <Icon className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
                        <span className="truncate">
                          <strong className="text-zinc-200">{f.title}:</strong> {f.desc}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Card 3: Smart Health Tips (Mobile: 2nd | Desktop: 3rd) */}
              <button
                onClick={() => setActiveModal('tips')}
                className="text-left w-full h-auto md:h-full flex flex-col justify-between bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-4 md:p-8 shadow-xl cursor-pointer md:cursor-default hover:border-zinc-700 transition order-2 md:order-3 md:col-start-3 md:row-start-1"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div>
                        <h2 className="text-xs font-bold tracking-wider text-zinc-200 uppercase">
                          Smart Health Tips
                        </h2>
                        <p className="lg:hidden text-[10px] md:text-[11px] text-zinc-400">
                          Save up to 70% on local generic salts
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-zinc-500 shrink-0" />
                  </div>

                  <div className="hidden md:block space-y-2.5 my-5 text-xs">
                    {tipsContent.slice(0, 5).map((tip) => (
                      <div key={tip.id} className="bg-white/5 border border-white/10 rounded-xl p-3.5 mb-2.5 transition-all hover:bg-white/[0.07]">
                        <p className="font-semibold text-zinc-200 text-[11px] mb-0.5">{tip.id}. {tip.title}</p>
                        <p className="text-[10px] text-zinc-400 leading-normal">{tip.desc}</p>
                      </div>
                    ))}
                    <div className="hidden lg:block bg-white/5 border border-white/10 rounded-xl p-3.5 mb-2.5 transition-all hover:bg-white/[0.07]">
                      <p className="font-semibold text-zinc-200 text-[11px] mb-0.5">6. Doctor Consultation</p>
                      <p className="text-[10px] text-zinc-400 leading-normal">Always verify dosage changes with a healthcare professional.</p>
                    </div>
                  </div>
                </div>

                <div className="hidden md:flex pt-3 border-t border-white/20 items-center justify-between text-[11px] text-zinc-400 mt-3">
                  <span>Storage &amp; dosage guidelines</span>
                  <ShieldCheck className="w-4 h-4 text-white hidden md:block" />
                </div>
              </button>

              {/* Card 2: Weekly Dosage Reminder (Mobile: 1st | Desktop: 2nd) */}
              <div className="w-full h-auto md:h-full flex flex-col justify-between bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-4 md:p-8 shadow-xl order-1 md:order-2 md:col-start-2 md:row-start-1 relative z-20">
                <div>
                  <div className="flex items-center justify-between mb-3 md:mb-4">
                    <h2 className="text-xs font-semibold tracking-wider text-white uppercase">
                      Weekly Dosage Reminder
                    </h2>
                    <button
                      onClick={() => setActiveModal('calendar')}
                      className="flex items-center gap-1.5 text-[11px] font-medium bg-zinc-800 text-zinc-300 px-3 py-1 rounded-full border border-zinc-700 cursor-pointer"
                    >
                      <Calendar className="w-3 h-3" />
                      <span className="md:hidden">{monthLabel}</span>
                      <span className="hidden md:inline">{currentMonthFull} {currentYear}</span>
                    </button>
                  </div>

                  {/* MOBILE: compact 7-day pill strip */}
                  <div className="grid md:hidden grid-cols-7 gap-1.5 my-2 text-center">
                    {weekSchedule.map((item, index) => {
                      const isSelected = selectedDay.short === currentMonthShort && selectedDay.date === item.date;
                      return (
                        <button
                          key={index}
                          onClick={() => setSelectedDay({ short: currentMonthShort, date: item.date })}
                          className={`flex flex-col items-center justify-center py-2.5 rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-zinc-100 text-zinc-950 border-white font-bold shadow-md scale-105'
                              : 'bg-white/5 hover:bg-white/10 border border-white/5 text-white font-medium hover:border-white/20'
                          }`}
                        >
                          <span className={`text-[8px] uppercase tracking-wider ${isSelected ? 'text-zinc-600' : 'text-zinc-400'}`}>{item.day}</span>
                          <span className={`text-[11px] font-semibold ${isSelected ? 'text-zinc-950' : 'text-white'}`}>{item.date}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* DESKTOP: 2-month calendar */}
                  <div className="hidden md:block space-y-4 my-3 text-[11px]">
                    <div>
                      <div className="grid grid-cols-7 text-center font-bold text-zinc-500 mb-1.5 uppercase tracking-wider text-[10px]">
                        <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                      </div>
                      <div className="grid grid-cols-7 gap-1 text-center font-medium text-zinc-300">
                        {[...Array(currentMonthOffset)].map((_, i) => (
                          <div key={`pad-cur-${i}`} className="py-1.5"></div>
                        ))}
                        {[...Array(daysInCurrentMonth)].map((_, i) => {
                          const day = i + 1;
                          const isSelected = selectedDay.short === currentMonthShort && selectedDay.date === day;
                          return (
                            <button
                              key={`desk-cur-${day}`}
                              onClick={() => setSelectedDay({ short: currentMonthShort, date: day })}
                              className={`py-1.5 rounded-xl border transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-zinc-100 text-zinc-950 font-bold border-white shadow-md scale-110'
                                  : 'bg-white/5 hover:bg-white/10 border border-white/5 text-white font-medium hover:border-white/20'
                              }`}
                            >
                              {day}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-white/20">
                      <p className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase mb-1.5">{nextMonthShort} {nextMonthYear}</p>
                      <div className="grid grid-cols-7 gap-1 text-center font-medium text-zinc-500">
                        {[...Array(nextMonthOffset)].map((_, i) => (
                          <div key={`pad-nxt-${i}`} className="py-1.5"></div>
                        ))}
                        {[...Array(daysInNextMonth)].map((_, i) => {
                          const day = i + 1;
                          const isSelected = selectedDay.short === nextMonthShort && selectedDay.date === day;
                          return (
                            <button
                              key={`desk-nxt-${day}`}
                              onClick={() => setSelectedDay({ short: nextMonthShort, date: day })}
                              className={`py-1.5 rounded-xl border transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-zinc-100 text-zinc-950 font-bold border-white shadow-md scale-110'
                                  : 'bg-white/5 hover:bg-white/10 border border-white/5 text-white font-medium hover:border-white/20'
                              }`}
                            >
                              {day}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* PILL REMINDER & DOSAGE TRACKER */}
                <div className="mt-3 pt-3 border-t border-white/20 space-y-2">
                  <p className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider">Pill Reminder &amp; Dosage Tracker</p>
                  <div className="relative z-50 overflow-visible flex gap-1.5">
                    <input
                      type="text"
                      value={newReminderName}
                      onChange={(e) => setNewReminderName(e.target.value)}
                      placeholder="Medicine name"
                      className="flex-1 min-w-0 bg-zinc-800/60 border border-zinc-700/60 rounded-xl px-2.5 py-1.5 text-[11px] text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
                    />
                    <div className="shrink-0">
                      <button
                        type="button"
                        onClick={openTimePicker}
                        className="bg-white/10 hover:bg-white/15 border border-white/15 rounded-xl px-3 py-2 flex items-center gap-2 text-white"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-medium">{newReminderTime || 'Set time'}</span>
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={addReminder}
                      className="shrink-0 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 hover:border-white/30 rounded-xl p-1.5 transition-all duration-300"
                      aria-label="Add reminder"
                    >
                      <Plus className="w-3.5 h-3.5 text-zinc-200" />
                    </button>
                    {showTimePicker && (
                      <>
                        <div
                          className="fixed inset-0 z-[99]"
                          onClick={() => setShowTimePicker(false)}
                        />
                        <div className="absolute top-full left-0 w-full max-w-[280px] mt-2 z-[9999] bg-[#181b25] backdrop-blur-2xl border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.95)] rounded-2xl p-4 text-white">
                          <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                            <span className="text-sm font-semibold text-gray-300">Set Reminder Time</span>
                            <button
                              type="button"
                              onClick={() => setShowTimePicker(false)}
                              className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded bg-white/5 transition"
                              aria-label="Close time picker"
                            >
                              ✕
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-2 mb-3">
                            <select
                              value={pickerHour}
                              onChange={(e) => setPickerHour(Number(e.target.value))}
                              className="appearance-none bg-white/5 border border-white/10 rounded-xl p-3 text-lg font-bold text-white hover:bg-white/10 transition-all focus:outline-none focus:ring-0 text-center cursor-pointer"
                            >
                              {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                                <option key={h} value={h} className="bg-[#181b25]">{String(h).padStart(2, '0')}</option>
                              ))}
                            </select>
                            <select
                              value={pickerMinute}
                              onChange={(e) => setPickerMinute(Number(e.target.value))}
                              className="appearance-none bg-white/5 border border-white/10 rounded-xl p-3 text-lg font-bold text-white hover:bg-white/10 transition-all focus:outline-none focus:ring-0 text-center cursor-pointer"
                            >
                              {[0, 15, 30, 45].map((mm) => (
                                <option key={mm} value={mm} className="bg-[#181b25]">{String(mm).padStart(2, '0')}</option>
                              ))}
                            </select>
                            <select
                              value={pickerPeriod}
                              onChange={(e) => setPickerPeriod(e.target.value as 'AM' | 'PM')}
                              className="appearance-none bg-white/5 border border-white/10 rounded-xl p-3 text-lg font-bold text-white hover:bg-white/10 transition-all focus:outline-none focus:ring-0 text-center cursor-pointer"
                            >
                              <option value="AM" className="bg-[#181b25]">AM</option>
                              <option value="PM" className="bg-[#181b25]">PM</option>
                            </select>
                          </div>
                          <button
                            type="button"
                            onClick={confirmTime}
                            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-lg transition-all text-center mt-3"
                          >
                            DONE
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  {dayReminders.length > 0 ? (
                    <div className="space-y-1">
                      {dayReminders.map((r) => (
                        <div key={r.id} className="flex items-center justify-between bg-zinc-800/40 border border-zinc-800/80 rounded-lg px-2.5 py-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Clock className="w-3 h-3 text-zinc-400 shrink-0" />
                            <span className="text-[11px] text-zinc-200 truncate">{r.medicineName}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-zinc-400 font-medium">{r.time}</span>
                            <button type="button" onClick={() => removeReminder(r.id)} className="text-zinc-500 hover:text-red-400 transition" aria-label="Delete reminder">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="hidden lg:block text-[10px] text-zinc-500">No reminders for {selectedDay.short} {selectedDay.date}. Add one above.</p>
                  )}
                </div>

                <div className="hidden md:flex pt-3 border-t border-white/20 items-center justify-between text-[11px] mt-3">
                  <span className="text-zinc-400">Selected: <strong className="text-zinc-200">{selectedDay.short} {selectedDay.date}, {currentYear}</strong></span>
                  <span className="text-white font-medium">{dayReminders.length} Reminder{dayReminders.length !== 1 ? 's' : ''}</span>
                </div>
              </div>

            </div>

            {/* Bottom Row: 3 Mini Cards (Desktop only) */}
            <div className="hidden md:grid md:grid-cols-3 gap-6 mt-1">

              <div className="w-full flex items-center gap-4 bg-zinc-900/90 border border-zinc-800 rounded-3xl p-5 shadow-lg">
                <div className="p-3 bg-zinc-800 rounded-2xl border border-zinc-700/50 shrink-0">
                  <TrendingDown className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-[11px] font-bold tracking-wider text-zinc-400 uppercase">Total Savings</p>
                  <p className="text-base font-bold text-zinc-100">62% Avg. Reduction</p>
                </div>
              </div>

              <div className="w-full flex items-center gap-4 bg-zinc-900/90 border border-zinc-800 rounded-3xl p-5 shadow-lg">
                <div className="p-3 bg-zinc-800 rounded-2xl border border-zinc-700/50 shrink-0">
                  <Sparkles className="w-6 h-6 text-zinc-200" />
                </div>
                <div>
                  <p className="text-[11px] font-bold tracking-wider text-zinc-400 uppercase">Accuracy</p>
                  <p className="text-base font-bold text-zinc-100">100% Verified Match</p>
                </div>
              </div>

              <div className="w-full flex items-center gap-4 bg-zinc-900/90 border border-zinc-800 rounded-3xl p-5 shadow-lg"><div className="p-3 bg-zinc-800 rounded-2xl border border-zinc-700/50"><Layers className="w-6 h-6 text-white" /></div><div><p className="text-[11px] font-bold tracking-wider text-zinc-400 uppercase">ACTIVE FORMULA</p><p className="text-base font-bold text-zinc-100">Live Matrix Active</p></div></div>

            </div>
          </div>
        )}

        {/* SCAN TAB */}
        {activeTab === 'scan' && (
          <div className="space-y-4 md:space-y-6 animate-fadeIn max-w-4xl mx-auto w-full pt-2 md:my-auto">
            <div className="flex justify-between items-center gap-3">
              <h2 className="text-base md:text-lg font-bold uppercase tracking-wider text-zinc-200">
                {language === 'en' ? (
                  <span>
                    <span className="bg-gradient-to-r from-white via-slate-200 to-gray-400 bg-clip-text text-transparent font-black drop-shadow-[0_2px_10px_rgba(255,255,255,0.2)]">AI</span>{' '}
                    MEDICINE SCANNER
                  </span>
                ) : 'نسخہ (پرچی) کا تجزیہ'}
              </h2>
              <button
                onClick={() => setLanguage(language === 'en' ? 'ur' : 'en')}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 px-3.5 py-1.5 rounded-full text-xs font-bold transition shadow-md shrink-0"
              >
                <Globe className="w-4 h-4 text-white" />
                <span>{language === 'en' ? 'اردو میں دیکھیں' : 'Switch to English'}</span>
              </button>
            </div>

            {currentScan && !loading ? (
              <div className="space-y-4">
                {/* DOCTOR DIAGNOSIS CARD */}
                <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/10 rounded-[24px] p-5 shadow-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-zinc-400 shrink-0">
                      <FileText className="w-6 h-6 text-zinc-400" />
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-400 uppercase font-semibold">
                        {language === 'en' ? 'Doctor Diagnosis / Disease' : 'پرچی کی تشخیص (بیماری)'}
                      </p>
                      <h3 className="text-sm md:text-base font-bold text-white mt-0.5">
                        {language === 'en' ? currentScan.disease : (currentScan.diseaseUr ?? currentScan.disease)}
                      </h3>
                    </div>
                  </div>
                  <span className="text-[10px] text-white font-bold shrink-0">
                    100% Salt Match
                  </span>
                </div>

                {/* PER-MEDICATION CARDS */}
                {currentScan.medicines.map((med, index) => (
                  <div key={index} className="bg-white/[0.05] backdrop-blur-2xl border border-white/10 rounded-[26px] p-5 md:p-6 space-y-2.5 shadow-xl">
                    <div className="flex justify-between items-start border-b border-white/10 pb-3 gap-3">
                      <div className="flex items-center gap-2.5">
                        <Pill className="w-5 h-5 text-white shrink-0" />
                        <div>
                          <h4 className="font-bold text-white text-base md:text-lg">{med.original}</h4>
                          <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Prescribed Brand</span>
                        </div>
                      </div>
                      <span className="text-xs text-zinc-400 line-through font-semibold shrink-0">{med.origPrice}</span>
                    </div>

                    {(language === 'en' ? med.purposeEn : med.purposeUr) && (
                      <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-0.5">
                        <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-white" />
                          {language === 'en' ? 'What it is used for:' : 'دوائی کا مقصد (یہ کس لیے ہے):'}
                        </p>
                        <p className="text-xs md:text-sm text-zinc-200 font-medium leading-relaxed">
                          {language === 'en' ? med.purposeEn : med.purposeUr}
                        </p>
                      </div>
                    )}

                    {(language === 'en' ? med.dosageEn : med.dosageUr) && (
                      <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-2.5 space-y-0.5">
                        <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-white" />
                          {language === 'en' ? 'Dosage & Instructions:' : 'خوراک کا طریقہ کار:'}
                        </p>
                        <p className="text-xs md:text-sm text-zinc-200 font-medium">
                          {language === 'en' ? med.dosageEn : med.dosageUr}
                        </p>
                      </div>
                    )}

                    <div className="bg-blue-500/10 border border-blue-400/20 text-blue-100 rounded-xl p-3.5 flex justify-between items-center shadow-lg gap-3">
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-white font-bold uppercase tracking-wider">
                          {language === 'en' ? 'Cheaper Generic Salt Equivalent:' : 'سستا اور بااعتماد متبادل:'}
                        </p>
                        <p className="font-extrabold text-white text-sm md:text-base">{med.alternative}</p>
                      </div>
                      <div className="text-right space-y-0.5 shrink-0">
                        <p className="font-extrabold text-white text-sm md:text-base">{med.altPrice}</p>
                        <span className="text-[10px] text-gray-200 font-bold block">
                          {med.savings}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : loading ? (
              <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/10 rounded-[26px] p-8 text-center space-y-4">
                <Loader2 className="w-10 h-10 mx-auto text-zinc-300 animate-spin" />
                <p className="text-xs md:text-sm text-zinc-400">Analyzing your prescription...</p>
              </div>
            ) : scanError ? (
              <div className="bg-red-500/10 border border-red-500/20 rounded-[26px] md:rounded-[28px] p-6 md:p-8 text-center space-y-4">
                <AlertTriangle className="w-10 h-10 md:w-12 md:h-12 mx-auto text-red-400" />
                <p className="text-sm md:text-base text-red-300 font-semibold">Scan could not be completed</p>
                <p className="text-xs text-red-200/80 break-words">{scanError}</p>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button onClick={openCameraModal} className="py-3 bg-zinc-800 hover:bg-zinc-700 border border-white/15 rounded-xl md:rounded-2xl text-xs font-bold uppercase tracking-wider transition">
                    Retry Camera
                  </button>
                  <button onClick={handleUploadClick} className="py-3 bg-white/10 hover:bg-white/20 border border-white/15 rounded-xl md:rounded-2xl text-xs font-bold uppercase tracking-wider transition">
                    Retry Upload
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/10 rounded-[26px] md:rounded-[28px] p-8 md:p-12 text-center space-y-4 md:space-y-5">
                <Camera className="w-12 h-12 md:w-16 md:h-16 mx-auto text-zinc-500" />
                <p className="text-xs md:text-sm text-zinc-400">No active scan yet. Use the camera or upload a prescription file to begin.</p>
                <div className="flex justify-center gap-3 pt-2">
                  <button onClick={openCameraModal} className="px-5 py-2.5 md:px-6 md:py-3 bg-zinc-800 hover:bg-zinc-700 border border-white/15 rounded-xl md:rounded-2xl text-xs font-bold uppercase tracking-wider transition">
                    Launch Camera
                  </button>
                  <button onClick={handleUploadClick} className="px-5 py-2.5 md:px-6 md:py-3 bg-white/10 hover:bg-white/20 border border-white/15 rounded-xl md:rounded-2xl text-xs font-bold uppercase tracking-wider transition">
                    Select File
                  </button>
                </div>
                <div className="flex items-start gap-2.5 bg-blue-500/10 border border-blue-400/20 text-blue-200 rounded-xl p-4 text-left max-w-md mx-auto">
                  <Lightbulb className="w-4 h-4 text-blue-300 shrink-0 mt-0.5" />
                  <p className="text-[11px] md:text-xs text-blue-200 leading-relaxed">
                    <strong className="text-blue-300">Tip:</strong> For best accuracy, upload a clear photo of the printed Medicine Box or Strip instead of handwritten prescriptions.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/10 rounded-[22px] md:rounded-[24px] p-4 md:p-5 space-y-2 md:space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Formula Accuracy Guide</h3>
                  <ShieldCheck className="w-4 h-4 md:w-5 md:h-5 text-white" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-white/10 h-2 rounded-full overflow-hidden">
                    <div className="bg-white h-full w-[100%]" />
                  </div>
                  <span className="text-[11px] font-bold text-zinc-300">100% Verified</span>
                </div>
              </div>

              <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/10 rounded-[22px] md:rounded-[24px] p-4 md:p-5 space-y-2 md:space-y-3">
                <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Recent Scanned Salts</h3>
                {history.length === 0 ? (
                  <div className="space-y-2 text-xs text-zinc-300">
                    <div className="flex justify-between bg-white/5 p-2 md:p-2.5 rounded-lg md:rounded-xl">
                      <span>Paracetamol 500mg</span>
                      <span className="text-zinc-400">Panadol Alt.</span>
                    </div>
                    <div className="flex justify-between bg-white/5 p-2 md:p-2.5 rounded-lg md:rounded-xl">
                      <span>Co-Amoxiclav 1g</span>
                      <span className="text-zinc-400">Augmentin Alt.</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-xs text-zinc-300">
                    {history.slice(0, 4).map((scan) =>
                      scan.medicines.map((m, i) => (
                        <div key={`${scan.id}-${i}`} className="flex justify-between bg-white/5 p-2 md:p-2.5 rounded-lg md:rounded-xl">
                          <span>{m.formula}</span>
                          <span className="text-zinc-400">{m.alternative} Alt.</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={resetScan}
                className="w-full py-3.5 md:py-4 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-400/30 text-blue-200 backdrop-blur-md shadow-lg transition-all rounded-2xl text-xs uppercase tracking-wider font-medium flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                {language === 'en' ? 'Capture New / Scan Another Medicine' : 'نیا اسکین کریں'}
              </button>
              <button
                onClick={() => navigateTo('home')}
                className="w-full py-3.5 md:py-4 bg-white/10 hover:bg-white/20 border border-white/15 rounded-2xl text-xs font-bold uppercase tracking-wider transition"
              >
                Back to Home Dashboard
              </button>
            </div>
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="space-y-3 md:space-y-4 animate-fadeIn max-w-4xl mx-auto w-full pt-2 lg:items-start lg:justify-start lg:mt-10">
            <h2 className="text-base md:text-lg font-bold uppercase tracking-wider text-zinc-200 mb-2">Scan History</h2>
            {history.length === 0 ? (
              <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/10 rounded-[22px] p-6 text-center">
                <p className="text-zinc-300 text-sm font-medium">No past prescriptions found.</p>
                <p className="text-zinc-500 text-[11px] mt-1">Scan a prescription to start building your history.</p>
              </div>
            ) : (
              history.map((scan) => (
                <div
                  key={scan.id}
                  className="bg-white/[0.05] backdrop-blur-2xl border border-white/10 rounded-[22px] p-4 flex justify-between items-center"
                >
                  <div className="space-y-1">
                    <h4 className="text-xs md:text-sm font-bold text-white">{scan.disease}</h4>
                    <p className="text-[10px] md:text-xs text-zinc-400">
                      {scan.medicines.length} medicines · {new Date(scan.scannedAt).toLocaleDateString()}
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {scan.medicines.map((m, i) => (
                        <span
                          key={i}
                          className="text-[10px] text-zinc-300 bg-white/5 px-2 py-0.5 rounded-md border border-white/10"
                        >
                          {m.original} → {m.alternative}
                        </span>
                      ))}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-500" />
                </div>
              ))
            )}
          </div>
        )}

        {/* PROFILE TAB */}
        {activeTab === 'profile' && (
          <div className="space-y-4 md:space-y-6 animate-fadeIn max-w-xl mx-auto w-full pt-2 md:my-auto">
            <div className="bg-white/[0.05] border border-white/10 rounded-[28px] p-6 text-center space-y-4">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-zinc-800 border-2 border-white/20 flex items-center justify-center mx-auto">
                <User className="w-8 h-8 md:w-10 md:h-10 text-zinc-400" />
              </div>

              <div>
                <h3 className="font-bold text-lg text-white">{userName}</h3>
                {isLoggedIn && userEmail && (
                  <span className="text-xs text-zinc-400 block mt-0.5 break-all">{userEmail}</span>
                )}
                <span className="text-xs text-zinc-500 uppercase tracking-wider block mt-1">
                  {isLoggedIn ? 'Verified Account' : 'Guest Account Mode'}
                </span>
              </div>

              {isLoggedIn ? (
                <div className="pt-2 space-y-3">
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400 text-xs font-semibold space-y-0.5">
                    <p>✓ You are signed in as {userName}</p>
                    {userEmail && <p className="text-blue-300/80 font-normal">{userEmail}</p>}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full bg-red-500/10 border border-red-500/20 text-red-400 py-3.5 rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-red-500/20 transition"
                  >
                    <LogOut className="w-4 h-4" /> Log Out Account
                  </button>
                </div>
              ) : (
                <div className="pt-2 space-y-3">
                  <button
                    onClick={() => openAuth('signin')}
                    className="w-full bg-white text-black font-bold py-3.5 rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-zinc-200 transition shadow-lg"
                  >
                    <LogIn className="w-4 h-4" /> Sign In / Sign Up
                  </button>
                  <p className="text-[11px] text-zinc-500">Currently using Guest Mode. Sign in to save scan history permanently.</p>
                </div>
              )}
            </div>

            {/* Privacy Policy entry from Profile */}
            <button
              onClick={() => { setPrivacyReturnTo('app'); setCurrentScreen('privacy'); }}
              className="text-zinc-400 hover:text-white flex items-center gap-2 justify-center py-2 transition"
            >
              <Shield className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Privacy Policy</span>
            </button>
          </div>
        )}
      </main>

      {/* MOBILE BOTTOM NAV */}
      <nav className="md:hidden fixed bottom-4 left-0 right-0 z-40 mx-auto w-[calc(100%-2rem)] max-w-md">
        <div className="bg-white/[0.08] backdrop-blur-3xl border border-white/15 rounded-[26px] p-2 flex justify-around items-center shadow-2xl">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.name;
            return (
              <button
                key={item.name}
                onClick={() => navigateTo(item.name)}
                className={`flex flex-col items-center justify-center w-16 py-2 rounded-full transition-all duration-300 ${
                  isActive ? 'bg-white/20 text-white shadow-lg scale-105 border border-white/20' : 'hover:bg-white/5 text-zinc-400'
                }`}
              >
                <Icon
                  className={`w-4 h-4 transition-colors duration-300 ${isActive ? 'text-white' : 'text-zinc-400'}`}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span className={`text-[9px] mt-1 font-semibold tracking-wide ${isActive ? 'text-white' : 'text-zinc-400'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* CAMERA MODAL (fullscreen overlay) */}
      {showCameraModal && (
        <div className="fixed inset-0 z-[70] bg-black flex flex-col justify-between p-6 md:p-8 animate-fadeIn">
          <div className="flex justify-between items-center z-10 max-w-4xl mx-auto w-full">
            <span className="text-xs md:text-sm font-bold tracking-widest uppercase text-zinc-400">AI OCR Viewfinder</span>
            <button
              onClick={closeCameraModal}
              className="p-2.5 md:p-3 bg-white/10 hover:bg-white/20 rounded-full transition border border-white/10"
              aria-label="Close camera"
            >
              <X className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </button>
          </div>

          <div className="flex-1 my-6 md:my-8 border-2 border-dashed border-blue-400/50 rounded-[30px] md:rounded-[36px] relative flex items-center justify-center bg-zinc-900/40 overflow-hidden max-w-4xl mx-auto w-full">
            <video ref={camera.videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
            {camera.ready && !camera.error && (
              <div className="absolute inset-6 border border-white/25 rounded-2xl pointer-events-none z-10" />
            )}
            {!camera.ready && !camera.error && (
              <div className="relative z-10 flex flex-col items-center p-6 text-center">
                <Loader2 className="w-10 h-10 md:w-12 md:h-12 text-zinc-400 animate-spin mb-3" />
                <p className="text-xs text-zinc-500">Initializing camera...</p>
              </div>
            )}
            {camera.error && (
              <div className="relative z-10 flex items-start gap-2 max-w-xs p-6 text-center">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-200/90 text-left">{camera.error}</p>
              </div>
            )}
            {camera.ready && !camera.error && !loading && (
              <div className="absolute inset-6 border border-white/15 rounded-2xl md:rounded-3xl flex flex-col items-center justify-center p-6 md:p-8 text-center pointer-events-none z-10">
                <Camera className="w-12 h-12 md:w-16 md:h-16 text-zinc-400 mb-3 md:mb-4 animate-pulse" />
                <p className="text-xs md:text-base font-semibold text-zinc-200">Position prescription within the frame</p>
                <span className="text-[10px] md:text-xs text-zinc-400 mt-1">Ensure salt formula names are clearly visible</span>
              </div>
            )}
            {loading && (
              <div className="absolute inset-0 z-20 bg-white/10 flex items-center justify-center">
                <span className="text-xs font-semibold text-black bg-white px-3 py-1.5 rounded-md flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing...
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col items-center pb-4 md:pb-6 z-10 space-y-3">
            <button
              onClick={handleCameraCapture}
              disabled={!camera.ready || loading || !!camera.error}
              className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-white flex items-center justify-center bg-white/20 active:scale-90 hover:bg-white/30 transition shadow-2xl shadow-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="w-14 h-14 md:w-16 md:h-16 bg-white rounded-full" />
            </button>
            <span className="text-[10px] md:text-xs uppercase tracking-widest font-bold text-zinc-400">Tap to Scan Salt</span>
          </div>
        </div>
      )}

      {/* OTHER MODALS */}
      {activeModal !== 'none' && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
          onClick={closeModal}
        >
          <div
            className="bg-zinc-900 border border-white/15 rounded-[28px] p-5 w-full max-w-xs md:max-w-md space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {activeModal === 'calendar' && (
              <>
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-sm uppercase tracking-wider">Annual Calendar 2026</h3>
                  <button onClick={closeModal} aria-label="Close"><X className="w-4 h-4" /></button>
                </div>
                <p className="text-xs text-zinc-400">
                  Selected Schedule Date: <strong className="text-white">{selectedDay.short} {selectedDay.date}, {new Date().getFullYear()}</strong>
                </p>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  {months.map((m, i) => (
                    <div
                      key={i}
                      className={`p-2 rounded-xl border ${
                        m === currentMonthShort ? 'bg-white text-black font-bold' : 'bg-white/5 border-white/5 text-zinc-400'
                      }`}
                    >
                      {m}
                    </div>
                  ))}
                </div>
                <button onClick={closeModal} className="w-full bg-white text-black font-bold py-2.5 rounded-xl text-xs uppercase hover:bg-zinc-200 transition">
                  Close Calendar
                </button>
              </>
            )}

            {activeModal === 'notif' && (
              <>
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-sm uppercase tracking-wider">Notifications</h3>
                  <button onClick={closeModal} aria-label="Close"><X className="w-4 h-4" /></button>
                </div>
                <div className="flex items-center gap-3 py-4">
                  <div className="w-9 h-9 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                    <Bell className="w-4 h-4 text-zinc-200" />
                  </div>
                  <p className="text-xs text-zinc-400">No new medical updates or notifications available.</p>
                </div>
                <button onClick={closeModal} className="w-full bg-white text-black font-bold py-2.5 rounded-xl text-xs uppercase hover:bg-zinc-200 transition">
                  OK
                </button>
              </>
            )}

            {activeModal === 'auth' && null}

            {activeModal === 'tips' && (
              <>
                <div className="flex justify-between items-center sticky top-0 bg-zinc-900 pb-2 border-b border-white/10">
                  <h3 className="font-bold text-sm uppercase tracking-wider">NoxAI Smart Health Tips</h3>
                  <button onClick={closeModal} aria-label="Close"><X className="w-4 h-4" /></button>
                </div>
                <div className="space-y-2.5 text-xs max-h-[60vh] overflow-y-auto">
                  {/* Mobile: show only first 5 tips; Desktop: show all 7 */}
                  {(typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches ? tipsContent : tipsContent.slice(0, 5)).map((tip) => (
                    <div key={tip.id} className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-1">
                      <h4 className="font-bold text-white text-[11px] md:text-xs">{tip.id}. {tip.title}</h4>
                      <p className="text-zinc-400 text-[10px] md:text-[11px] leading-relaxed">{tip.desc}</p>
                    </div>
                  ))}
                </div>
                <button onClick={closeModal} className="w-full bg-white text-black font-bold py-2.5 rounded-xl text-xs uppercase hover:bg-zinc-200 transition sticky bottom-0">
                  Got It
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* AUTH MODAL (fullscreen overlay) */}
      {activeModal === 'auth' && (
        <AuthModal
          initialMode={authInitialMode}
          onClose={() => setActiveModal('none')}
          onSuccess={handleAuthSuccess}
        />
      )}
    </div>
  );
}
