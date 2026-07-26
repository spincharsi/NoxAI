import { Bell } from 'lucide-react';

interface NorixAIHeaderProps {
  onBellClick?: () => void;
  onLogoClick?: () => void;
}

export default function NorixAIHeader({ onBellClick, onLogoClick }: NorixAIHeaderProps) {
  return (
    <header className="md:hidden pt-5 pb-1 px-4 max-w-md mx-auto w-full flex justify-between items-center shrink-0 bg-transparent border-none">
      <div className="flex items-center gap-3">
        <button
          className="flex flex-col items-start gap-1 w-6 cursor-pointer"
          aria-label="Menu"
          onClick={onLogoClick}
        >
          <div className="w-full h-0.5 bg-white rounded-full"></div>
          <div className="w-3/4 h-0.5 bg-zinc-400 rounded-full"></div>
          <div className="w-1/2 h-0.5 bg-zinc-600 rounded-full"></div>
        </button>
        <span className="text-xl font-bold tracking-wide text-white">NoxAI</span>
      </div>

      <button
        className="p-1 text-zinc-300 hover:text-white transition-colors cursor-pointer"
        aria-label="Notifications"
        onClick={onBellClick}
      >
        <Bell className="w-5 h-5" />
      </button>
    </header>
  );
}
