import { z } from "zod";

export const loginSchema = z.object({
  operator: z.string().trim().min(1).max(60),
  passcode: z.string().min(1).max(200),
});

export const settingsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  venue: z.string().trim().max(200).optional().nullable(),
  startsAt: z.string().min(1), // local Sri Lanka datetime, "YYYY-MM-DDTHH:mm"
  shiftAgenda: z.boolean().default(false),
});

export type SettingsInput = z.infer<typeof settingsSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
