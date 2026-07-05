export type Role = "superadmin" | "editor" | "viewer";

export const ROLES: Role[] = ["superadmin", "editor", "viewer"];

const RANK: Record<Role, number> = {
  viewer: 0,
  editor: 1,
  superadmin: 2,
};

export function hasAtLeastRole(role: Role | null | undefined, required: Role): boolean {
  if (!role) return false;
  return RANK[role] >= RANK[required];
}

export function canEdit(role: Role | null | undefined): boolean {
  return hasAtLeastRole(role, "editor");
}

export function isSuperAdmin(role: Role | null | undefined): boolean {
  return role === "superadmin";
}
