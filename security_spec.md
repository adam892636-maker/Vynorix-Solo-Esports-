# Vynorix Solo Esports — Security Specification (Phase 0 TDD)

## 1. Data Invariants

1. **Identity Integrity**: A user profile at `/users/{userId}` and private PII record at `/users/{userId}/private/info` can only be created or updated by `request.auth.uid == userId` (with verified email) or an Admin. Regular users cannot tamper with competitive stats (`rating`, `wins`, `eliminations`, `matchesPlayed`) or `createdAt` / `uid`.
2. **PII Isolation**: Email and Discord handles reside strictly in `/users/{userId}/private/info` and are readable/writable only by the owner or an Admin.
3. **Tournament Master Gate**: Registrations (`/tournaments/{tournamentId}/registrations/{userId}`), matches (`/tournaments/{tournamentId}/matches/{matchId}`), and lobby credentials (`/tournaments/{tournamentId}/lobby/credentials`) cannot exist without an existing parent `/tournaments/{tournamentId}`.
4. **Atomic Slot Counting**: Player self-registration must atomically increment `registeredCount` by 1 on `/tournaments/{tournamentId}` in the same batch while tournament status is `'registration'` and `registeredCount < maxPlayers`. Player withdrawal must atomically decrement `registeredCount` by 1.
5. **Lobby Credential Gate**: Only registered participants (`exists(.../registrations/$(request.auth.uid))`) or Admins can read `/tournaments/{tournamentId}/lobby/credentials`.
6. **Terminal State Locking**: Once a tournament reaches `'completed'` or `'cancelled'`, or a match reaches `'completed'`, non-admin writes are rejected.
7. **Temporal Integrity**: `createdAt` and `updatedAt` fields must equal `request.time`, and `createdAt` is immutable on update.
8. **Admin Verification**: Bootstrapped admin (`ssahu76447@gmail.com`) and `/admins/{uid}` require `request.auth.token.email_verified == true`.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Shadow Field Injection on Profile**: Create `/users/u1` with `{ uid: "u1", ..., isAdmin: true }` -> `PERMISSION_DENIED` (`hasOnly` blocks unknown fields).
2. **Stat Inflation Attack**: Non-admin updates `/users/u1` changing `rating: 9999` or `wins: 500` -> `PERMISSION_DENIED` (`affectedKeys().hasOnly(['ign', 'gameUid', 'region', 'favoriteGame', 'updatedAt'])`).
3. **Cross-User PII Read**: Authenticated user `u2` reads `/users/u1/private/info` -> `PERMISSION_DENIED`.
4. **Unverified Email Admin Spoof**: Token with `email: "ssahu76447@gmail.com", email_verified: false` attempts to create `/tournaments/t1` -> `PERMISSION_DENIED`.
5. **Path ID Poisoning**: Attempt to create `/tournaments/bad$id!!with spaces` or 500-char ID -> `PERMISSION_DENIED` (`isValidId` regex & size guard).
6. **Orphaned Registration**: Attempt to create `/tournaments/nonexistent/registrations/u1` -> `PERMISSION_DENIED` (`exists()` parent gate).
7. **Desynced Slot Count Registration**: Attempt to create `/tournaments/t1/registrations/u1` without atomically incrementing `tournaments/t1.registeredCount` -> `PERMISSION_DENIED` (`getAfter` invariant).
8. **Over-Capacity Registration**: Attempt to register when `registeredCount == maxPlayers` -> `PERMISSION_DENIED`.
9. **Unauthorized Lobby Credential Snooping**: Signed-in user `u2` who is NOT registered for `t1` attempts `get` on `/tournaments/t1/lobby/credentials` -> `PERMISSION_DENIED`.
10. **Completed Match Score Tampering**: Participant `u1` tries to update `player1Score` on a match with `status == 'completed'` -> `PERMISSION_DENIED` (terminal state lock).
11. **Backdated Timestamp Attack**: User creates `/users/u1` with `createdAt: Timestamp(2020-01-01)` -> `PERMISSION_DENIED` (`createdAt == request.time`).
12. **Blanket Query Scraping on Private Info / Cancelled Drafts**: Unauthenticated or unauthorized user lists `/tournaments` including `'cancelled'` docs -> `PERMISSION_DENIED`.
