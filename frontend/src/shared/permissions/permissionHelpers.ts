import type { AppMenuItem } from './menuConfig';

export function normalizePermissions(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((p: unknown) => {
      if (typeof p === 'string') return p;
      if (p && typeof (p as { code: string }).code === 'string') return (p as { code: string }).code;
      return String(p);
    });
  }
  if (typeof raw === 'string') return [raw];
  return [];
}

export function canAccessMenuItem(
  hasPermission: (permission?: string) => boolean,
  item: AppMenuItem,
): boolean {
  if (!item.requiredPermission && (!item.requiredAnyPermission || item.requiredAnyPermission.length === 0)) {
    return true;
  }
  if (item.requiredPermission && hasPermission(item.requiredPermission)) {
    return true;
  }
  if (item.requiredAnyPermission && item.requiredAnyPermission.length > 0) {
    return item.requiredAnyPermission.some((p) => hasPermission(p));
  }
  return false;
}
