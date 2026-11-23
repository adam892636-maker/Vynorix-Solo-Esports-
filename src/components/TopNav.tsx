import { Menu, X } from 'lucide-react';
import { useState } from 'react';

export type NavTab = 'tournaments' | 'brackets' | 'leaderboard' | 'profile' | 'organizer';

interface TopNavProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isSignedIn: boolean;
  isAdmin: boolean;
  playerIgn: string | null;
  onSignIn: () => void;
}

export function TopNav({
  activeTab,
  onSelectTab,
  isSignedIn,
  isAdmin,
  playerIgn,
  onSignIn,
}: TopNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: Array<{ id: NavTab; label: string }> = [
    { id: 'tournaments', label: 'Tournaments' },
    { id: 'brackets', label: 'Live Brackets' },
    { id: 'leaderboard', label: 'Leaderboard' },
    { id: 'profile', label: 'Player Hub' },
    ...(isAdmin ? [{ id: 'organizer' as NavTab, label: 'Organizer' }] : []),
  ];

  const handleSelect = (tab: NavTab) => {
    onSelectTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#090C10]/95 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element Brand Zone */}
        <button
          type="button"
          onClick={() => handleSelect('tournaments')}
          className="font-display text-2xl font-bold tracking-tight text-white whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded"
        >
          VYNORIX
        </button>

        {/* Zone 2: 4-5 clean single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-7" aria-label="Primary navigation">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`relative py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded ${
                  isActive
                    ? 'text-white'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    className="absolute left-0 right-0 -bottom-[21px] h-[2px] bg-orange-500"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          {isSignedIn ? (
            <button
              type="button"
              onClick={() => handleSelect('profile')}
              className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-orange-500 hover:bg-orange-600 text-slate-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer max-w-[150px] truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
            >
              {playerIgn || 'My Account'}
            </button>
          ) : (
            <button
              type="button"
              onClick={onSignIn}
              className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-orange-500 hover:bg-orange-600 text-slate-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
            >
              Sign In
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden p-2 text-slate-300 hover:text-white rounded-lg border border-slate-800 cursor-pointer"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <nav
          className="md:hidden border-t border-slate-800 bg-[#0D1117] px-4 py-3 flex flex-col gap-1"
          aria-label="Mobile navigation"
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-slate-800/80 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      )}
    </header>
  );
}
