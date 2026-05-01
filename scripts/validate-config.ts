import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ZodError } from "zod";
import {
  ConfigBundleSchema,
  CONTRACT_VERSION,
} from "@demo/config-contracts";

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function main() {
  const dir = join(process.cwd(), "values", CONTRACT_VERSION);
  console.log(`validating ${dir} against contract v${CONTRACT_VERSION}`);

  const assets = readJson(join(dir, "assets.json"));
  const workspaceSettings = readJson(join(dir, "workspaceSettings.json"));

  try {
    ConfigBundleSchema.parse({ assets, workspaceSettings });
    console.log("ok");
  } catch (err) {
    if (err instanceof ZodError) {
      console.error("validation failed:");
      for (const issue of err.issues) {
        const path = issue.path.length ? issue.path.join(".") : "<root>";
        console.error(`  ${path}: ${issue.message}`);
      }
      process.exit(1);
    }
    throw err;
  }
}

main();
