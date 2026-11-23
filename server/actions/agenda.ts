"use server";

import { requireAdmin } from "@/auth/session";
import { agendaItemSchema, reorderSchema, categorySchema } from "@/validation/agenda";
import { callAdminRpc, type ActionResult } from "./helpers";

export async function upsertAgendaItemAction(input: unknown): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = agendaItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the item fields." };

  return callAdminRpc("admin_upsert_item", {
    p_id: parsed.data.id ?? null,
    p_item_number: parsed.data.itemNumber,
    p_title: parsed.data.title,
    p_description: parsed.data.description ?? null,
    p_category_id: parsed.data.categoryId,
    p_scheduled_start_at: parsed.data.scheduledStartAt,
    p_duration_minutes: parsed.data.durationMinutes,
    p_is_time_fixed: parsed.data.isTimeFixed,
    p_display_order: parsed.data.displayOrder ?? null,
    p_expected_version: parsed.data.expectedVersion ?? null,
    p_operator: session.operator,
  });
}

export async function reorderAgendaAction(input: unknown): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = reorderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Reorder payload was invalid." };

  return callAdminRpc("admin_reorder_items", {
    p_ids: parsed.data.ids,
    p_expected_version: parsed.data.expectedVersion,
    p_operator: session.operator,
  });
}

export async function deleteAgendaItemAction(itemId: string): Promise<ActionResult> {
  const session = await requireAdmin();
  return callAdminRpc("admin_delete_item", { p_item_id: itemId, p_operator: session.operator });
}

export async function upsertCategoryAction(input: unknown): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the category fields." };

  return callAdminRpc("admin_upsert_category", {
    p_id: parsed.data.id ?? null,
    p_name: parsed.data.name,
    p_color: parsed.data.color,
    p_sort_order: parsed.data.sortOrder ?? null,
    p_operator: session.operator,
  });
}
