import { z } from "zod";
import { CONTRACT_VERSION } from "../version";

export const ManifestSchema = z.object({
  contractVersion: z.literal(CONTRACT_VERSION),
  publishedAt: z.string(),
  gitCommit: z.string(),
  keys: z.array(z.string().regex(/^[A-Za-z0-9_-]+$/).min(1)).min(1),
});

export type Manifest = z.infer<typeof ManifestSchema>;
