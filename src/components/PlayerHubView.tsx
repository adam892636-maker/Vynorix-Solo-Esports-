import { useEffect, useState } from 'react';
import { ArrowRight, LogOut, Save } from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  fetchUserPrivateInfo,
  fetchUserRegisteredTournaments,
  updatePlayerProfile,
} from '../lib/firestoreService';
import {
  BLUEPRINT_LIMITS,
  formatCurrency,
  formatStatusLabel,
  GAMES,
  REGIONS,
} from '../lib/validation';
import type { GameTitle, RegionCode, Tournament, UserProfile } from '../types/tournament';

interface PlayerHubViewProps {
  user: User | null;
  profile: UserProfile | null;
  tournaments: Tournament[];
  onSignIn: () => void;
  onSignOut: () => void;
  onSelectTournament: (id: string) => void;
}

export function PlayerHubView({
  user,
  profile,
  tournaments,
  onSignIn,
  onSignOut,
  onSelectTournament,
}: PlayerHubViewProps) {
  const [ign, setIgn] = useState('');
  const [gameUid, setGameUid] = useState('');
  const [region, setRegion] = useState<RegionCode>('IN');
  const [favoriteGame, setFavoriteGame] = useState<GameTitle>('BGMI');
  const [discordHandle, setDiscordHandle] = useState('');
  const [registeredIds, setRegisteredIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (profile) {
      setIgn(profile.ign);
      setGameUid(profile.gameUid);
      setRegion(profile.region);
      setFavoriteGame(profile.favoriteGame);
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    fetchUserPrivateInfo(user.uid)
      .then((priv) => {
        if (active && priv) {
          setDiscordHandle(priv.discordHandle || '');
        }
      })
      .catch(() => {});

    fetchUserRegisteredTournaments(user.uid)
      .then((ids) => {
        if (active) setRegisteredIds(ids);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [user]);

  if (!user) {
    return (
      <div className="bg-[#11161F] border border-slate-800/80 rounded-xl p-10 max-w-lg mx-auto text-center space-y-5 my-8">
        <h1 className="font-display text-3xl font-bold text-white">Player Hub</h1>
        <p className="text-sm text-slate-400 leading-relaxed">
          Sign in with your Google account to configure your In-Game Name, link your Game UID, track career ELO statistics, and manage tournament check-ins.
        </p>
        <button
          type="button"
          onClick={onSignIn}
          className="px-6 py-3 text-sm font-semibold rounded-lg bg-orange-500 hover:bg-orange-600 text-slate-950 transition-colors cursor-pointer"
        >
          Sign In with Google
        </button>
      </div>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      await updatePlayerProfile(user.uid, {
        ign,
        gameUid,
        region,
        favoriteGame,
        discordHandle,
        email: user.email || 'unknown@vynorix.gg',
      });
      setFeedback({ type: 'ok', text: 'Player profile saved to Vynorix ledger.' });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to save profile.',
      });
    } finally {
      setSaving(false);
    }
  };

  const myTournaments = tournaments.filter((t) => registeredIds.includes(t.id));

  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-bold text-white">Player Hub</h1>
          <p className="text-sm text-slate-400">
            Signed in as <span className="text-slate-200">{user.email}</span>
          </p>
        </div>

        <button
          type="button"
          onClick={onSignOut}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer self-start sm:self-auto"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Career Stats Strip */}
      <section className="bg-[#11161F] border border-slate-800/80 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-800/80">
        <div className="p-5 space-y-1">
          <p className="text-xs text-slate-400">Competitive ELO</p>
          <p className="font-mono-tabular text-2xl font-semibold text-white">
            {profile?.rating ?? 1000}
          </p>
        </div>
        <div className="p-5 space-y-1">
          <p className="text-xs text-slate-400">Solo Wins</p>
          <p className="font-mono-tabular text-2xl font-semibold text-emerald-400">
            {profile?.wins ?? 0}
          </p>
        </div>
        <div className="p-5 space-y-1">
          <p className="text-xs text-slate-400">Confirmed Eliminations</p>
          <p className="font-mono-tabular text-2xl font-semibold text-white">
            {profile?.eliminations ?? 0}
          </p>
        </div>
        <div className="p-5 space-y-1">
          <p className="text-xs text-slate-400">Matches Played</p>
          <p className="font-mono-tabular text-2xl font-semibold text-white">
            {profile?.matchesPlayed ?? 0}
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Profile Form */}
        <section className="lg:col-span-6 bg-[#11161F] border border-slate-800/80 rounded-xl p-6 space-y-5">
          <div className="space-y-1">
            <h2 className="font-display text-2xl font-bold text-white">Competitive Identity</h2>
            <p className="text-xs text-slate-400">
              Your IGN and Game UID are displayed publicly on brackets and leaderboards. Discord is kept private for organizers.
            </p>
          </div>

          {feedback && (
            <div
              className={`p-3 rounded-lg border text-xs ${
                feedback.type === 'ok'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              {feedback.text}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  In-Game Name (IGN)
                </label>
                <input
                  type="text"
                  required
                  minLength={BLUEPRINT_LIMITS.IGN_MIN_LEN}
                  maxLength={BLUEPRINT_LIMITS.IGN_MAX_LEN}
                  value={ign}
                  onChange={(e) => setIgn(e.target.value)}
                  className="w-full bg-[#0D1117] border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Primary Game UID / Tag
                </label>
                <input
                  type="text"
                  required
                  minLength={BLUEPRINT_LIMITS.GAME_UID_MIN_LEN}
                  maxLength={BLUEPRINT_LIMITS.GAME_UID_MAX_LEN}
                  value={gameUid}
                  onChange={(e) => setGameUid(e.target.value)}
                  className="w-full bg-[#0D1117] border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono-tabular text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Primary Title
                </label>
                <select
                  value={favoriteGame}
                  onChange={(e) => setFavoriteGame(e.target.value as GameTitle)}
                  className="w-full bg-[#0D1117] border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {GAMES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Server Region
                </label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value as RegionCode)}
                  className="w-full bg-[#0D1117] border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Discord Handle (Private Contact)
              </label>
              <input
                type="text"
                maxLength={BLUEPRINT_LIMITS.DISCORD_MAX_LEN}
                value={discordHandle}
                onChange={(e) => setDiscordHandle(e.target.value)}
                placeholder="e.g. kaizen_gg"
                className="w-full bg-[#0D1117] border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-slate-950 transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Profile'}</span>
            </button>
          </form>
        </section>

        {/* Registered Tournaments */}
        <section className="lg:col-span-6 bg-[#11161F] border border-slate-800/80 rounded-xl p-6 space-y-5">
          <div className="space-y-1">
            <h2 className="font-display text-2xl font-bold text-white">My Active Entries</h2>
            <p className="text-xs text-slate-400">
              Jump straight to your registered events for check-in and lobby credentials.
            </p>
          </div>

          {myTournaments.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              You have not registered for any tournaments yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/70">
              {myTournaments.map((t) => (
                <div
                  key={t.id}
                  className="py-4 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs text-slate-400">
                      {t.game} · {formatStatusLabel(t.status)} ·{' '}
                      <span className="font-mono-tabular">
                        {formatCurrency(t.prizePool, t.currency)}
                      </span>
                    </p>
                    <p className="font-semibold text-white truncate">{t.title}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectTournament(t.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-orange-500 text-white hover:text-slate-950 transition-colors shrink-0 cursor-pointer"
                  >
                    <span>Open</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
