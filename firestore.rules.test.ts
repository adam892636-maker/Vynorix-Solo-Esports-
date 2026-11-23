/**
 * Vynorix Solo Esports — Phase 0 Payload-First Security Test Specification
 * Verifies the "Dirty Dozen" adversarial payloads against firestore.rules invariants.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  targetPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expectedOutcome: 'PERMISSION_DENIED';
  description: string;
  payload?: Record<string, unknown>;
}

export const dirtyDozenCases: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Shadow Field Injection on Profile',
    targetPath: '/users/user_1',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    description: 'Rejects unknown ghost fields such as isAdmin or role on user profile creation.',
    payload: {
      uid: 'user_1',
      ign: 'VynorixAce',
      gameUid: '551234991',
      region: 'IN',
      favoriteGame: 'BGMI',
      rating: 1000,
      wins: 0,
      eliminations: 0,
      matchesPlayed: 0,
      isAdmin: true,
    },
  },
  {
    id: 2,
    name: 'Stat Inflation Attack',
    targetPath: '/users/user_1',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    description: 'Non-admin cannot mutate competitive rating, wins, or eliminations.',
    payload: {
      rating: 9999,
      wins: 250,
    },
  },
  {
    id: 3,
    name: 'Cross-User PII Read',
    targetPath: '/users/user_1/private/info',
    operation: 'get',
    expectedOutcome: 'PERMISSION_DENIED',
    description: 'User user_2 cannot read isolated PII record belonging to user_1.',
  },
  {
    id: 4,
    name: 'Unverified Email Admin Spoof',
    targetPath: '/tournaments/tourney_1',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    description: 'Admin email with email_verified=false is blocked by isVerified() gate.',
  },
  {
    id: 5,
    name: 'Path ID Poisoning',
    targetPath: '/tournaments/invalid id with spaces and $$$',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    description: 'Document IDs violating ^[a-zA-Z0-9_\\-]+$ or >128 chars are rejected.',
  },
  {
    id: 6,
    name: 'Orphaned Registration',
    targetPath: '/tournaments/missing_tourney/registrations/user_1',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    description: 'Registration fails Master Gate exists() check when parent tournament is absent.',
  },
  {
    id: 7,
    name: 'Desynced Slot Count Registration',
    targetPath: '/tournaments/tourney_1/registrations/user_1',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    description: 'Standalone registration without atomic batch increment on registeredCount fails getAfter check.',
  },
  {
    id: 8,
    name: 'Over-Capacity Registration',
    targetPath: '/tournaments/tourney_1',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    description: 'Incrementing registeredCount beyond maxPlayers is blocked.',
  },
  {
    id: 9,
    name: 'Unauthorized Lobby Credential Snooping',
    targetPath: '/tournaments/tourney_1/lobby/credentials',
    operation: 'get',
    expectedOutcome: 'PERMISSION_DENIED',
    description: 'Unregistered signed-in user cannot read lobby Room ID / Password.',
  },
  {
    id: 10,
    name: 'Completed Match Score Tampering',
    targetPath: '/tournaments/tourney_1/matches/match_1',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    description: 'Terminal status lock blocks participant score edits once match status is completed.',
  },
  {
    id: 11,
    name: 'Backdated Timestamp Attack',
    targetPath: '/users/user_1',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    description: 'Client-forged createdAt timestamp not matching request.time is rejected.',
  },
  {
    id: 12,
    name: 'Cancelled Draft Scraping',
    targetPath: '/tournaments',
    operation: 'list',
    expectedOutcome: 'PERMISSION_DENIED',
    description: 'Non-admin list queries cannot return cancelled tournaments.',
  },
];
