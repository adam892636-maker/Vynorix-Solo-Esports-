import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  KeyRound,
  ShieldCheck,
  Swords,
  Users,
} from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  adminUpdateMatchResult,
  adminUpdateRegistrationStanding,
  checkInRegistration,
  fetchLobbyCredentials,
  generateSingleElimBracket,
  registerForTournament,
  reportLiveMatchScore,
  withdrawFromTournament,
} from '../lib/firestoreService';
import {
  BANNER_ASSETS,
  BLUEPRINT_LIMITS,
  formatCurrency,
  formatFormatLabel,
  formatStatusLabel,
  HERO_IMAGE,
} from '../lib/validation';
import type {
  MatchStatus,
  RegistrationStatus,
  Tournament,
  TournamentLobby,
  TournamentMatch,
  TournamentRegistration,
  UserProfile,
} from '../types/tournament';
import { ResilientImage } from './ResilientImage';

interface TournamentDetailViewProps {
  tournament: Tournament;
  currentUserUid: string | null;
  playerProfile: UserProfile | null;
  isAdmin: boolean;
  onBack: () => void;
  onSignIn: () => void;
}

export function TournamentDetailView({
  tournament,
  currentUserUid,
  playerProfile,
  isAdmin,
  onBack,
  onSignIn,
}: TournamentDetailViewProps) {
  const [registrations, setRegistrations] = useState<TournamentRegistration[]>([]);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [lobby, setLobby] = useState<TournamentLobby | null>(null);
  const [activeTab, setActiveTab] = useState<'bracket' | 'standings' | 'rules'>(
    tournament.format === '1v1_bracket' ? 'bracket' : 'standings'
  );

  const [ignInput, setIgnInput] = useState(playerProfile?.ign || '');
  const [gameUidInput, setGameUidInput] = useState(playerProfile?.gameUid || '');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Match score editing state (matchId -> scores)
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, { p1: number; p2: number }>>({});
  // Standing row editing state (userId -> stats)
  const [standingDrafts, setStandingDrafts] = useState<
    Record<string, { kills: number; placement: number; points: number; status: RegistrationStatus }>
  >({});

  useEffect(() => {
    if (playerProfile) {
      setIgnInput((prev) => prev || playerProfile.ign);
      setGameUidInput((prev) => prev || playerProfile.gameUid);
    }
  }, [playerProfile]);

  useEffect(() => {
    setActiveTab(tournament.format === '1v1_bracket' ? 'bracket' : 'standings');
  }, [tournament.id, tournament.format]);

  useEffect(() => {
    const regPath = `tournaments/${tournament.id}/registrations`;
    const regQuery = query(
      collection(db, 'tournaments', tournament.id, 'registrations'),
      where('tournamentId', '==', tournament.id)
    );
    const unsubRegs = onSnapshot(
      regQuery,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as TournamentRegistration);
        list.sort(
          (a, b) =>
            b.points - a.points ||
            (a.placement || 999) - (b.placement || 999) ||
            b.kills - a.kills ||
            a.seed - b.seed
        );
        setRegistrations(list);

        const nextDrafts: Record<
          string,
          { kills: number; placement: number; points: number; status: RegistrationStatus }
        > = {};
        list.forEach((r) => {
          nextDrafts[r.userId] = {
            kills: r.kills,
            placement: r.placement,
            points: r.points,
            status: r.status,
          };
        });
        setStandingDrafts(nextDrafts);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, regPath)
    );

    const matchPath = `tournaments/${tournament.id}/matches`;
    const matchQuery = query(
      collection(db, 'tournaments', tournament.id, 'matches'),
      where('tournamentId', '==', tournament.id)
    );
    const unsubMatches = onSnapshot(
      matchQuery,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as TournamentMatch);
        list.sort((a, b) => a.round - b.round || a.matchNumber - b.matchNumber);
        setMatches(list);

        const drafts: Record<string, { p1: number; p2: number }> = {};
        list.forEach((m) => {
          drafts[m.matchId] = { p1: m.player1Score, p2: m.player2Score };
        });
        setScoreDrafts(drafts);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, matchPath)
    );

    return () => {
      unsubRegs();
      unsubMatches();
    };
  }, [tournament.id]);

  const myRegistration = useMemo(
    () => registrations.find((r) => r.userId === currentUserUid) || null,
    [registrations, currentUserUid]
  );

  useEffect(() => {
    let active = true;
    if (!currentUserUid || (!myRegistration && !isAdmin)) {
      setLobby(null);
      return;
    }
    fetchLobbyCredentials(tournament.id)
      .then((res) => {
        if (active) setLobby(res);
      })
      .catch(() => {
        if (active) setLobby(null);
      });
    return () => {
      active = false;
    };
  }, [tournament.id, currentUserUid, myRegistration, isAdmin]);

  const rounds = useMemo(() => {
    const grouped = new Map<number, TournamentMatch[]>();
    matches.forEach((m) => {
      const arr = grouped.get(m.round) || [];
      arr.push(m);
      grouped.set(m.round, arr);
    });
    return Array.from(grouped.entries()).sort((a, b) => a[0] - b[0]);
  }, [matches]);

  const copyValue = async (key: string, val: string) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      // Clipboard blocked in some contexts
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserUid) {
      onSignIn();
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      await registerForTournament(tournament.id, currentUserUid, ignInput, gameUidInput);
      setFeedback({ type: 'ok', text: 'Solo entry confirmed. Check in before match start.' });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to register.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleWithdraw = async () => {
    if (!currentUserUid) return;
    setBusy(true);
    setFeedback(null);
    try {
      await withdrawFromTournament(tournament.id, currentUserUid);
      setFeedback({ type: 'ok', text: 'Entry withdrawn and slot released.' });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to withdraw.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCheckIn = async () => {
    if (!currentUserUid) return;
    setBusy(true);
    setFeedback(null);
    try {
      await checkInRegistration(tournament.id, currentUserUid);
      setFeedback({ type: 'ok', text: 'Player check-in verified.' });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to check in.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleParticipantScoreReport = async (match: TournamentMatch) => {
    const draft = scoreDrafts[match.matchId] || { p1: match.player1Score, p2: match.player2Score };
    setBusy(true);
    setFeedback(null);
    try {
      await reportLiveMatchScore(tournament.id, match.matchId, draft.p1, draft.p2);
      setFeedback({ type: 'ok', text: 'Live score updated. Organizer will finalize winner.' });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to update score.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleAdminMatchFinalize = async (
    match: TournamentMatch,
    winnerSlot: 'p1' | 'p2' | 'live'
  ) => {
    const draft = scoreDrafts[match.matchId] || { p1: match.player1Score, p2: match.player2Score };
    setBusy(true);
    setFeedback(null);
    try {
      const status: MatchStatus = winnerSlot === 'live' ? 'live' : 'completed';
      const winnerId =
        winnerSlot === 'p1' ? match.player1Id : winnerSlot === 'p2' ? match.player2Id : '';
      const winnerIgn =
        winnerSlot === 'p1' ? match.player1Ign : winnerSlot === 'p2' ? match.player2Ign : '';
      await adminUpdateMatchResult(
        tournament.id,
        match,
        {
          player1Score: draft.p1,
          player2Score: draft.p2,
          status,
          winnerId,
          winnerIgn,
        },
        matches
      );
      setFeedback({
        type: 'ok',
        text:
          status === 'completed'
            ? `${winnerIgn} advanced to next round.`
            : 'Match status updated.',
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to update match.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleAdminGenerateBracket = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      await generateSingleElimBracket(tournament.id, registrations);
      setFeedback({ type: 'ok', text: '1v1 single-elimination bracket generated.' });
      setActiveTab('bracket');
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to generate bracket.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSaveStanding = async (userId: string) => {
    const draft = standingDrafts[userId];
    if (!draft) return;
    setBusy(true);
    setFeedback(null);
    try {
      await adminUpdateRegistrationStanding(tournament.id, userId, draft);
      setFeedback({ type: 'ok', text: 'Player standing updated.' });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to update standing.',
      });
    } finally {
      setBusy(false);
    }
  };

  const roundLabel = (round: number, totalRounds: number) => {
    if (round === totalRounds && totalRounds >= 2) return 'Grand Final';
    if (round === totalRounds - 1 && totalRounds >= 3) return 'Semifinals';
    if (round === totalRounds - 2 && totalRounds >= 4) return 'Quarterfinals';
    return `Round ${round}`;
  };

  const totalSlotsFilled = Math.min(
    100,
    Math.round((tournament.registeredCount / Math.max(1, tournament.maxPlayers)) * 100)
  );

  return (
    <div className="space-y-8">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Tournaments</span>
      </button>

      {/* Event Header Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8 bg-[#11161F] border border-slate-800/80 rounded-xl overflow-hidden flex flex-col justify-between">
          <div className="relative h-52 sm:h-60 overflow-hidden">
            <ResilientImage
              src={BANNER_ASSETS[tournament.bannerKey] || HERO_IMAGE}
              alt={tournament.title}
              className="w-full h-full object-cover"
              fallbackTitle={tournament.title}
            />
            <div
              className="absolute inset-0 bg-gradient-to-t from-[#11161F] via-[#11161F]/40 to-transparent"
              aria-hidden="true"
            />
            <div className="absolute bottom-5 left-6 right-6 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                <span>{tournament.game}</span>
                <span aria-hidden="true">·</span>
                <span>{formatFormatLabel(tournament.format)}</span>
                <span aria-hidden="true">·</span>
                <span>{tournament.region}</span>
                <span aria-hidden="true">·</span>
                <span
                  className={
                    tournament.status === 'live'
                      ? 'text-emerald-400 font-semibold'
                      : tournament.status === 'registration'
                        ? 'text-orange-400 font-semibold'
                        : 'text-slate-300 font-semibold'
                  }
                >
                  {formatStatusLabel(tournament.status)}
                </span>
              </div>
              <h1
                className="font-display text-3xl sm:text-4xl font-bold text-white leading-tight"
                style={{ textWrap: 'balance' }}
              >
                {tournament.title}
              </h1>
            </div>
          </div>

          <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-5 border-t border-slate-800/80">
            <div>
              <p className="text-xs text-slate-400">Prize Pool</p>
              <p className="font-mono-tabular text-xl font-semibold text-white mt-0.5">
                {formatCurrency(tournament.prizePool, tournament.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Entry Fee</p>
              <p className="font-mono-tabular text-xl font-semibold text-slate-200 mt-0.5">
                {formatCurrency(tournament.entryFee, tournament.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Registered Slots</p>
              <p className="font-mono-tabular text-xl font-semibold text-slate-200 mt-0.5">
                {tournament.registeredCount} / {tournament.maxPlayers}
              </p>
              <div className="mt-2 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500 transition-transform origin-left"
                  style={{ width: `${totalSlotsFilled}%` }}
                />
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-400">Start Schedule</p>
              <p className="font-mono-tabular text-sm font-medium text-slate-200 mt-1">
                {new Date(tournament.startTime).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Solo Registration & Lobby Access Panel */}
        <div className="lg:col-span-4 bg-[#11161F] border border-slate-800/80 rounded-xl p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold text-white">Solo Entry</h2>
              {tournament.winnerIgn && (
                <span className="text-xs font-semibold text-emerald-400">
                  Champion: {tournament.winnerIgn}
                </span>
              )}
            </div>

            {feedback && (
              <div
                className={`p-3 rounded-lg border text-xs leading-relaxed ${
                  feedback.type === 'ok'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}
              >
                {feedback.text}
              </div>
            )}

            {!currentUserUid ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-400 leading-relaxed">
                  Sign in with your verified Google account to lock your solo slot and view private lobby codes.
                </p>
                <button
                  type="button"
                  onClick={onSignIn}
                  className="w-full py-2.5 px-4 text-sm font-semibold rounded-lg bg-orange-500 hover:bg-orange-600 text-slate-950 transition-colors cursor-pointer"
                >
                  Sign In to Register
                </button>
              </div>
            ) : myRegistration ? (
              <div className="space-y-4">
                <div className="bg-[#0D1117] border border-slate-800/80 rounded-lg p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Registered IGN</span>
                    <span className="font-semibold text-white">{myRegistration.ign}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Game UID</span>
                    <span className="font-mono-tabular text-slate-200">{myRegistration.gameUid}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Status</span>
                    <span
                      className={
                        myRegistration.checkedIn ? 'text-emerald-400 font-semibold' : 'text-orange-400 font-semibold'
                      }
                    >
                      {formatStatusLabel(myRegistration.status)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {!myRegistration.checkedIn &&
                    (tournament.status === 'registration' || tournament.status === 'live') && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={handleCheckIn}
                        className="flex-1 py-2.5 px-4 text-xs font-semibold rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-slate-950 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Check In Now
                      </button>
                    )}

                  {tournament.status === 'registration' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleWithdraw}
                      className="py-2.5 px-4 text-xs font-medium rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Withdraw
                    </button>
                  )}
                </div>
              </div>
            ) : tournament.status !== 'registration' ? (
              <p className="text-sm text-slate-400">
                Registration is closed for this tournament. Track live brackets and standings below.
              </p>
            ) : tournament.registeredCount >= tournament.maxPlayers ? (
              <p className="text-sm text-amber-400">
                All solo slots are currently full ({tournament.registeredCount} / {tournament.maxPlayers}).
              </p>
            ) : (
              <form onSubmit={handleRegister} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    In-Game Name (IGN)
                  </label>
                  <input
                    type="text"
                    required
                    minLength={BLUEPRINT_LIMITS.IGN_MIN_LEN}
                    maxLength={BLUEPRINT_LIMITS.IGN_MAX_LEN}
                    value={ignInput}
                    onChange={(e) => setIgnInput(e.target.value)}
                    placeholder="e.g. KaizenX"
                    className="w-full bg-[#0D1117] border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    {tournament.game} UID / Tag
                  </label>
                  <input
                    type="text"
                    required
                    minLength={BLUEPRINT_LIMITS.GAME_UID_MIN_LEN}
                    maxLength={BLUEPRINT_LIMITS.GAME_UID_MAX_LEN}
                    value={gameUidInput}
                    onChange={(e) => setGameUidInput(e.target.value)}
                    placeholder="e.g. 5190482711 or TAG#01"
                    className="w-full bg-[#0D1117] border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono-tabular text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-2.5 px-4 text-sm font-semibold rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-slate-950 transition-colors cursor-pointer"
                >
                  {busy ? 'Locking Slot...' : 'Confirm Solo Entry'}
                </button>
              </form>
            )}
          </div>

          {/* Private Lobby Credentials (Registered Players & Admins Only) */}
          {(myRegistration || isAdmin) && (
            <div className="pt-4 border-t border-slate-800/80 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <KeyRound className="w-3.5 h-3.5 text-orange-400" />
                <span>Private Lobby Room</span>
              </div>

              {lobby ? (
                <div className="bg-[#0D1117] border border-slate-800/80 rounded-lg p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Room ID</span>
                    <button
                      type="button"
                      onClick={() => copyValue('roomId', lobby.roomId)}
                      className="inline-flex items-center gap-1.5 font-mono-tabular font-semibold text-white hover:text-orange-400 cursor-pointer"
                    >
                      <span>{lobby.roomId}</span>
                      {copiedKey === 'roomId' ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3 text-slate-500" />
                      )}
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Password</span>
                    <button
                      type="button"
                      onClick={() => copyValue('roomPass', lobby.roomPass)}
                      className="inline-flex items-center gap-1.5 font-mono-tabular font-semibold text-white hover:text-orange-400 cursor-pointer"
                    >
                      <span>{lobby.roomPass}</span>
                      {copiedKey === 'roomPass' ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3 text-slate-500" />
                      )}
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Server</span>
                    <span className="text-slate-200">{lobby.serverRegion}</span>
                  </div>
                  {lobby.notes && (
                    <p className="text-slate-400 pt-1 border-t border-slate-800/60 leading-relaxed">
                      {lobby.notes}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Lobby Room ID &amp; Password will be published 15 minutes before match start.
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Workspace Tabs & Admin Quick Bracket Trigger */}
      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-1 p-1 bg-[#11161F] border border-slate-800/80 rounded-lg">
            {tournament.format === '1v1_bracket' && (
              <button
                type="button"
                onClick={() => setActiveTab('bracket')}
                className={`inline-flex items-center gap-2 px-4 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === 'bracket'
                    ? 'bg-orange-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Swords className="w-3.5 h-3.5" />
                <span>1v1 Bracket</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab('standings')}
              className={`inline-flex items-center gap-2 px-4 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'standings'
                  ? 'bg-orange-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Roster &amp; Standings ({registrations.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('rules')}
              className={`inline-flex items-center gap-2 px-4 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'rules'
                  ? 'bg-orange-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Rules &amp; Scoring</span>
            </button>
          </div>

          {isAdmin && tournament.format === '1v1_bracket' && (
            <button
              type="button"
              disabled={busy || registrations.length < 2}
              onClick={handleAdminGenerateBracket}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-orange-500 text-white hover:text-slate-950 disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap"
            >
              Generate / Reset 1v1 Bracket
            </button>
          )}
        </div>

        {/* Tab 1: 1v1 Single-Elimination Bracket */}
        {activeTab === 'bracket' && (
          <div className="space-y-4">
            {rounds.length === 0 ? (
              <div className="bg-[#11161F] border border-slate-800/80 rounded-xl p-10 text-center space-y-3">
                <h3 className="font-display text-2xl font-bold text-white">
                  Bracket Pending Seeding
                </h3>
                <p className="text-sm text-slate-400 max-w-md mx-auto">
                  The 1v1 pairings will populate automatically once registration closes and the organizer seeds the bracket.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto pb-4">
                <div className="flex gap-6 min-w-max">
                  {rounds.map(([roundNum, roundMatches]) => (
                    <div key={roundNum} className="w-80 space-y-4">
                      <div className="flex items-center justify-between px-1">
                        <h3 className="font-display text-xl font-bold text-white">
                          {roundLabel(roundNum, rounds.length)}
                        </h3>
                        <span className="font-mono-tabular text-xs text-slate-500">
                          {roundMatches.length} {roundMatches.length === 1 ? 'Match' : 'Matches'}
                        </span>
                      </div>

                      <div className="space-y-4">
                        {roundMatches.map((m) => {
                          const isParticipant =
                            currentUserUid &&
                            (m.player1Id === currentUserUid || m.player2Id === currentUserUid);
                          const canReportLive = Boolean(isParticipant && m.status === 'live');
                          const draft = scoreDrafts[m.matchId] || {
                            p1: m.player1Score,
                            p2: m.player2Score,
                          };

                          return (
                            <div
                              key={m.matchId}
                              className="bg-[#11161F] border border-slate-800/80 rounded-xl p-4 space-y-3"
                            >
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-mono-tabular text-slate-500">
                                  Match #{m.matchNumber}
                                </span>
                                <span
                                  className={
                                    m.status === 'live'
                                      ? 'text-emerald-400 font-semibold'
                                      : m.status === 'completed'
                                        ? 'text-slate-400'
                                        : 'text-amber-400'
                                  }
                                >
                                  {formatStatusLabel(m.status)}
                                </span>
                              </div>

                              <div className="divide-y divide-slate-800/60 border border-slate-800/80 rounded-lg overflow-hidden">
                                {/* Player 1 */}
                                <div
                                  className={`px-3 py-2.5 flex items-center justify-between gap-2 ${
                                    m.winnerId && m.winnerId === m.player1Id
                                      ? 'bg-emerald-500/10'
                                      : 'bg-[#0D1117]'
                                  }`}
                                >
                                  <span
                                    className={`text-sm truncate ${
                                      m.winnerId && m.winnerId === m.player1Id
                                        ? 'font-semibold text-emerald-300'
                                        : 'text-slate-200'
                                    }`}
                                  >
                                    {m.player1Ign || 'TBD'}
                                  </span>
                                  {isAdmin || canReportLive ? (
                                    <input
                                      type="number"
                                      min={0}
                                      max={999}
                                      value={draft.p1}
                                      onChange={(e) =>
                                        setScoreDrafts((prev) => ({
                                          ...prev,
                                          [m.matchId]: {
                                            ...draft,
                                            p1: Number(e.target.value) || 0,
                                          },
                                        }))
                                      }
                                      aria-label={`${m.player1Ign} score`}
                                      className="w-14 bg-[#11161F] border border-slate-700 rounded px-2 py-1 text-right font-mono-tabular text-xs text-white"
                                    />
                                  ) : (
                                    <span className="font-mono-tabular text-sm font-semibold text-white">
                                      {m.player1Score}
                                    </span>
                                  )}
                                </div>

                                {/* Player 2 */}
                                <div
                                  className={`px-3 py-2.5 flex items-center justify-between gap-2 ${
                                    m.winnerId && m.winnerId === m.player2Id
                                      ? 'bg-emerald-500/10'
                                      : 'bg-[#0D1117]'
                                  }`}
                                >
                                  <span
                                    className={`text-sm truncate ${
                                      m.winnerId && m.winnerId === m.player2Id
                                        ? 'font-semibold text-emerald-300'
                                        : 'text-slate-200'
                                    }`}
                                  >
                                    {m.player2Ign || 'TBD'}
                                  </span>
                                  {isAdmin || canReportLive ? (
                                    <input
                                      type="number"
                                      min={0}
                                      max={999}
                                      value={draft.p2}
                                      onChange={(e) =>
                                        setScoreDrafts((prev) => ({
                                          ...prev,
                                          [m.matchId]: {
                                            ...draft,
                                            p2: Number(e.target.value) || 0,
                                          },
                                        }))
                                      }
                                      aria-label={`${m.player2Ign} score`}
                                      className="w-14 bg-[#11161F] border border-slate-700 rounded px-2 py-1 text-right font-mono-tabular text-xs text-white"
                                    />
                                  ) : (
                                    <span className="font-mono-tabular text-sm font-semibold text-white">
                                      {m.player2Score}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {canReportLive && !isAdmin && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => handleParticipantScoreReport(m)}
                                  className="w-full py-1.5 text-xs font-semibold rounded-lg bg-orange-500 hover:bg-orange-600 text-slate-950 transition-colors cursor-pointer"
                                >
                                  Submit Live Score
                                </button>
                              )}

                              {isAdmin && m.player1Id && m.player2Id && (
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => handleAdminMatchFinalize(m, 'live')}
                                    className="px-2.5 py-1 text-[11px] font-medium rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                                  >
                                    Set Live
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => handleAdminMatchFinalize(m, 'p1')}
                                    className="px-2.5 py-1 text-[11px] font-semibold rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 cursor-pointer"
                                  >
                                    Win: {m.player1Ign}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => handleAdminMatchFinalize(m, 'p2')}
                                    className="px-2.5 py-1 text-[11px] font-semibold rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 cursor-pointer"
                                  >
                                    Win: {m.player2Ign}
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Roster & Battle Royale Standings */}
        {activeTab === 'standings' && (
          <div className="bg-[#11161F] border border-slate-800/80 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800/80 text-xs font-medium text-slate-400">
                    <th className="py-3.5 px-4">#</th>
                    <th className="py-3.5 px-4">Player IGN</th>
                    <th className="py-3.5 px-4">Game UID</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Kills</th>
                    <th className="py-3.5 px-4 text-right">Placement</th>
                    <th className="py-3.5 px-4 text-right">Points</th>
                    {isAdmin && <th className="py-3.5 px-4 text-right">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {registrations.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 8 : 7} className="py-10 px-4 text-center text-slate-400">
                        No soloists registered yet. Claim the first slot above.
                      </td>
                    </tr>
                  ) : (
                    registrations.map((reg, idx) => {
                      const draft = standingDrafts[reg.userId] || {
                        kills: reg.kills,
                        placement: reg.placement,
                        points: reg.points,
                        status: reg.status,
                      };
                      const isSelf = reg.userId === currentUserUid;
                      return (
                        <tr
                          key={reg.userId}
                          className={`hover:bg-slate-800/35 transition-colors ${
                            isSelf ? 'bg-orange-500/10' : ''
                          }`}
                        >
                          <td className="py-3 px-4 font-mono-tabular text-xs text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-4 font-semibold text-white">
                            {reg.ign}
                            {isSelf && (
                              <span className="ml-2 text-xs font-normal text-orange-400">(You)</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono-tabular text-xs text-slate-400">
                            {reg.gameUid}
                          </td>
                          <td className="py-3 px-4 text-xs">
                            {isAdmin ? (
                              <select
                                value={draft.status}
                                onChange={(e) =>
                                  setStandingDrafts((prev) => ({
                                    ...prev,
                                    [reg.userId]: {
                                      ...draft,
                                      status: e.target.value as RegistrationStatus,
                                    },
                                  }))
                                }
                                className="bg-[#0D1117] border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                              >
                                <option value="registered">Registered</option>
                                <option value="checked_in">Checked In</option>
                                <option value="eliminated">Eliminated</option>
                                <option value="winner">Champion</option>
                              </select>
                            ) : (
                              <span
                                className={
                                  reg.status === 'winner' || reg.status === 'checked_in'
                                    ? 'text-emerald-400 font-medium'
                                    : reg.status === 'eliminated'
                                      ? 'text-rose-400'
                                      : 'text-slate-300'
                                }
                              >
                                {formatStatusLabel(reg.status)}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular text-slate-200">
                            {isAdmin ? (
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={draft.kills}
                                onChange={(e) =>
                                  setStandingDrafts((prev) => ({
                                    ...prev,
                                    [reg.userId]: {
                                      ...draft,
                                      kills: Number(e.target.value) || 0,
                                    },
                                  }))
                                }
                                className="w-16 bg-[#0D1117] border border-slate-700 rounded px-2 py-1 text-right text-xs"
                              />
                            ) : (
                              reg.kills
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular text-slate-300">
                            {isAdmin ? (
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={draft.placement}
                                onChange={(e) =>
                                  setStandingDrafts((prev) => ({
                                    ...prev,
                                    [reg.userId]: {
                                      ...draft,
                                      placement: Number(e.target.value) || 0,
                                    },
                                  }))
                                }
                                className="w-16 bg-[#0D1117] border border-slate-700 rounded px-2 py-1 text-right text-xs"
                              />
                            ) : reg.placement > 0 ? (
                              `#${reg.placement}`
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-white">
                            {isAdmin ? (
                              <input
                                type="number"
                                min={0}
                                max={1000}
                                value={draft.points}
                                onChange={(e) =>
                                  setStandingDrafts((prev) => ({
                                    ...prev,
                                    [reg.userId]: {
                                      ...draft,
                                      points: Number(e.target.value) || 0,
                                    },
                                  }))
                                }
                                className="w-16 bg-[#0D1117] border border-slate-700 rounded px-2 py-1 text-right text-xs"
                              />
                            ) : (
                              reg.points
                            )}
                          </td>
                          {isAdmin && (
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleSaveStanding(reg.userId)}
                                className="px-3 py-1 text-xs font-semibold rounded bg-orange-500 hover:bg-orange-600 text-slate-950 cursor-pointer"
                              >
                                Save
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Rules & Format */}
        {activeTab === 'rules' && (
          <div className="bg-[#11161F] border border-slate-800/80 rounded-xl p-6 sm:p-8 space-y-6">
            <div className="space-y-2">
              <h3 className="font-display text-2xl font-bold text-white">
                Official Event Ruleset
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                {tournament.rulesSummary}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-5 border-t border-slate-800/80 text-sm">
              <div>
                <p className="text-xs text-slate-500">Organizer</p>
                <p className="font-medium text-white mt-1">{tournament.organizerName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Competition Format</p>
                <p className="font-medium text-white mt-1">
                  {formatFormatLabel(tournament.format)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Check-In Policy</p>
                <p className="font-medium text-white mt-1">
                  Mandatory 15 minutes before drop
                </p>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
