"use server";

import { requireAdmin } from "@/auth/session";
import { callAdminRpc, type ActionResult } from "./helpers";

export async function startEventAction(clientActionId?: string): Promise<ActionResult> {
  const session = await requireAdmin();
  return callAdminRpc("admin_start_event", { p_operator: session.operator, p_client_action_id: clientActionId ?? null });
}

export async function pauseEventAction(clientActionId?: string): Promise<ActionResult> {
  const session = await requireAdmin();
  return callAdminRpc("admin_pause_event", { p_operator: session.operator, p_client_action_id: clientActionId ?? null });
}

export async function resumeEventAction(clientActionId?: string): Promise<ActionResult> {
  const session = await requireAdmin();
  return callAdminRpc("admin_resume_event", { p_operator: session.operator, p_client_action_id: clientActionId ?? null });
}

export async function completeEventAction(skipRemaining: boolean, clientActionId?: string): Promise<ActionResult> {
  const session = await requireAdmin();
  return callAdminRpc("admin_complete_event", {
    p_operator: session.operator,
    p_skip_remaining: skipRemaining,
    p_client_action_id: clientActionId ?? null,
  });
}

export async function startItemAction(itemId: string, clientActionId?: string): Promise<ActionResult> {
  const session = await requireAdmin();
  return callAdminRpc("admin_start_item", { p_item_id: itemId, p_operator: session.operator, p_client_action_id: clientActionId ?? null });
}

export async function pauseItemAction(itemId: string, clientActionId?: string): Promise<ActionResult> {
  const session = await requireAdmin();
  return callAdminRpc("admin_pause_item", { p_item_id: itemId, p_operator: session.operator, p_client_action_id: clientActionId ?? null });
}

export async function resumeItemAction(itemId: string, clientActionId?: string): Promise<ActionResult> {
  const session = await requireAdmin();
  return callAdminRpc("admin_resume_item", { p_item_id: itemId, p_operator: session.operator, p_client_action_id: clientActionId ?? null });
}

export async function completeItemAction(
  itemId: string,
  startNextId?: string,
  clientActionId?: string
): Promise<ActionResult> {
  const session = await requireAdmin();
  return callAdminRpc("admin_complete_item", {
    p_item_id: itemId,
    p_operator: session.operator,
    p_start_next_id: startNextId ?? null,
    p_client_action_id: clientActionId ?? null,
  });
}

export async function skipItemAction(itemId: string, clientActionId?: string): Promise<ActionResult> {
  const session = await requireAdmin();
  return callAdminRpc("admin_skip_item", { p_item_id: itemId, p_operator: session.operator, p_client_action_id: clientActionId ?? null });
}

export async function cancelItemAction(itemId: string, clientActionId?: string): Promise<ActionResult> {
  const session = await requireAdmin();
  return callAdminRpc("admin_cancel_item", { p_item_id: itemId, p_operator: session.operator, p_client_action_id: clientActionId ?? null });
}

export async function restoreItemAction(
  itemId: string,
  displayOrder: number,
  clientActionId?: string
): Promise<ActionResult> {
  const session = await requireAdmin();
  return callAdminRpc("admin_restore_item", {
    p_item_id: itemId,
    p_display_order: displayOrder,
    p_operator: session.operator,
    p_client_action_id: clientActionId ?? null,
  });
}

export async function adjustScheduleAction(
  mode: "shift_all" | "shift_selected" | "reflow" | "none",
  minutes: number | null,
  itemIds: string[] | null,
  clientActionId?: string
): Promise<ActionResult> {
  const session = await requireAdmin();
  return callAdminRpc("admin_adjust_schedule", {
    p_mode: mode,
    p_minutes: minutes,
    p_item_ids: itemIds,
    p_operator: session.operator,
    p_client_action_id: clientActionId ?? null,
  });
}

export async function undoAction(logId: number, clientActionId?: string): Promise<ActionResult> {
  const session = await requireAdmin();
  return callAdminRpc("admin_undo", { p_log_id: logId, p_operator: session.operator, p_client_action_id: clientActionId ?? null });
}
