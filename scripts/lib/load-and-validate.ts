import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import {
  ConfigBundleSchema,
  CONTRACT_VERSION,
} from "@demo/config-contracts";

export interface DiscoveredFile {
  key: string;
  filename: string;
  raw: string;
  parsed: unknown;
}

export interface LoadResult {
  files: DiscoveredFile[];
  keys: string[];
  valuesDir: string;
}

const KEY_REGEX = /^[A-Za-z0-9_-]+$/;

export function loadAndValidate(): LoadResult {
  const repoRoot = resolve(__dirname, "..", "..");
  const valuesDir = join(repoRoot, "values", CONTRACT_VERSION);

  if (!existsSync(valuesDir) || !statSync(valuesDir).isDirectory()) {
    throw new Error(`values directory not found: ${valuesDir}`);
  }

  const filenames = readdirSync(valuesDir)
    .filter((f) => extname(f) === ".json" && f !== "manifest.json")
    .sort();

  if (filenames.length === 0) {
    throw new Error(`no JSON config files in ${valuesDir}`);
  }

  const files: DiscoveredFile[] = [];
  const map: Record<string, unknown> = {};

  for (const filename of filenames) {
    const key = filename.slice(0, -".json".length);
    if (!KEY_REGEX.test(key)) {
      throw new Error(
        `unsafe config filename "${filename}" — basename must match ${KEY_REGEX}`,
      );
    }
    const raw = readFileSync(join(valuesDir, filename), "utf8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error(`failed to parse ${filename}: ${(err as Error).message}`);
    }
    files.push({ key, filename, raw, parsed });
    map[key] = parsed;
  }

  ConfigBundleSchema.parse(map);

  const keys = files.map((f) => f.key);
  return { files, keys, valuesDir };
}
