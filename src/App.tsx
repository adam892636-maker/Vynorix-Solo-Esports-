import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { collection, doc, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from './lib/firebase';
import {
  checkIsAdminRecord,
  ensureUserProfile,
  fetchUserRegisteredTournaments,
  seedStarterLeague,
} from './lib/firestoreService';
import type { Tournament, UserProfile } from './types/tournament';
import { TopNav, type NavTab } from './components/TopNav';
import { TournamentsView } from './components/TournamentsView';
import { TournamentDetailView } from './components/TournamentDetailView';
import { LeaderboardView } from './components/LeaderboardView';
import { PlayerHubView } from './components/PlayerHubView';
import { OrganizerView } from './components/OrganizerView';

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [playerProfile, setPlayerProfile] = useState<UserProfile | null>(null);

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tournamentsLoading, setTournamentsLoading] = useState(true);
  const [players, setPlayers] = useState<UserProfile[]>([]);
  const [playersLoading, setPlayersLoading] = useState(true);

  const [registeredIds, setRegisteredIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<NavTab>('tournaments');
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);

      if (!nextUser) {
        setIsAdmin(false);
        setPlayerProfile(null);
        setRegisteredIds(new Set());
        return;
      }

      const isBootstrapped =
        Boolean(nextUser.emailVerified) &&
        nextUser.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();

      const adminDoc = await checkIsAdminRecord(nextUser.uid);
      setIsAdmin(isBootstrapped || adminDoc);

      try {
        const profile = await ensureUserProfile(nextUser);
        setPlayerProfile(profile);
        const regs = await fetchUserRegisteredTournaments(nextUser.uid);
        setRegisteredIds(new Set(regs));
      } catch (err) {
        console.error(err);
      }
    });

    return () => unsub();
  }, []);

  // Live user profile listener when signed in
  useEffect(() => {
    if (!authReady || !user) return;
    const path = `users/${user.uid}`;
    const unsub = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) {
          setPlayerProfile(snap.data() as UserProfile);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, path)
    );
    return () => unsub();
  }, [authReady, user]);

  // Tournaments listener
  useEffect(() => {
    if (!authReady) return;
    const allowedStatuses = isAdmin
      ? ['registration', 'live', 'completed', 'cancelled']
      : ['registration', 'live', 'completed'];

    const tQuery = query(
      collection(db, 'tournaments'),
      where('status', 'in', allowedStatuses),
      limit(40)
    );

    const unsub = onSnapshot(
      tQuery,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Tournament);
        list.sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() ?? 0;
          const tb = b.createdAt?.toMillis?.() ?? 0;
          return tb - ta;
        });
        setTournaments(list);
        setTournamentsLoading(false);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'tournaments')
    );

    return () => unsub();
  }, [authReady, isAdmin]);

  // Leaderboard players listener
  useEffect(() => {
    if (!authReady) return;
    const uQuery = query(collection(db, 'users'), orderBy('rating', 'desc'), limit(100));
    const unsub = onSnapshot(
      uQuery,
      (snap) => {
        setPlayers(snap.docs.map((d) => d.data() as UserProfile));
        setPlayersLoading(false);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    );

    return () => unsub();
  }, [authReady]);

  const selectedTournament = useMemo(
    () => tournaments.find((t) => t.id === selectedTournamentId) || null,
    [tournaments, selectedTournamentId]
  );

  const liveBracketTournament = useMemo(
    () =>
      tournaments.find((t) => t.format === '1v1_bracket' && t.status === 'live') ||
      tournaments.find((t) => t.format === '1v1_bracket') ||
      null,
    [tournaments]
  );

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Google Sign-In failed.');
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    if (activeTab === 'organizer') {
      setActiveTab('tournaments');
    }
  };

  const handleSelectTab = (tab: NavTab) => {
    setActiveTab(tab);
    if (tab === 'brackets') {
      if (liveBracketTournament) {
        setSelectedTournamentId(liveBracketTournament.id);
      } else {
        setSelectedTournamentId(null);
      }
      return;
    }
    setSelectedTournamentId(null);
  };

  const handleSelectTournament = (id: string) => {
    setSelectedTournamentId(id);
    setActiveTab('tournaments');
  };

  const handleSeedLeague = async () => {
    if (!user || !isAdmin) return;
    await seedStarterLeague(user.uid, playerProfile?.ign || user.displayName || 'Vynorix Org');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#090C10] text-slate-100">
      <TopNav
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        isSignedIn={Boolean(user)}
        isAdmin={isAdmin}
        playerIgn={playerProfile?.ign || user?.displayName || null}
        onSignIn={handleSignIn}
      />

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {authError && (
          <div className="mb-6 p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-sm text-rose-300 flex items-center justify-between gap-4">
            <span>{authError}</span>
            <button
              type="button"
              onClick={() => setAuthError(null)}
              className="text-xs font-medium text-rose-200 hover:text-white cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {selectedTournament ? (
          <TournamentDetailView
            tournament={selectedTournament}
            currentUserUid={user?.uid || null}
            playerProfile={playerProfile}
            isAdmin={isAdmin}
            onBack={() => {
              setSelectedTournamentId(null);
              if (activeTab === 'brackets') setActiveTab('tournaments');
            }}
            onSignIn={handleSignIn}
          />
        ) : activeTab === 'brackets' ? (
          <div className="bg-[#11161F] border border-slate-800/80 rounded-xl p-10 text-center space-y-4">
            <h1 className="font-display text-3xl font-bold text-white">
              No 1v1 Bracket Events Found
            </h1>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              There are no active 1v1 duel brackets scheduled yet. Browse open Battle Royale events or launch a 1v1 tournament from the Organizer Console.
            </p>
            <button
              type="button"
              onClick={() => handleSelectTab('tournaments')}
              className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-orange-500 hover:bg-orange-600 text-slate-950 transition-colors cursor-pointer"
            >
              Browse All Tournaments
            </button>
          </div>
        ) : activeTab === 'leaderboard' ? (
          <LeaderboardView
            players={players}
            loading={playersLoading}
            currentUid={user?.uid}
          />
        ) : activeTab === 'profile' ? (
          <PlayerHubView
            user={user}
            profile={playerProfile}
            tournaments={tournaments}
            onSignIn={handleSignIn}
            onSignOut={handleSignOut}
            onSelectTournament={handleSelectTournament}
          />
        ) : activeTab === 'organizer' && user && isAdmin ? (
          <OrganizerView
            adminUid={user.uid}
            adminName={playerProfile?.ign || user.displayName || 'Vynorix Org'}
            tournaments={tournaments}
            onSelectTournament={handleSelectTournament}
          />
        ) : (
          <TournamentsView
            tournaments={tournaments}
            totalPlayers={players.length}
            loading={tournamentsLoading}
            isAdmin={isAdmin}
            registeredTournamentIds={registeredIds}
            onSelectTournament={handleSelectTournament}
            onOpenLeaderboard={() => handleSelectTab('leaderboard')}
            onOpenOrganizer={() => handleSelectTab('organizer')}
            onSeedLeague={handleSeedLeague}
          />
        )}
      </main>

      <footer className="border-t border-slate-800/80 bg-[#090C10]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <span>Vynorix Solo Esports · Competitive Tournament Circuit</span>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => handleSelectTab('tournaments')}
              className="hover:text-slate-300 transition-colors cursor-pointer"
            >
              Tournaments
            </button>
            <button
              type="button"
              onClick={() => handleSelectTab('leaderboard')}
              className="hover:text-slate-300 transition-colors cursor-pointer"
            >
              Leaderboard
            </button>
            <button
              type="button"
              onClick={() => handleSelectTab('profile')}
              className="hover:text-slate-300 transition-colors cursor-pointer"
            >
              Player Hub
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
