/** Canonical Sleepee roles: names must match Sleepee_Single_Source_Of_Truth_v1.0. */
export const SLEEPEE_ROLES = [
  'Administrator',
  'Production Manager',
  'Production Operator',
  'Printing Operator',
  'Customer Service User',
  'Warranty Manager',
  'Read Only User'
] as const;

export type SleepeeRole = (typeof SLEEPEE_ROLES)[number];

/**
 * Conservative route authorization. Fine-grained writes remain enforced by Supabase RPC/RLS;
 * UI route checks are defense in depth, not a replacement for database security.
 * Replacement lifecycle transitions remain Administrator-only until a canonical manager role
 * is approved in the business reference.
 */
export const ROLE_PERMISSIONS: Record<SleepeeRole, readonly string[]> = {
  Administrator: ['*'],
  'Production Manager': ['/dashboard', '/master-data', '/manufacturing-engineering', '/production', '/serialization', '/printing', '/label-designer', '/reports'],
  'Production Operator': ['/dashboard', '/production', '/serialization'],
  'Printing Operator': ['/dashboard', '/printing', '/label-designer'],
  'Customer Service User': ['/dashboard', '/customer-service', '/replacement', '/warranty', '/reports'],
  'Warranty Manager': ['/dashboard', '/warranty', '/reports'],
  'Read Only User': ['/dashboard', '/warranty', '/printing', '/reports']
};

export function hasRoutePermission(role: string, pathname: string): boolean {
  if (role === 'Administrator') return true;
  if (!SLEEPEE_ROLES.includes(role as SleepeeRole)) return false;
  const permissions = ROLE_PERMISSIONS[role as SleepeeRole];
  const base = '/' + pathname.split('/').filter(Boolean)[0];
  return permissions.includes(base);
}
