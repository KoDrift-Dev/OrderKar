// Shared role hierarchy — the single source of truth for role ranks.
// Used by middleware.ts (Edge), lib/auth.ts and lib/staff-server.ts (Node).
//
// Edge-safe: pure functions and a const map only. No Node imports,
// no side effects. The `Role` import is type-only (erased at compile).

import type { Role } from './types';

/** Numeric rank for each role; higher = more privilege. */
export const ROLE_RANK: Record<Role, number> = {
  kitchen: 1,
  waiter: 2,
  manager: 3,
  owner: 4,
  super_admin: 5,
};

/** Numeric rank for a role string; unknown/missing roles rank 0 (no access). */
export function roleRank(role: string | null | undefined): number {
  if (!role) return 0;
  return ROLE_RANK[role as Role] ?? 0;
}

/** True when `role` meets or exceeds the `min` role. */
export function hasMinRole(role: string | null | undefined, min: Role): boolean {
  return roleRank(role) >= ROLE_RANK[min];
}
