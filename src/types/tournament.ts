import type { Timestamp } from 'firebase/firestore';

export type GameTitle = 'BGMI' | 'Free Fire' | 'Valorant' | 'COD Mobile' | 'Apex Legends';
export type TournamentFormat = 'br_solo' | '1v1_bracket';
export type TournamentStatus = 'registration' | 'live' | 'completed' | 'cancelled';
export type RegionCode = 'IN' | 'SEA' | 'MENA' | 'EU' | 'NA' | 'GLOBAL';
export type CurrencyCode = 'INR' | 'USD';
export type BannerKey = 'br_showdown' | 'duel_arena' | 'vynorix_arena';
export type RegistrationStatus = 'registered' | 'checked_in' | 'eliminated' | 'winner';
export type MatchStatus = 'pending' | 'live' | 'completed';

export interface UserProfile {
  uid: string;
  ign: string;
  gameUid: string;
  region: RegionCode;
  favoriteGame: GameTitle;
  rating: number;
  wins: number;
  eliminations: number;
  matchesPlayed: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface UserPrivateInfo {
  uid: string;
  email: string;
  discordHandle: string;
  updatedAt?: Timestamp;
}

export interface Tournament {
  id: string;
  title: string;
  game: GameTitle;
  format: TournamentFormat;
  status: TournamentStatus;
  prizePool: number;
  currency: CurrencyCode;
  entryFee: number;
  maxPlayers: number;
  registeredCount: number;
  startTime: string;
  region: RegionCode;
  rulesSummary: string;
  bannerKey: BannerKey;
  organizerId: string;
  organizerName: string;
  winnerIgn: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface TournamentLobby {
  tournamentId: string;
  roomId: string;
  roomPass: string;
  serverRegion: string;
  notes: string;
  updatedAt?: Timestamp;
}

export interface TournamentRegistration {
  tournamentId: string;
  userId: string;
  ign: string;
  gameUid: string;
  seed: number;
  checkedIn: boolean;
  status: RegistrationStatus;
  kills: number;
  placement: number;
  points: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface TournamentMatch {
  tournamentId: string;
  matchId: string;
  round: number;
  matchNumber: number;
  player1Id: string;
  player1Ign: string;
  player1Score: number;
  player2Id: string;
  player2Ign: string;
  player2Score: number;
  winnerId: string;
  winnerIgn: string;
  status: MatchStatus;
  scheduledAt: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
