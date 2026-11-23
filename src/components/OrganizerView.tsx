import { useEffect, useState } from 'react';
import { KeyRound, Plus, Sparkles } from 'lucide-react';
import {
  createTournament,
  fetchLobbyCredentials,
  seedStarterLeague,
  updateTournamentStatus,
  upsertLobbyCredentials,
} from '../lib/firestoreService';
import {
  BANNER_KEYS,
  BLUEPRINT_LIMITS,
  CURRENCIES,
  FORMATS,
  formatFormatLabel,
  formatStatusLabel,
  GAMES,
  REGIONS,
} from '../lib/validation';
import type {
  BannerKey,
  CurrencyCode,
  GameTitle,
  RegionCode,
  Tournament,
  TournamentFormat,
  TournamentStatus,
} from '../types/tournament';

interface OrganizerViewProps {
  adminUid: string;
  adminName: string;
  tournaments: Tournament[];
  onSelectTournament: (id: string) => void;
}

export function OrganizerView({
  adminUid,
  adminName,
  tournaments,
  onSelectTournament,
}: OrganizerViewProps) {
  const [title, setTitle] = useState('');
  const [game, setGame] = useState<GameTitle>('BGMI');
  const [format, setFormat] = useState<TournamentFormat>('br_solo');
  const [prizePool, setPrizePool] = useState(10000);
  const [currency, setCurrency] = useState<CurrencyCode>('INR');
  const [entryFee, setEntryFee] = useState(0);
  const [maxPlayers, setMaxPlayers] = useState(32);
  const [region, setRegion] = useState<RegionCode>('IN');
  const [bannerKey, setBannerKey] = useState<BannerKey>('br_showdown');
  const [startTime, setStartTime] = useState(() => {
    const dt = new Date(Date.now() + 2 * 3600000);
    return dt.toISOString().slice(0, 16);
  });
  const [rulesSummary, setRulesSummary] = useState(
    'Solo format. Check in 15 minutes prior to match launch. Third-party tools and teaming are strictly prohibited.'
  );

  // Lobby & Status management for existing event
  const [selectedEventId, setSelectedEventId] = useState(tournaments[0]?.id || '');
  const [nextStatus, setNextStatus] = useState<TournamentStatus>('registration');
  const [winnerIgn, setWinnerIgn] = useState('');
  const [roomId, setRoomId] = useState('');
  const [roomPass, setRoomPass] = useState('');
  const [serverRegion, setServerRegion] = useState('India-West');
  const [lobbyNotes, setLobbyNotes] = useState('');

  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!selectedEventId && tournaments.length > 0) {
      setSelectedEventId(tournaments[0].id);
    }
  }, [tournaments, selectedEventId]);

  useEffect(() => {
    const ev = tournaments.find((t) => t.id === selectedEventId);
    if (!ev) return;
    setNextStatus(ev.status);
    setWinnerIgn(ev.winnerIgn || '');
    fetchLobbyCredentials(ev.id)
      .then((cred) => {
        if (cred) {
          setRoomId(cred.roomId);
          setRoomPass(cred.roomPass);
          setServerRegion(cred.serverRegion);
          setLobbyNotes(cred.notes);
        } else {
          setRoomId('');
          setRoomPass('');
          setServerRegion('India-West');
          setLobbyNotes('');
        }
      })
      .catch(() => {});
  }, [selectedEventId, tournaments]);

  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const isoStart = new Date(startTime).toISOString();
      const newId = await createTournament(adminUid, adminName, {
        title,
        game,
        format,
        prizePool,
        currency,
        entryFee,
        maxPlayers,
        startTime: isoStart,
        region,
        rulesSummary,
        bannerKey,
      });
      setTitle('');
      setSelectedEventId(newId);
      setFeedback({ type: 'ok', text: 'Tournament published and open for solo registrations.' });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to create tournament.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId) return;
    setBusy(true);
    setFeedback(null);
    try {
      await updateTournamentStatus(selectedEventId, nextStatus, winnerIgn);
      if (roomId.trim() && roomPass.trim()) {
        await upsertLobbyCredentials(selectedEventId, {
          roomId,
          roomPass,
          serverRegion,
          notes: lobbyNotes,
        });
      }
      setFeedback({ type: 'ok', text: 'Event status and lobby credentials updated.' });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to update event.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSeedLeague = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      await seedStarterLeague(adminUid, adminName);
      setFeedback({
        type: 'ok',
        text: 'Season 1 starter tournaments, 1v1 brackets, and ranked soloists published.',
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to publish starter pack.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-bold text-white">Organizer Console</h1>
          <p className="text-sm text-slate-400">
            Launch solo tournaments, publish private lobby credentials, and govern live brackets.
          </p>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={handleSeedLeague}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg border border-slate-700 bg-[#11161F] hover:bg-slate-800 text-slate-100 transition-colors cursor-pointer whitespace-nowrap self-start sm:self-auto"
        >
          <Sparkles className="w-3.5 h-3.5 text-orange-400" />
          <span>Publish Season 1 Starter Pack</span>
        </button>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-lg border text-sm ${
            feedback.type === 'ok'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {feedback.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Create Tournament Form */}
        <section className="lg:col-span-7 bg-[#11161F] border border-slate-800/80 rounded-xl p-6 space-y-5">
          <h2 className="font-display text-2xl font-bold text-white">Create Solo Tournament</h2>

          <form onSubmit={handleCreateTournament} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Tournament Title
              </label>
              <input
                type="text"
                required
                minLength={BLUEPRINT_LIMITS.TITLE_MIN_LEN}
                maxLength={BLUEPRINT_LIMITS.TITLE_MAX_LEN}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Vynorix BGMI Midnight Solo Cup"
                className="w-full bg-[#0D1117] border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Game Title</label>
                <select
                  value={game}
                  onChange={(e) => setGame(e.target.value as GameTitle)}
                  className="w-full bg-[#0D1117] border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                >
                  {GAMES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Format</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as TournamentFormat)}
                  className="w-full bg-[#0D1117] border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                >
                  {FORMATS.map((f) => (
                    <option key={f} value={f}>
                      {formatFormatLabel(f)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Region</label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value as RegionCode)}
                  className="w-full bg-[#0D1117] border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                >
                  {REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Prize Pool</label>
                <input
                  type="number"
                  min={0}
                  max={BLUEPRINT_LIMITS.PRIZE_POOL_MAX}
                  value={prizePool}
                  onChange={(e) => setPrizePool(Number(e.target.value) || 0)}
                  className="w-full bg-[#0D1117] border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono-tabular text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                  className="w-full bg-[#0D1117] border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Entry Fee</label>
                <input
                  type="number"
                  min={0}
                  max={BLUEPRINT_LIMITS.ENTRY_FEE_MAX}
                  value={entryFee}
                  onChange={(e) => setEntryFee(Number(e.target.value) || 0)}
                  className="w-full bg-[#0D1117] border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono-tabular text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Max Slots</label>
                <input
                  type="number"
                  min={BLUEPRINT_LIMITS.MAX_PLAYERS_MIN}
                  max={BLUEPRINT_LIMITS.MAX_PLAYERS_MAX}
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(Number(e.target.value) || 16)}
                  className="w-full bg-[#0D1117] border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono-tabular text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Start Time</label>
                <input
                  type="datetime-local"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-[#0D1117] border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono-tabular text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Arena Banner</label>
                <select
                  value={bannerKey}
                  onChange={(e) => setBannerKey(e.target.value as BannerKey)}
                  className="w-full bg-[#0D1117] border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                >
                  {BANNER_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {key === 'br_showdown'
                        ? 'Battle Royale Canyon'
                        : key === 'duel_arena'
                          ? '1v1 Tactical Arena'
                          : 'Main Championship Stage'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Ruleset &amp; Scoring Summary
              </label>
              <textarea
                rows={3}
                required
                minLength={BLUEPRINT_LIMITS.RULES_MIN_LEN}
                maxLength={BLUEPRINT_LIMITS.RULES_MAX_LEN}
                value={rulesSummary}
                onChange={(e) => setRulesSummary(e.target.value)}
                className="w-full bg-[#0D1117] border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-slate-950 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{busy ? 'Creating...' : 'Launch Tournament'}</span>
            </button>
          </form>
        </section>

        {/* Lobby & Status Governance */}
        <section className="lg:col-span-5 bg-[#11161F] border border-slate-800/80 rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-orange-400" />
            <h2 className="font-display text-2xl font-bold text-white">
              Event Status &amp; Lobby
            </h2>
          </div>

          {tournaments.length === 0 ? (
            <p className="text-sm text-slate-400">
              Create a tournament or publish the starter pack to configure lobby credentials.
            </p>
          ) : (
            <form onSubmit={handleUpdateEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Select Event
                </label>
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="w-full bg-[#0D1117] border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                >
                  {tournaments.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({formatStatusLabel(t.status)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Lifecycle Status
                  </label>
                  <select
                    value={nextStatus}
                    onChange={(e) => setNextStatus(e.target.value as TournamentStatus)}
                    className="w-full bg-[#0D1117] border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="registration">Open Registration</option>
                    <option value="live">Live Match</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Champion IGN (if completed)
                  </label>
                  <input
                    type="text"
                    maxLength={BLUEPRINT_LIMITS.IGN_MAX_LEN}
                    value={winnerIgn}
                    onChange={(e) => setWinnerIgn(e.target.value)}
                    placeholder="Optional"
                    className="w-full bg-[#0D1117] border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 space-y-3">
                <p className="text-xs font-semibold text-slate-300">
                  Private Lobby Credentials (Registered Players Only)
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Room ID</label>
                    <input
                      type="text"
                      maxLength={BLUEPRINT_LIMITS.ROOM_CRED_MAX_LEN}
                      value={roomId}
                      onChange={(e) => setRoomId(e.target.value)}
                      placeholder="e.g. 8841209"
                      className="w-full bg-[#0D1117] border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono-tabular text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Password</label>
                    <input
                      type="text"
                      maxLength={BLUEPRINT_LIMITS.ROOM_CRED_MAX_LEN}
                      value={roomPass}
                      onChange={(e) => setRoomPass(e.target.value)}
                      placeholder="e.g. VNX99"
                      className="w-full bg-[#0D1117] border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono-tabular text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Server Region</label>
                  <input
                    type="text"
                    maxLength={BLUEPRINT_LIMITS.ROOM_CRED_MAX_LEN}
                    value={serverRegion}
                    onChange={(e) => setServerRegion(e.target.value)}
                    className="w-full bg-[#0D1117] border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Lobby Instructions</label>
                  <input
                    type="text"
                    maxLength={BLUEPRINT_LIMITS.LOBBY_NOTES_MAX_LEN}
                    value={lobbyNotes}
                    onChange={(e) => setLobbyNotes(e.target.value)}
                    placeholder="Join 10 minutes before launch."
                    className="w-full bg-[#0D1117] border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 py-2.5 px-4 text-xs font-semibold rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-slate-950 transition-colors cursor-pointer"
                >
                  Save Event &amp; Lobby
                </button>
                <button
                  type="button"
                  onClick={() => onSelectTournament(selectedEventId)}
                  className="py-2.5 px-4 text-xs font-medium rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Open Event
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
