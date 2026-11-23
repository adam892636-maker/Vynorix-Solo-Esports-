import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  BLUEPRINT_LIMITS,
  sanitizeId,
  validateGameUid,
  validateIgn,
  validateTournamentInput,
} from './validation';
import type {
  BannerKey,
  CurrencyCode,
  GameTitle,
  MatchStatus,
  RegionCode,
  RegistrationStatus,
  Tournament,
  TournamentFormat,
  TournamentLobby,
  TournamentMatch,
  TournamentRegistration,
  TournamentStatus,
  UserPrivateInfo,
  UserProfile,
} from '../types/tournament';

export async function ensureUserProfile(user: User): Promise<UserProfile> {
  const userPath = `users/${user.uid}`;
  const privatePath = `users/${user.uid}/private/info`;

  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }

    const rawName = (user.displayName || user.email?.split('@')[0] || 'Soloist')
      .replace(/[^a-zA-Z0-9_.\- ]/g, '')
      .trim()
      .slice(0, BLUEPRINT_LIMITS.IGN_MAX_LEN);
    const defaultIgn = rawName.length >= 2 ? rawName : 'VynorixPlayer';
    const defaultGameUid = `VNX-${user.uid.slice(0, 6).toUpperCase()}`;

    const profilePayload: UserProfile = {
      uid: user.uid,
      ign: defaultIgn,
      gameUid: defaultGameUid,
      region: 'IN',
      favoriteGame: 'BGMI',
      rating: 1000,
      wins: 0,
      eliminations: 0,
      matchesPlayed: 0,
    };

    const batch = writeBatch(db);
    batch.set(doc(db, 'users', user.uid), {
      ...profilePayload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'users', user.uid, 'private', 'info'), {
      uid: user.uid,
      email: (user.email || 'unknown@vynorix.gg').slice(0, BLUEPRINT_LIMITS.EMAIL_MAX_LEN),
      discordHandle: '',
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
    return profilePayload;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${userPath} & ${privatePath}`);
  }
}

export async function fetchUserPrivateInfo(uid: string): Promise<UserPrivateInfo | null> {
  const path = `users/${uid}/private/info`;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'private', 'info'));
    return snap.exists() ? (snap.data() as UserPrivateInfo) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function checkIsAdminRecord(uid: string): Promise<boolean> {
  const path = `admins/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'admins', uid));
    return snap.exists();
  } catch {
    return false;
  }
}

