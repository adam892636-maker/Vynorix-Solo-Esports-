import { useMemo, useState } from 'react';
import { ArrowRight, Plus, Search } from 'lucide-react';
import type { GameTitle, Tournament, TournamentStatus } from '../types/tournament';
import {
  BANNER_ASSETS,
  formatCurrency,
  formatFormatLabel,
  formatStatusLabel,
  GAMES,
  HERO_IMAGE,
} from '../lib/validation';
import { ResilientImage } from './ResilientImage';

interface TournamentsViewProps {
  tournaments: Tournament[];
  totalPlayers: number;
  loading: boolean;
  isAdmin: boolean;
  registeredTournamentIds: Set<string>;
  onSelectTournament: (id: string) => void;
  onOpenLeaderboard: () => void;
  onOpenOrganizer: () => void;
  onSeedLeague: () => Promise<void>;
}

export function TournamentsView({
  tournaments,
  totalPlayers,
  loading,
  isAdmin,
  registeredTournamentIds,
  onSelectTournament,
  onOpenLeaderboard,
  onOpenOrganizer,
  onSeedLeague,
}: TournamentsViewProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | TournamentStatus>('all');
  const [gameFilter, setGameFilter] = useState<'all' | GameTitle>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [seeding, setSeeding] = useState(false);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tournaments.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (gameFilter !== 'all' && t.game !== gameFilter) return false;
      if (q && !t.title.toLowerCase().includes(q) && !t.game.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [tournaments, statusFilter, gameFilter, searchQuery]);

  const metrics = useMemo(() => {
    const openOrLive = tournaments.filter(
      (t) => t.status === 'registration' || t.status === 'live'
    ).length;
    const totalPrizeInr = tournaments.reduce(
      (sum, t) => sum + (t.currency === 'USD' ? t.prizePool * 84 : t.prizePool),
      0
    );
    const totalSlotsTaken = tournaments.reduce((sum, t) => sum + t.registeredCount, 0);
    const liveBrackets = tournaments.filter((t) => t.status === 'live').length;
    return { openOrLive, totalPrizeInr, totalSlotsTaken, liveBrackets };
  }, [tournaments]);

  const primaryOpenEvent = useMemo(
    () =>
      tournaments.find((t) => t.status === 'registration') ||
      tournaments.find((t) => t.status === 'live') ||
      tournaments[0],
    [tournaments]
  );

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await onSeedLeague();
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-12">
      {/* Hero Arena Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-7 flex flex-col justify-between bg-[#11161F] border border-slate-800/80 rounded-xl p-6 sm:p-10">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-400">
              <span>Vynorix Solo Circuit</span>
              <span aria-hidden="true">·</span>
              <span>1v1 Brackets &amp; Battle Royale</span>
              <span aria-hidden="true">·</span>
              <span>Verified Standings</span>
            </div>

            <h1
              className="font-display font-bold tracking-tight text-white leading-[1.02]"
              style={{ fontSize: 'clamp(2.25rem, 4vw, 3.75rem)', textWrap: 'balance' }}
            >
              Solo Esports Built for Pure Mechanical Skill
            </h1>

            <p className="text-slate-300 text-base leading-relaxed max-w-xl">
              Enter daily solo drops and single-elimination 1v1 brackets across BGMI, Valorant, Free Fire, and COD Mobile. Lock your slot, access verified lobby codes, and climb the solo ELO ladder.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            {primaryOpenEvent ? (
              <button
                type="button"
                onClick={() => onSelectTournament(primaryOpenEvent.id)}
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-lg bg-orange-500 hover:bg-orange-600 text-slate-950 transition-colors cursor-pointer whitespace-nowrap"
              >
                <span>Enter Featured Event</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={isAdmin ? onOpenOrganizer : onOpenLeaderboard}
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-lg bg-orange-500 hover:bg-orange-600 text-slate-950 transition-colors cursor-pointer whitespace-nowrap"
              >
                <span>{isAdmin ? 'Create First Event' : 'View Solo Rankings'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onOpenLeaderboard}
              className="px-4 py-3 text-sm font-medium text-slate-300 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              Global Leaderboard
            </button>
          </div>
        </div>

        <div className="lg:col-span-5 relative rounded-xl overflow-hidden border border-slate-800/80 min-h-[260px] lg:min-h-full">
          <ResilientImage
            src={HERO_IMAGE}
            alt="Vynorix Solo Esports competition stage"
            className="w-full h-full lg:h-full object-cover"
            fallbackTitle="Vynorix Solo Stage"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-[#090C10] via-[#090C10]/30 to-transparent"
            aria-hidden="true"
          />
          <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-orange-400">
                {primaryOpenEvent ? formatStatusLabel(primaryOpenEvent.status) : 'Season 01'}
              </p>
              <p className="font-display text-2xl font-bold text-white leading-tight">
                {primaryOpenEvent ? primaryOpenEvent.title : 'Vynorix Championship Arena'}
              </p>
            </div>
            {primaryOpenEvent && (
              <span className="font-mono-tabular text-sm font-semibold text-white shrink-0">
                {formatCurrency(primaryOpenEvent.prizePool, primaryOpenEvent.currency)}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Full-Width 4-Column KPI Strip */}
      <section
        className="bg-[#11161F] border border-slate-800/80 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-800/80"
        aria-label="Platform metrics"
      >
        <div className="p-5 sm:p-6 space-y-1">
          <p className="text-xs font-medium text-slate-400">Active &amp; Open Events</p>
          <p className="font-mono-tabular text-2xl sm:text-3xl font-semibold text-white">
            {metrics.openOrLive}
          </p>
        </div>
        <div className="p-5 sm:p-6 space-y-1">
          <p className="text-xs font-medium text-slate-400">Combined Prize Pool</p>
          <p className="font-mono-tabular text-2xl sm:text-3xl font-semibold text-white">
            {formatCurrency(metrics.totalPrizeInr, 'INR')}
          </p>
        </div>
        <div className="p-5 sm:p-6 space-y-1">
          <p className="text-xs font-medium text-slate-400">Ranked Soloists</p>
          <p className="font-mono-tabular text-2xl sm:text-3xl font-semibold text-white">
            {Math.max(totalPlayers, metrics.totalSlotsTaken)}
          </p>
        </div>
        <div className="p-5 sm:p-6 space-y-1">
          <p className="text-xs font-medium text-slate-400">Live Brackets Running</p>
          <p className="font-mono-tabular text-2xl sm:text-3xl font-semibold text-white">
            {metrics.liveBrackets}
          </p>
        </div>
      </section>

      {/* Tournaments Filter Bar & Catalog */}
      <section className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-display text-3xl font-bold tracking-tight text-white">
              Solo Tournaments
            </h2>
            <p className="text-sm text-slate-400">
              Select any event to inspect match brackets, standings, and lobby credentials.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Segmented Status Controls */}
            <div
              className="flex items-center gap-1 p-1 bg-[#11161F] border border-slate-800/80 rounded-lg"
              role="tablist"
              aria-label="Filter tournaments by status"
            >
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'registration', label: 'Open' },
                  { id: 'live', label: 'Live' },
                  { id: 'completed', label: 'Completed' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    statusFilter === tab.id
                      ? 'bg-orange-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Game Filter */}
            <select
              value={gameFilter}
              onChange={(e) => setGameFilter(e.target.value as 'all' | GameTitle)}
              aria-label="Filter by game title"
              className="bg-[#11161F] border border-slate-800/80 text-slate-200 text-xs font-medium rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
            >
              <option value="all">All Games</option>
              {GAMES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search events..."
                aria-label="Search tournaments"
                className="bg-[#11161F] border border-slate-800/80 text-slate-100 placeholder:text-slate-500 text-xs rounded-lg pl-9 pr-3 py-2 w-44 sm:w-52 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="bg-[#11161F] border border-slate-800/80 rounded-xl overflow-hidden animate-pulse"
              >
                <div className="h-44 bg-slate-800/60" />
                <div className="p-5 space-y-4">
                  <div className="h-3 w-40 bg-slate-800 rounded" />
                  <div className="h-6 w-3/4 bg-slate-800 rounded" />
                  <div className="h-10 bg-slate-800/70 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-[#11161F] border border-slate-800/80 rounded-xl p-10 text-center space-y-4">
            <h3 className="font-display text-2xl font-bold text-white">
              {tournaments.length === 0
                ? 'No Tournaments Scheduled Yet'
                : 'No Matching Tournaments'}
            </h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              {tournaments.length === 0
                ? 'Launch your first solo event or publish the Season 1 starter pack to open registrations.'
                : 'Try adjusting your game, status filter, or search query.'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {tournaments.length === 0 && isAdmin && (
                <>
                  <button
                    type="button"
                    disabled={seeding}
                    onClick={handleSeed}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-slate-950 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    {seeding ? 'Publishing...' : 'Publish Season 1 Starter Pack'}
                  </button>
                  <button
                    type="button"
                    onClick={onOpenOrganizer}
                    className="px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Open Organizer Console
                  </button>
                </>
              )}
              {tournaments.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('all');
                    setGameFilter('all');
                    setSearchQuery('');
                  }}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((t) => {
              const isJoined = registeredTournamentIds.has(t.id);
              const statusColor =
                t.status === 'live'
                  ? 'text-emerald-400'
                  : t.status === 'registration'
                    ? 'text-orange-400'
                    : 'text-slate-400';

              return (
                <article
                  key={t.id}
                  className="bg-[#11161F] border border-slate-800/80 rounded-xl overflow-hidden flex flex-col justify-between transition-colors hover:border-slate-700"
                >
                  <div>
                    <div className="relative h-44 overflow-hidden">
                      <ResilientImage
                        src={BANNER_ASSETS[t.bannerKey] || HERO_IMAGE}
                        alt={t.title}
                        className="w-full h-full object-cover"
                        fallbackTitle={t.game}
                      />
                      <div
                        className="absolute inset-0 bg-gradient-to-t from-[#11161F] via-[#11161F]/20 to-transparent"
                        aria-hidden="true"
                      />
                      <div className="absolute top-3 right-3 text-xs font-semibold bg-[#090C10]/85 px-2.5 py-1 rounded border border-slate-800">
                        <span className={statusColor}>{formatStatusLabel(t.status)}</span>
                      </div>
                    </div>

                    <div className="p-5 space-y-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span>{t.game}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatFormatLabel(t.format)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{t.region}</span>
                        {isJoined && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-emerald-400 font-medium">Registered</span>
                          </>
                        )}
                      </div>

                      <h3 className="font-display text-2xl font-bold text-white leading-snug">
                        {t.title}
                      </h3>

                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {t.rulesSummary}
                      </p>
                    </div>
                  </div>

                  <div className="px-5 pb-5 pt-3 border-t border-slate-800/80 space-y-4">
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <p className="text-slate-500">Prize Pool</p>
                        <p className="font-mono-tabular font-semibold text-white mt-0.5">
                          {formatCurrency(t.prizePool, t.currency)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Entry</p>
                        <p className="font-mono-tabular font-semibold text-slate-200 mt-0.5">
                          {formatCurrency(t.entryFee, t.currency)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Slots</p>
                        <p className="font-mono-tabular font-semibold text-slate-200 mt-0.5">
                          {t.registeredCount} / {t.maxPlayers}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectTournament(t.id)}
                      className="w-full py-2.5 px-4 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-orange-500 text-white hover:text-slate-950 transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                    >
                      <span>
                        {t.status === 'registration'
                          ? isJoined
                            ? 'Manage Entry & Lobby'
                            : 'Register Solo'
                          : 'View Bracket & Standings'}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
