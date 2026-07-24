import type { V4Member } from "./types";

export type MemberAction =
  | "record:create"
  | "record:update-own"
  | "record:delete-own"
  | "finance:view"
  | "inventory:manage"
  | "member:manage"
  | "farm:delete";

export function canMember(member: V4Member, action: MemberAction, unitId?: string): boolean {
  if (member.status !== "active") return false;
  if (member.role === "owner") return true;
  if (unitId && member.unitIds.length && !member.unitIds.includes(unitId)) return false;
  if (action === "record:create" || action === "record:update-own" || action === "record:delete-own") return true;
  if (action === "finance:view") return member.canViewFinance;
  return false;
}

