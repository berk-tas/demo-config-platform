import axios, { AxiosError } from "axios";
import { ZodError } from "zod";
import {
  CONTRACT_VERSION,
  ManifestSchema,
  type Manifest,
} from "@demo/config-contracts";
import { loadAndValidate } from "./lib/load-and-validate";

const baseURL = process.env.CONSUL_HTTP_ADDR ?? "http://localhost:8500";
const token = process.env.CONSUL_HTTP_TOKEN;
const gitCommit = process.env.GIT_COMMIT ?? "local-demo";
const dryRun = process.env.PUBLISH_DRY_RUN === "true";

const http = axios.create({
  baseURL,
  timeout: 10_000,
  headers: token ? { "X-Consul-Token": token } : undefined,
  transformResponse: (r) => r,
});

async function put(key: string, body: string): Promise<void> {
  try {
    const res = await http.put(`/v1/kv/${key}`, body, {
      headers: { "Content-Type": "application/json" },
    });
    const ok =
      res.data === true || res.data === "true" || res.data === "true\n";
    if (!ok) {
      throw new Error(
        `consul PUT ${key} returned status ${res.status} body=${JSON.stringify(res.data)}`,
      );
    }
    console.log(`  PUT ${key} (${body.length} bytes)`);
  } catch (err) {
    if (err instanceof AxiosError) {
      throw new Error(
        `consul PUT ${key} failed: ${err.message} body=${JSON.stringify(err.response?.data)}`,
      );
    }
    throw err;
  }
}

async function main() {
  let files;
  let keys;
  try {
    const result = loadAndValidate();
    files = result.files;
    keys = result.keys;
  } catch (err) {
    if (err instanceof ZodError) {
      console.error("validation failed (no Consul writes):");
      for (const issue of err.issues) {
        const path = issue.path.length ? issue.path.join(".") : "<root>";
        console.error(`  ${path}: ${issue.message}`);
      }
    } else {
      console.error(`validation failed: ${(err as Error).message}`);
    }
    process.exit(1);
  }

  const manifest: Manifest = ManifestSchema.parse({
    contractVersion: CONTRACT_VERSION,
    publishedAt: new Date().toISOString(),
    gitCommit,
    keys,
  });

  const target = `configs/${CONTRACT_VERSION}`;

  if (dryRun) {
    console.log(`DRY RUN — would publish to ${baseURL}`);
    for (const f of files) {
      console.log(`  PUT ${target}/${f.filename} (${f.raw.length} bytes)`);
    }
    console.log(
      `  PUT ${target}/manifest.json (LAST) keys=[${keys.join(",")}]`,
    );
    return;
  }

  console.log(`publishing to ${baseURL}`);
  for (const f of files) {
    await put(`${target}/${f.filename}`, f.raw);
  }
  await put(`${target}/manifest.json`, JSON.stringify(manifest, null, 2));
  console.log(`done — manifest written last with keys=[${keys.join(",")}]`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
