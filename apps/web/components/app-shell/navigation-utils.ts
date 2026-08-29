import type { NavItem } from "./role-navigation";

/**
 * Reusable helper to determine whether a navigation item is active
 * Supports exact matching, subpath matching, and multiple alias paths (grouped views)
 */
export function isNavItemActive(pathname: string, item: NavItem): boolean {
  if (!pathname || !item) return false;

  // 1. Exact match
  if (item.exact) {
    return pathname === item.href;
  }

  // 2. Direct href match or subpath of href
  if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
    return true;
  }

  // 3. Check grouped active paths (e.g. /app/admin/tasks, /app/admin/kanban, /app/admin/calendar)
  if (item.activePaths && Array.isArray(item.activePaths)) {
    for (const path of item.activePaths) {
      if (pathname === path || pathname.startsWith(`${path}/`)) {
        return true;
      }
    }
  }

  return false;
}
