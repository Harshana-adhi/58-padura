import { z } from "zod";

export const agendaItemSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  itemNumber: z.number().int().positive(),
  title: z.string().trim().min(1).max(150),
  description: z.string().trim().max(1000).optional().nullable(),
  categoryId: z.string().uuid(),
  scheduledStartAt: z.string().min(1),
  durationMinutes: z.number().int().min(1).max(600),
  isTimeFixed: z.boolean().default(false),
  displayOrder: z.number().int().optional().nullable(),
  expectedVersion: z.number().int().optional().nullable(),
});

export const reorderSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  expectedVersion: z.number().int(),
});

export const categorySchema = z.object({
  id: z.string().uuid().optional().nullable(),
  name: z.string().trim().min(1).max(40),
  color: z.string().trim().min(1).max(20),
  sortOrder: z.number().int().optional().nullable(),
});

export const adjustScheduleSchema = z.object({
  mode: z.enum(["shift_all", "shift_selected", "reflow", "none"]),
  minutes: z.number().int().optional().nullable(),
  itemIds: z.array(z.string().uuid()).optional().nullable(),
});

export type AgendaItemInput = z.infer<typeof agendaItemSchema>;
