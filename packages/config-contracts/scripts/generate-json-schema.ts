import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { z } from "zod";
import { AssetsSchema } from "../src/schemas/assets.schema";
import { WorkspaceSettingsConfigSchema } from "../src/schemas/workspace-settings.schema";
import { ConfigBundleSchema } from "../src/schemas/config-bundle.schema";
import { ManifestSchema } from "../src/schemas/manifest.schema";
import { CONTRACT_VERSION } from "../src/version";

const outDir = join(__dirname, "..", "generated", "json-schema");
mkdirSync(outDir, { recursive: true });

const targets: Array<[string, z.ZodTypeAny]> = [
  ["assets", AssetsSchema],
  ["workspaceSettings", WorkspaceSettingsConfigSchema],
  ["configBundle", ConfigBundleSchema],
  ["manifest", ManifestSchema],
];

for (const [name, schema] of targets) {
  const json = z.toJSONSchema(schema);
  const withMeta = {
    $id: `https://demo.local/config/${CONTRACT_VERSION}/${name}.json`,
    title: name,
    version: CONTRACT_VERSION,
    ...json,
  };
  const file = join(outDir, `${name}.json`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(withMeta, null, 2) + "\n");
  console.log(`wrote ${file}`);
}
