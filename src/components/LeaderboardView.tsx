import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { GameTitle, RegionCode, UserProfile } from '../types/tournament';
import { GAMES, REGIONS, TROPHY_IMAGE } from '../lib/validation';
import { ResilientImage } from './ResilientImage';

interface LeaderboardViewProps {
  players: UserProfile[];
  loading: boolean;
  currentUid?: string;
}

export function LeaderboardView({ players, loading, currentUid }: LeaderboardViewProps) {
  const [regionFilter, setRegionFilter] = useState<'all' | RegionCode>('all');
  const [gameFilter, setGameFilter] = useState<'all' | GameTitle>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const sortedPlayers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...players]
      .filter((p) => {
        if (regionFilter !== 'all' && p.region !== regionFilter) return false;
        if (gameFilter !== 'all' && p.favoriteGame !== gameFilter) return false;
        if (
          q &&
          !p.ign.toLowerCase().includes(q) &&
          !p.gameUid.toLowerCase().includes(q)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.rating - a.rating || b.wins - a.wins);
  }, [players, regionFilter, gameFilter, searchQuery]);

  const topThree = sortedPlayers.slice(0, 3);

  return (
    <div className="space-y-10">
      {/* Championship Spotlight */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-4 bg-[#11161F] border border-slate-800/80 rounded-xl overflow-hidden flex flex-col">
          <div className="h-56 lg:h-64 overflow-hidden relative">
            <ResilientImage
              src={TROPHY_IMAGE}
              alt="Vynorix Solo Championship Trophy"
              className="w-full h-full object-cover"
              fallbackTitle="Vynorix Championship Cup"
            />
            <div
              className="absolute inset-0 bg-gradient-to-t from-[#11161F] via-transparent to-transparent"
              aria-hidden="true"
            />
          </div>
          <div className="p-6 space-y-2 flex-1 flex flex-col justify-between">
            <div className="space-y-2">
              <p className="text-xs font-medium text-orange-400">Season 01 Standings</p>
              <h1 className="font-display text-3xl font-bold text-white leading-tight">
                Global Solo Leaderboard
              </h1>
              <p className="text-sm text-slate-400 leading-relaxed">
                Rankings update after verified tournament results. Consistency across eliminations and placements determines ELO tier.
              </p>
            </div>
            <p className="font-mono-tabular text-xs text-slate-500 pt-2">
              {players.length} Verified Competitors
            </p>
          </div>
        </div>

        <div className="lg:col-span-8 bg-[#11161F] border border-slate-800/80 rounded-xl p-6 flex flex-col justify-between">
          <div className="space-y-1 mb-5">
            <h2 className="font-display text-2xl font-bold text-white">Podium Leaders</h2>
            <p className="text-xs text-slate-400">Top 3 solo competitors in current filter</p>
          </div>

          {topThree.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-10 text-sm text-slate-500">
              No ranked soloists match the selected filters yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
              {topThree.map((player, index) => (
                <div
                  key={player.uid}
                  className={`rounded-lg border p-5 flex flex-col justify-between ${
                    index === 0
                      ? 'bg-[#161D29] border-orange-500/40'
                      : 'bg-[#0D1117] border-slate-800/80'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span
                        className={`font-mono-tabular font-semibold ${
                          index === 0 ? 'text-orange-400' : 'text-slate-400'
                        }`}
                      >
                        Rank #{index + 1}
                      </span>
                      <span className="text-slate-400">{player.region}</span>
                    </div>
                    <h3 className="font-display text-2xl font-bold text-white truncate">
                      {player.ign}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {player.favoriteGame} · <span className="font-mono-tabular">{player.gameUid}</span>
                    </p>
                  </div>

                  <div className="pt-5 mt-5 border-t border-slate-800/80 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-slate-500">ELO Rating</p>
                      <p className="font-mono-tabular text-lg font-semibold text-white">
                        {player.rating}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Wins / Kills</p>
                      <p className="font-mono-tabular text-lg font-semibold text-slate-200">
                        {player.wins} / {player.eliminations}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Filter Controls & Rankings Grid */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="font-display text-2xl font-bold text-white">All Ranked Soloists</h2>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={gameFilter}
              onChange={(e) => setGameFilter(e.target.value as 'all' | GameTitle)}
              aria-label="Filter leaderboard by game"
              className="bg-[#11161F] border border-slate-800/80 text-slate-200 text-xs font-medium rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
            >
              <option value="all">All Games</option>
              {GAMES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>

            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value as 'all' | RegionCode)}
              aria-label="Filter leaderboard by region"
              className="bg-[#11161F] border border-slate-800/80 text-slate-200 text-xs font-medium rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
            >
              <option value="all">All Regions</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search IGN or UID..."
                aria-label="Search leaderboard"
                className="bg-[#11161F] border border-slate-800/80 text-slate-100 placeholder:text-slate-500 text-xs rounded-lg pl-9 pr-3 py-2 w-48 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>
        </div>

        <div className="bg-[#11161F] border border-slate-800/80 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 text-xs font-medium text-slate-400">
                  <th className="py-3.5 px-4">Rank</th>
                  <th className="py-3.5 px-4">Soloist IGN</th>
                  <th className="py-3.5 px-4">Game UID</th>
                  <th className="py-3.5 px-4">Primary Game</th>
                  <th className="py-3.5 px-4">Region</th>
                  <th className="py-3.5 px-4 text-right">Matches</th>
                  <th className="py-3.5 px-4 text-right">Wins</th>
                  <th className="py-3.5 px-4 text-right">Eliminations</th>
                  <th className="py-3.5 px-4 text-right">ELO Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {loading ? (
                  [1, 2, 3, 4].map((i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={9} className="py-3.5 px-4">
                        <div className="h-4 bg-slate-800/60 rounded w-full" />
                      </td>
                    </tr>
                  ))
                ) : sortedPlayers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 px-4 text-center text-slate-400">
                      No ranked players found. Sign in to claim your place on the Vynorix Solo ladder.
                    </td>
                  </tr>
                ) : (
                  sortedPlayers.map((player, index) => {
                    const isSelf = player.uid === currentUid;
                    return (
                      <tr
                        key={player.uid}
                        className={`transition-colors hover:bg-slate-800/35 ${
                          isSelf ? 'bg-orange-500/10' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-mono-tabular text-xs font-semibold text-slate-300">
                          #{index + 1}
                        </td>
                        <td className="py-3 px-4 font-semibold text-white">
                          {player.ign}
                          {isSelf && (
                            <span className="ml-2 text-xs font-normal text-orange-400">
                              (You)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono-tabular text-xs text-slate-400">
                          {player.gameUid}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-300">{player.favoriteGame}</td>
                        <td className="py-3 px-4 text-xs text-slate-400">{player.region}</td>
                        <td className="py-3 px-4 text-right font-mono-tabular text-slate-300">
                          {player.matchesPlayed}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular text-emerald-400 font-medium">
                          {player.wins}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular text-slate-300">
                          {player.eliminations}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-white">
                          {player.rating}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
