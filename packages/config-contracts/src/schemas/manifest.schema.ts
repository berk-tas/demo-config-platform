import { z } from "zod";
import { CONTRACT_VERSION } from "../version";

export const ManifestSchema = z.object({
  contractVersion: z.literal(CONTRACT_VERSION),
  publishedAt: z.string(),
  gitCommit: z.string(),
  keys: z.array(z.enum(["assets", "workspaceSettings"])),
});

export type Manifest = z.infer<typeof ManifestSchema>;