export async function updatePlayerProfile(
  uid: string,
  input: {
    ign: string;
    gameUid: string;
    region: RegionCode;
    favoriteGame: GameTitle;
    discordHandle: string;
    email: string;
  }
): Promise<void> {
  const ignCheck = validateIgn(input.ign);
  if (!ignCheck.valid) throw new Error(ignCheck.error);
  const uidCheck = validateGameUid(input.gameUid);
  if (!uidCheck.valid) throw new Error(uidCheck.error);

  const discord = input.discordHandle.trim().slice(0, BLUEPRINT_LIMITS.DISCORD_MAX_LEN);
  const email = input.email.trim().slice(0, BLUEPRINT_LIMITS.EMAIL_MAX_LEN) || 'unknown@vynorix.gg';

  const batch = writeBatch(db);
  batch.update(doc(db, 'users', uid), {
    ign: ignCheck.value,
    gameUid: uidCheck.value,
    region: input.region,
    favoriteGame: input.favoriteGame,
    updatedAt: serverTimestamp(),
  });

  const privateRef = doc(db, 'users', uid, 'private', 'info');
  batch.set(
    privateRef,
    {
      uid,
      email,
      discordHandle: discord,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}

export async function registerForTournament(
  tournamentId: string,
  userId: string,
  rawIgn: string,
  rawGameUid: string
): Promise<void> {
  const ignCheck = validateIgn(rawIgn);
  if (!ignCheck.valid) throw new Error(ignCheck.error);
  const uidCheck = validateGameUid(rawGameUid);
  if (!uidCheck.valid) throw new Error(uidCheck.error);

  const regRef = doc(db, 'tournaments', tournamentId, 'registrations', userId);
  const tourneyRef = doc(db, 'tournaments', tournamentId);

  const batch = writeBatch(db);
  batch.set(regRef, {
    tournamentId,
    userId,
    ign: ignCheck.value,
    gameUid: uidCheck.value,
    seed: 0,
    checkedIn: false,
    status: 'registered' as RegistrationStatus,
    kills: 0,
    placement: 0,
    points: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.update(tourneyRef, {
    registeredCount: increment(1),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `tournaments/${tournamentId}/registrations/${userId}`);
  }
}

export async function withdrawFromTournament(tournamentId: string, userId: string): Promise<void> {
  const regRef = doc(db, 'tournaments', tournamentId, 'registrations', userId);
  const tourneyRef = doc(db, 'tournaments', tournamentId);

  const batch = writeBatch(db);
  batch.delete(regRef);
  batch.update(tourneyRef, {
    registeredCount: increment(-1),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `tournaments/${tournamentId}/registrations/${userId}`);
  }
}

export async function checkInRegistration(tournamentId: string, userId: string): Promise<void> {
  const path = `tournaments/${tournamentId}/registrations/${userId}`;
  try {
    await updateDoc(doc(db, 'tournaments', tournamentId, 'registrations', userId), {
      checkedIn: true,
      status: 'checked_in' as RegistrationStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function fetchLobbyCredentials(tournamentId: string): Promise<TournamentLobby | null> {
  const path = `tournaments/${tournamentId}/lobby/credentials`;
  try {
    const snap = await getDoc(doc(db, 'tournaments', tournamentId, 'lobby', 'credentials'));
    return snap.exists() ? (snap.data() as TournamentLobby) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function upsertLobbyCredentials(
  tournamentId: string,
  input: {
    roomId: string;
    roomPass: string;
    serverRegion: string;
    notes: string;
  }
): Promise<void> {
  const path = `tournaments/${tournamentId}/lobby/credentials`;
  try {
    await setDoc(doc(db, 'tournaments', tournamentId, 'lobby', 'credentials'), {
      tournamentId,
      roomId: input.roomId.trim().slice(0, BLUEPRINT_LIMITS.ROOM_CRED_MAX_LEN) || 'TBD',
      roomPass: input.roomPass.trim().slice(0, BLUEPRINT_LIMITS.ROOM_CRED_MAX_LEN) || 'TBD',
      serverRegion: input.serverRegion.trim().slice(0, BLUEPRINT_LIMITS.ROOM_CRED_MAX_LEN) || 'Asia-South',
      notes: input.notes.trim().slice(0, BLUEPRINT_LIMITS.LOBBY_NOTES_MAX_LEN),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function createTournament(
  adminUid: string,
  adminName: string,
  input: {
    title: string;
    game: GameTitle;
    format: TournamentFormat;
    prizePool: number;
    currency: CurrencyCode;
    entryFee: number;
    maxPlayers: number;
    startTime: string;
    region: RegionCode;
    rulesSummary: string;
    bannerKey: BannerKey;
  }
): Promise<string> {
  const err = validateTournamentInput(input);
  if (err) throw new Error(err);

  const id = sanitizeId(`vnx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`);
  const path = `tournaments/${id}`;

  try {
    await setDoc(doc(db, 'tournaments', id), {
      id,
      title: input.title.trim().slice(0, BLUEPRINT_LIMITS.TITLE_MAX_LEN),
      game: input.game,
      format: input.format,
      status: 'registration' as TournamentStatus,
      prizePool: Math.round(input.prizePool),
      currency: input.currency,
      entryFee: Math.round(input.entryFee),
      maxPlayers: Math.round(input.maxPlayers),
      registeredCount: 0,
      startTime: input.startTime.trim().slice(0, 40),
      region: input.region,
      rulesSummary: input.rulesSummary.trim().slice(0, BLUEPRINT_LIMITS.RULES_MAX_LEN),
      bannerKey: input.bannerKey,
      organizerId: adminUid,
      organizerName: adminName.trim().slice(0, BLUEPRINT_LIMITS.ORGANIZER_NAME_MAX_LEN) || 'Vynorix Org',
      winnerIgn: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateTournamentStatus(
  tournamentId: string,
  status: TournamentStatus,
  winnerIgn?: string
): Promise<void> {
  const path = `tournaments/${tournamentId}`;
  try {
    const payload: Record<string, unknown> = {
      status,
      updatedAt: serverTimestamp(),
    };
    if (winnerIgn !== undefined) {
      payload.winnerIgn = winnerIgn.trim().slice(0, BLUEPRINT_LIMITS.IGN_MAX_LEN);
    }
    await updateDoc(doc(db, 'tournaments', tournamentId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function reportLiveMatchScore(
  tournamentId: string,
  matchId: string,
  player1Score: number,
  player2Score: number
): Promise<void> {
  const path = `tournaments/${tournamentId}/matches/${matchId}`;
  try {
    await updateDoc(doc(db, 'tournaments', tournamentId, 'matches', matchId), {
      player1Score: Math.max(0, Math.min(BLUEPRINT_LIMITS.SCORE_MAX, Math.round(player1Score))),
      player2Score: Math.max(0, Math.min(BLUEPRINT_LIMITS.SCORE_MAX, Math.round(player2Score))),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminUpdateMatchResult(
  tournamentId: string,
  match: TournamentMatch,
  updates: {
    player1Score: number;
    player2Score: number;
    status: MatchStatus;
    winnerId: string;
    winnerIgn: string;
  },
  allMatches: TournamentMatch[]
): Promise<void> {
  const path = `tournaments/${tournamentId}/matches/${match.matchId}`;
  const batch = writeBatch(db);

  batch.update(doc(db, 'tournaments', tournamentId, 'matches', match.matchId), {
    player1Score: Math.max(0, Math.min(BLUEPRINT_LIMITS.SCORE_MAX, Math.round(updates.player1Score))),
    player2Score: Math.max(0, Math.min(BLUEPRINT_LIMITS.SCORE_MAX, Math.round(updates.player2Score))),
    status: updates.status,
    winnerId: updates.winnerId,
    winnerIgn: updates.winnerIgn.slice(0, BLUEPRINT_LIMITS.IGN_MAX_LEN),
    updatedAt: serverTimestamp(),
  });

  // Automatically slot winner into the next round if completed
  if (updates.status === 'completed' && updates.winnerId) {
    const nextRound = match.round + 1;
    const nextMatchNumber = Math.ceil(match.matchNumber / 2);
    const nextMatch = allMatches.find(
      (m) => m.round === nextRound && m.matchNumber === nextMatchNumber
    );
    if (nextMatch) {
      const isPlayer1Slot = match.matchNumber % 2 === 1;
      batch.update(doc(db, 'tournaments', tournamentId, 'matches', nextMatch.matchId), {
        ...(isPlayer1Slot
          ? { player1Id: updates.winnerId, player1Ign: updates.winnerIgn }
          : { player2Id: updates.winnerId, player2Ign: updates.winnerIgn }),
        updatedAt: serverTimestamp(),
      });
    }
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function generateSingleElimBracket(
  tournamentId: string,
  registrations: TournamentRegistration[]
): Promise<void> {
  const ordered = [...registrations].sort((a, b) => Number(b.checkedIn) - Number(a.checkedIn));
  if (ordered.length < 2) {
    throw new Error('At least 2 registered players are required to generate a 1v1 bracket.');
  }

  const targetSize = ordered.length <= 4 ? 4 : ordered.length <= 8 ? 8 : 16;
  const totalRounds = Math.log2(targetSize);
  const batch = writeBatch(db);

  // Clear existing matches first if needed
  try {
    const existingSnap = await getDocs(
      query(
        collection(db, 'tournaments', tournamentId, 'matches'),
        where('tournamentId', '==', tournamentId)
      )
    );
    existingSnap.docs.forEach((d) => batch.delete(d.ref));

    const round1Matches = targetSize / 2;
    for (let i = 0; i < round1Matches; i++) {
      const p1 = ordered[i * 2];
      const p2 = ordered[i * 2 + 1];
      const matchId = `r1_m${i + 1}`;
      const isBye = Boolean(p1 && !p2);
      batch.set(doc(db, 'tournaments', tournamentId, 'matches', matchId), {
        tournamentId,
        matchId,
        round: 1,
        matchNumber: i + 1,
        player1Id: p1 ? p1.userId : '',
        player1Ign: p1 ? p1.ign : 'BYE',
        player1Score: isBye ? 1 : 0,
        player2Id: p2 ? p2.userId : '',
        player2Ign: p2 ? p2.ign : 'BYE',
        player2Score: 0,
        winnerId: isBye && p1 ? p1.userId : '',
        winnerIgn: isBye && p1 ? p1.ign : '',
        status: isBye ? 'completed' : p1 && p2 ? 'live' : 'pending',
        scheduledAt: new Date(Date.now() + 15 * 60000).toISOString(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    for (let round = 2; round <= totalRounds; round++) {
      const count = targetSize / Math.pow(2, round);
      for (let m = 1; m <= count; m++) {
        const matchId = `r${round}_m${m}`;
        batch.set(doc(db, 'tournaments', tournamentId, 'matches', matchId), {
          tournamentId,
          matchId,
          round,
          matchNumber: m,
          player1Id: '',
          player1Ign: 'TBD',
          player1Score: 0,
          player2Id: '',
          player2Ign: 'TBD',
          player2Score: 0,
          winnerId: '',
          winnerIgn: '',
          status: 'pending',
          scheduledAt: new Date(Date.now() + round * 45 * 60000).toISOString(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }

    batch.update(doc(db, 'tournaments', tournamentId), {
      status: 'live' as TournamentStatus,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `tournaments/${tournamentId}/matches`);
  }
}

export async function adminUpdateRegistrationStanding(
  tournamentId: string,
  userId: string,
  updates: {
    kills: number;
    placement: number;
    points: number;
    status: RegistrationStatus;
  }
): Promise<void> {
  const path = `tournaments/${tournamentId}/registrations/${userId}`;
  try {
    await updateDoc(doc(db, 'tournaments', tournamentId, 'registrations', userId), {
      kills: Math.max(0, Math.min(100, Math.round(updates.kills))),
      placement: Math.max(0, Math.min(100, Math.round(updates.placement))),
      points: Math.max(0, Math.min(1000, Math.round(updates.points))),
      status: updates.status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function fetchUserRegisteredTournaments(uid: string): Promise<string[]> {
  try {
    const tourneySnap = await getDocs(
      query(
        collection(db, 'tournaments'),
        where('status', 'in', ['registration', 'live', 'completed']),
        limit(20)
      )
    );
    const ids: string[] = [];
    await Promise.all(
      tourneySnap.docs.map(async (tDoc) => {
        const regSnap = await getDoc(doc(db, 'tournaments', tDoc.id, 'registrations', uid));
        if (regSnap.exists()) ids.push(tDoc.id);
      })
    );
    return ids;
  } catch {
    return [];
  }
}

export async function seedStarterLeague(adminUid: string, adminName: string): Promise<void> {
  const batch = writeBatch(db);
  const now = Date.now();

  const sampleUsers: Array<Omit<UserProfile, 'createdAt' | 'updatedAt'>> = [
    { uid: 'vnx_pro_kaizen', ign: 'KaizenX', gameUid: '5190482711', region: 'IN', favoriteGame: 'BGMI', rating: 1845, wins: 19, eliminations: 214, matchesPlayed: 42 },
    { uid: 'vnx_pro_ryuk', ign: 'RyukAim', gameUid: 'RYUK#7741', region: 'IN', favoriteGame: 'Valorant', rating: 1790, wins: 16, eliminations: 188, matchesPlayed: 37 },
    { uid: 'vnx_pro_zenith', ign: 'ZenithSolo', gameUid: '284910384', region: 'SEA', favoriteGame: 'Free Fire', rating: 1710, wins: 14, eliminations: 162, matchesPlayed: 35 },
    { uid: 'vnx_pro_kuro', ign: 'KuroVex', gameUid: 'KURO#092', region: 'IN', favoriteGame: 'Valorant', rating: 1640, wins: 11, eliminations: 149, matchesPlayed: 31 },
    { uid: 'vnx_pro_nova', ign: 'NovaStrike', gameUid: '6739201844', region: 'IN', favoriteGame: 'COD Mobile', rating: 1585, wins: 9, eliminations: 130, matchesPlayed: 28 },
    { uid: 'vnx_pro_soren', ign: 'SorenClutch', gameUid: 'SRN#4410', region: 'MENA', favoriteGame: 'Valorant', rating: 1520, wins: 8, eliminations: 118, matchesPlayed: 25 },
    { uid: 'vnx_pro_titan', ign: 'TitanDrop', gameUid: '5440918231', region: 'IN', favoriteGame: 'BGMI', rating: 1465, wins: 7, eliminations: 109, matchesPlayed: 24 },
    { uid: 'vnx_pro_astra', ign: 'AstraPulse', gameUid: '390184722', region: 'SEA', favoriteGame: 'Free Fire', rating: 1410, wins: 6, eliminations: 95, matchesPlayed: 21 },
  ];

  sampleUsers.forEach((u) => {
    batch.set(doc(db, 'users', u.uid), {
      ...u,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  const t1Id = 'vnx_valorant_duel_s1';
  const t2Id = 'vnx_bgmi_solo_open_s1';
  const t3Id = 'vnx_ff_clash_finals_s0';

  const safeOrgName = adminName.trim().slice(0, 48) || 'Vynorix Org';

  // T1: Live 1v1 Valorant Duel Bracket (8 players)
  batch.set(doc(db, 'tournaments', t1Id), {
    id: t1Id,
    title: 'Vynorix Valorant 1v1 Aim Cup',
    game: 'Valorant',
    format: '1v1_bracket',
    status: 'live',
    prizePool: 15000,
    currency: 'INR',
    entryFee: 0,
    maxPlayers: 8,
    registeredCount: 8,
    startTime: new Date(now - 30 * 60000).toISOString(),
    region: 'IN',
    rulesSummary:
      'Best-of-1 Skirmish first to 13 rounds on Ascent Mid / Range Arena. No abilities other than Jett Dash or Reyna Dismiss. Screenshot proof required on dispute.',
    bannerKey: 'duel_arena',
    organizerId: adminUid,
    organizerName: safeOrgName,
    winnerIgn: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  sampleUsers.forEach((u, idx) => {
    batch.set(doc(db, 'tournaments', t1Id, 'registrations', u.uid), {
      tournamentId: t1Id,
      userId: u.uid,
      ign: u.ign,
      gameUid: u.gameUid,
      seed: idx + 1,
      checkedIn: true,
      status: idx < 4 ? 'checked_in' : 'eliminated',
      kills: 13 - idx,
      placement: idx + 1,
      points: (8 - idx) * 10,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  const t1Matches: Array<Omit<TournamentMatch, 'createdAt' | 'updatedAt'>> = [
    {
      tournamentId: t1Id,
      matchId: 'r1_m1',
      round: 1,
      matchNumber: 1,
      player1Id: 'vnx_pro_kaizen',
      player1Ign: 'KaizenX',
      player1Score: 13,
      player2Id: 'vnx_pro_astra',
      player2Ign: 'AstraPulse',
      player2Score: 7,
      winnerId: 'vnx_pro_kaizen',
      winnerIgn: 'KaizenX',
      status: 'completed',
      scheduledAt: new Date(now - 25 * 60000).toISOString(),
    },
    {
      tournamentId: t1Id,
      matchId: 'r1_m2',
      round: 1,
      matchNumber: 2,
      player1Id: 'vnx_pro_kuro',
      player1Ign: 'KuroVex',
      player1Score: 13,
      player2Id: 'vnx_pro_nova',
      player2Ign: 'NovaStrike',
      player2Score: 10,
      winnerId: 'vnx_pro_kuro',
      winnerIgn: 'KuroVex',
      status: 'completed',
      scheduledAt: new Date(now - 25 * 60000).toISOString(),
    },
    {
      tournamentId: t1Id,
      matchId: 'r1_m3',
      round: 1,
      matchNumber: 3,
      player1Id: 'vnx_pro_ryuk',
      player1Ign: 'RyukAim',
      player1Score: 13,
      player2Id: 'vnx_pro_titan',
      player2Ign: 'TitanDrop',
      player2Score: 5,
      winnerId: 'vnx_pro_ryuk',
      winnerIgn: 'RyukAim',
      status: 'completed',
      scheduledAt: new Date(now - 25 * 60000).toISOString(),
    },
    {
      tournamentId: t1Id,
      matchId: 'r1_m4',
      round: 1,
      matchNumber: 4,
      player1Id: 'vnx_pro_zenith',
      player1Ign: 'ZenithSolo',
      player1Score: 13,
      player2Id: 'vnx_pro_soren',
      player2Ign: 'SorenClutch',
      player2Score: 11,
      winnerId: 'vnx_pro_zenith',
      winnerIgn: 'ZenithSolo',
      status: 'completed',
      scheduledAt: new Date(now - 25 * 60000).toISOString(),
    },
    {
      tournamentId: t1Id,
      matchId: 'r2_m1',
      round: 2,
      matchNumber: 1,
      player1Id: 'vnx_pro_kaizen',
      player1Ign: 'KaizenX',
      player1Score: 9,
      player2Id: 'vnx_pro_kuro',
      player2Ign: 'KuroVex',
      player2Score: 8,
      winnerId: '',
      winnerIgn: '',
      status: 'live',
      scheduledAt: new Date(now + 5 * 60000).toISOString(),
    },
    {
      tournamentId: t1Id,
      matchId: 'r2_m2',
      round: 2,
      matchNumber: 2,
      player1Id: 'vnx_pro_ryuk',
      player1Ign: 'RyukAim',
      player1Score: 6,
      player2Id: 'vnx_pro_zenith',
      player2Ign: 'ZenithSolo',
      player2Score: 7,
      winnerId: '',
      winnerIgn: '',
      status: 'live',
      scheduledAt: new Date(now + 5 * 60000).toISOString(),
    },
    {
      tournamentId: t1Id,
      matchId: 'r3_m1',
      round: 3,
      matchNumber: 1,
      player1Id: '',
      player1Ign: 'TBD',
      player1Score: 0,
      player2Id: '',
      player2Ign: 'TBD',
      player2Score: 0,
      winnerId: '',
      winnerIgn: '',
      status: 'pending',
      scheduledAt: new Date(now + 40 * 60000).toISOString(),
    },
  ];

  t1Matches.forEach((m) => {
    batch.set(doc(db, 'tournaments', t1Id, 'matches', m.matchId), {
      ...m,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  batch.set(doc(db, 'tournaments', t1Id, 'lobby', 'credentials'), {
    tournamentId: t1Id,
    roomId: 'VNX-VAL-4082',
    roomPass: 'DUEL991',
    serverRegion: 'Mumbai-01',
    notes: 'Join custom lobby 10 minutes before your semifinal timer.',
    updatedAt: serverTimestamp(),
  });

  // T2: Open Registration BGMI Solo Showdown
  batch.set(doc(db, 'tournaments', t2Id), {
    id: t2Id,
    title: 'Vynorix BGMI Erangel Solo Drop',
    game: 'BGMI',
    format: 'br_solo',
    status: 'registration',
    prizePool: 25000,
    currency: 'INR',
    entryFee: 0,
    maxPlayers: 64,
    registeredCount: 5,
    startTime: new Date(now + 3 * 3600000).toISOString(),
    region: 'IN',
    rulesSummary:
      'Erangel Solo TPP Classic. Scoring: 15 pts for WWCD (#1), 12 pts (#2), 10 pts (#3), 1 pt per elimination. Emulators and GFX third-party tools strictly banned.',
    bannerKey: 'br_showdown',
    organizerId: adminUid,
    organizerName: safeOrgName,
    winnerIgn: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  sampleUsers.slice(0, 5).forEach((u, idx) => {
    batch.set(doc(db, 'tournaments', t2Id, 'registrations', u.uid), {
      tournamentId: t2Id,
      userId: u.uid,
      ign: u.ign,
      gameUid: u.gameUid,
      seed: idx + 1,
      checkedIn: idx < 3,
      status: idx < 3 ? 'checked_in' : 'registered',
      kills: 0,
      placement: 0,
      points: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  batch.set(doc(db, 'tournaments', t2Id, 'lobby', 'credentials'), {
    tournamentId: t2Id,
    roomId: '8841209',
    roomPass: 'VNXSOLO',
    serverRegion: 'India-West',
    notes: 'Room opens 15 minutes before drop. Hold assigned slot number.',
    updatedAt: serverTimestamp(),
  });

  // T3: Completed Free Fire Solo Clash
  batch.set(doc(db, 'tournaments', t3Id), {
    id: t3Id,
    title: 'Vynorix Free Fire Solo Clash #12',
    game: 'Free Fire',
    format: 'br_solo',
    status: 'completed',
    prizePool: 10000,
    currency: 'INR',
    entryFee: 0,
    maxPlayers: 48,
    registeredCount: 6,
    startTime: new Date(now - 24 * 3600000).toISOString(),
    region: 'SEA',
    rulesSummary:
      'Bermuda Solo 3-Match Series. Booyah awards 12 placement points; 2 points per elimination. Tie-breaker decided by highest single-match kills.',
    bannerKey: 'vynorix_arena',
    organizerId: adminUid,
    organizerName: safeOrgName,
    winnerIgn: 'ZenithSolo',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const t3Standings = [
    { u: sampleUsers[2], kills: 14, placement: 1, points: 40, status: 'winner' as RegistrationStatus },
    { u: sampleUsers[0], kills: 11, placement: 2, points: 31, status: 'eliminated' as RegistrationStatus },
    { u: sampleUsers[7], kills: 9, placement: 3, points: 26, status: 'eliminated' as RegistrationStatus },
    { u: sampleUsers[4], kills: 7, placement: 4, points: 20, status: 'eliminated' as RegistrationStatus },
    { u: sampleUsers[6], kills: 5, placement: 5, points: 15, status: 'eliminated' as RegistrationStatus },
    { u: sampleUsers[3], kills: 3, placement: 6, points: 10, status: 'eliminated' as RegistrationStatus },
  ];

  t3Standings.forEach((row, idx) => {
    batch.set(doc(db, 'tournaments', t3Id, 'registrations', row.u.uid), {
      tournamentId: t3Id,
      userId: row.u.uid,
      ign: row.u.ign,
      gameUid: row.u.gameUid,
      seed: idx + 1,
      checkedIn: true,
      status: row.status,
      kills: row.kills,
      placement: row.placement,
      points: row.points,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'tournaments (seedStarterLeague)');
  }
}
