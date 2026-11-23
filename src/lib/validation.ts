import type {
  BannerKey,
  CurrencyCode,
  GameTitle,
  RegionCode,
  TournamentFormat,
} from '../types/tournament';

export const GAMES: GameTitle[] = ['BGMI', 'Free Fire', 'Valorant', 'COD Mobile', 'Apex Legends'];
export const REGIONS: RegionCode[] = ['IN', 'SEA', 'MENA', 'EU', 'NA', 'GLOBAL'];
export const FORMATS: TournamentFormat[] = ['br_solo', '1v1_bracket'];
export const CURRENCIES: CurrencyCode[] = ['INR', 'USD'];
export const BANNER_KEYS: BannerKey[] = ['br_showdown', 'duel_arena', 'vynorix_arena'];

// Synchronized verbatim with firebase-blueprint.json & firestore.rules
export const BLUEPRINT_LIMITS = {
  ID_MAX_LEN: 128,
  ID_REGEX: /^[a-zA-Z0-9_\-]+$/,
  IGN_MIN_LEN: 2,
  IGN_MAX_LEN: 32,
  IGN_REGEX: /^[a-zA-Z0-9_.\- ]+$/,
  GAME_UID_MIN_LEN: 2,
  GAME_UID_MAX_LEN: 40,
  GAME_UID_REGEX: /^[a-zA-Z0-9_\-#]+$/,
  DISCORD_MAX_LEN: 50,
  EMAIL_MAX_LEN: 120,
  TITLE_MIN_LEN: 3,
  TITLE_MAX_LEN: 80,
  RULES_MIN_LEN: 10,
  RULES_MAX_LEN: 1200,
  ORGANIZER_NAME_MIN_LEN: 2,
  ORGANIZER_NAME_MAX_LEN: 48,
  MAX_PLAYERS_MIN: 2,
  MAX_PLAYERS_MAX: 100,
  PRIZE_POOL_MAX: 10000000,
  ENTRY_FEE_MAX: 100000,
  ROOM_CRED_MAX_LEN: 40,
  LOBBY_NOTES_MAX_LEN: 300,
  SCORE_MAX: 999,
};

export function sanitizeId(raw: string): string {
  return raw
    .trim()
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .slice(0, BLUEPRINT_LIMITS.ID_MAX_LEN);
}

export function validateIgn(raw: string): { valid: boolean; value: string; error?: string } {
  const value = raw.trim().slice(0, BLUEPRINT_LIMITS.IGN_MAX_LEN);
  if (value.length < BLUEPRINT_LIMITS.IGN_MIN_LEN) {
    return { valid: false, value, error: 'In-game name must be at least 2 characters.' };
  }
  if (!BLUEPRINT_LIMITS.IGN_REGEX.test(value)) {
    return {
      valid: false,
      value,
      error: 'IGN may only contain letters, numbers, spaces, dots, underscores, or hyphens.',
    };
  }
  return { valid: true, value };
}

export function validateGameUid(raw: string): { valid: boolean; value: string; error?: string } {
  const value = raw.trim().slice(0, BLUEPRINT_LIMITS.GAME_UID_MAX_LEN);
  if (value.length < BLUEPRINT_LIMITS.GAME_UID_MIN_LEN) {
    return { valid: false, value, error: 'Game UID / Riot ID must be at least 2 characters.' };
  }
  if (!BLUEPRINT_LIMITS.GAME_UID_REGEX.test(value)) {
    return {
      valid: false,
      value,
      error: 'Game UID may only contain letters, numbers, #, _, or -.',
    };
  }
  return { valid: true, value };
}

export function validateTournamentInput(input: {
  title: string;
  rulesSummary: string;
  prizePool: number;
  entryFee: number;
  maxPlayers: number;
}): string | null {
  const title = input.title.trim();
  const rules = input.rulesSummary.trim();
  if (title.length < BLUEPRINT_LIMITS.TITLE_MIN_LEN || title.length > BLUEPRINT_LIMITS.TITLE_MAX_LEN) {
    return `Title must be between ${BLUEPRINT_LIMITS.TITLE_MIN_LEN} and ${BLUEPRINT_LIMITS.TITLE_MAX_LEN} characters.`;
  }
  if (rules.length < BLUEPRINT_LIMITS.RULES_MIN_LEN || rules.length > BLUEPRINT_LIMITS.RULES_MAX_LEN) {
    return `Rules summary must be between ${BLUEPRINT_LIMITS.RULES_MIN_LEN} and ${BLUEPRINT_LIMITS.RULES_MAX_LEN} characters.`;
  }
  if (!Number.isFinite(input.prizePool) || input.prizePool < 0 || input.prizePool > BLUEPRINT_LIMITS.PRIZE_POOL_MAX) {
    return 'Prize pool must be between 0 and 10,000,000.';
  }
  if (!Number.isFinite(input.entryFee) || input.entryFee < 0 || input.entryFee > BLUEPRINT_LIMITS.ENTRY_FEE_MAX) {
    return 'Entry fee must be between 0 and 100,000.';
  }
  if (
    !Number.isInteger(input.maxPlayers) ||
    input.maxPlayers < BLUEPRINT_LIMITS.MAX_PLAYERS_MIN ||
    input.maxPlayers > BLUEPRINT_LIMITS.MAX_PLAYERS_MAX
  ) {
    return 'Max players must be an integer between 2 and 100.';
  }
  return null;
}

export function formatCurrency(amount: number, currency: CurrencyCode): string {
  if (amount === 0) return 'Free';
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatFormatLabel(format: TournamentFormat): string {
  return format === '1v1_bracket' ? '1v1 Duel Bracket' : 'Battle Royale Solo';
}

export function formatStatusLabel(status: string): string {
  switch (status) {
    case 'registration':
      return 'Open';
    case 'live':
      return 'Live';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    case 'checked_in':
      return 'Checked In';
    case 'registered':
      return 'Registered';
    case 'eliminated':
      return 'Eliminated';
    case 'winner':
      return 'Champion';
    case 'pending':
      return 'Scheduled';
    default:
      return status;
  }
}

export const BANNER_ASSETS: Record<BannerKey, string> = {
  br_showdown: '/src/assets/images/banner_br_showdown_1795441805668.jpg',
  duel_arena: '/src/assets/images/banner_duel_arena_1795441805829.jpg',
  vynorix_arena: '/src/assets/images/hero_vynorix_arena_1795441805627.jpg',
};

export const HERO_IMAGE = '/src/assets/images/hero_vynorix_arena_1795441805627.jpg';
export const TROPHY_IMAGE = '/src/assets/images/trophy_vynorix_cup_1795441805676.jpg';
