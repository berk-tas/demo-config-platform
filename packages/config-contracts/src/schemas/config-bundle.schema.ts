import { z } from "zod";
import { AssetsSchema } from "./assets.schema";
import { WorkspaceSettingsConfigSchema } from "./workspace-settings.schema";

export const ConfigBundleSchema = z
  .object({
    assets: AssetsSchema,
    workspaceSettings: WorkspaceSettingsConfigSchema,
  })
  .strict();

export type ConfigBundle = z.infer<typeof ConfigBundleSchema>;
