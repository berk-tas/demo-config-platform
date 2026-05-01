import { z } from "zod";

export const WorkspaceSettingsSchema = z.object({
  enableExternalValidators: z.boolean().optional(),
});

export const WorkspaceSettingsConfigSchema = z.object({
  workspaceSettings: z.record(z.string().min(1), WorkspaceSettingsSchema),
});

export type WorkspaceSettings = z.infer<typeof WorkspaceSettingsSchema>;
export type WorkspaceSettingsConfig = z.infer<
  typeof WorkspaceSettingsConfigSchema
>;
