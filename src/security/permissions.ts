export const ROLE_PERMISSIONS = {
  Administrator: ['*'],
  'Production Manager': ['/dashboard','/master-data','/production','/serialization','/printing'],
  'Production Operator': ['/dashboard','/production','/serialization'],
  'Printing Operator': ['/dashboard','/printing','/label-designer'],
  'Warranty Officer': ['/dashboard','/warranty','/customer-service'],
  'Customer Service Agent': ['/dashboard','/customer-service'],
  'Service Manager': ['/dashboard','/customer-service','/replacement','/reports'],
} as const;

export type SleepeeRole = keyof typeof ROLE_PERMISSIONS;

export function hasRoutePermission(role: string, pathname: string): boolean {
  if (role === 'Administrator') return true;
  const permissions = ROLE_PERMISSIONS[role as SleepeeRole];
  if (!permissions) return false;
  const base = '/' + pathname.split('/').filter(Boolean)[0];
  return permissions.includes(base as never);
}
