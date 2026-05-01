import { Inject, Injectable, Logger } from "@nestjs/common";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  AssetsSchema,
  ConfigBundleSchema,
  CONTRACT_VERSION,
  ManifestSchema,
  WorkspaceSettingsConfigSchema,
  type ConfigBundle,
  type Manifest,
} from "@demo/config-contracts";
import { ConsulClient } from "./consul.client";

@Injectable()
export class ConfigPublisherService {
  private readonly logger = new Logger(ConfigPublisherService.name);

  constructor(
    @Inject(ConsulClient) private readonly consul: ConsulClient,
  ) {}

  private valuesDir(): string {
    const base =
      process.env.VALUES_DIR ?? resolve(__dirname, "../../../../values");
    return join(base, CONTRACT_VERSION);
  }

  private readJson(file: string): unknown {
    const path = join(this.valuesDir(), file);
    return JSON.parse(readFileSync(path, "utf8"));
  }

  loadFromDisk(): { assets: unknown; workspaceSettings: unknown } {
    return {
      assets: this.readJson("assets.json"),
      workspaceSettings: this.readJson("workspaceSettings.json"),
    };
  }

  validate(): ConfigBundle {
    const raw = this.loadFromDisk();
    const assets = AssetsSchema.parse(raw.assets);
    const workspaceSettings = WorkspaceSettingsConfigSchema.parse(
      raw.workspaceSettings,
    );
    return ConfigBundleSchema.parse({ assets, workspaceSettings });
  }

  preview(): ConfigBundle {
    return this.validate();
  }

  private gitCommit(): string {
    if (process.env.GIT_COMMIT) return process.env.GIT_COMMIT;
    try {
      return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
    } catch {
      return "unknown";
    }
  }

  async publish(): Promise<Manifest> {
    const bundle = this.validate();
    const v = CONTRACT_VERSION;

    await this.consul.putKey(`configs/${v}/assets.json`, bundle.assets);
    await this.consul.putKey(
      `configs/${v}/workspaceSettings.json`,
      bundle.workspaceSettings,
    );

    const manifest: Manifest = ManifestSchema.parse({
      contractVersion: v,
      publishedAt: new Date().toISOString(),
      gitCommit: this.gitCommit(),
      keys: ["assets", "workspaceSettings"],
    });

    await this.consul.putKey(`configs/${v}/manifest.json`, manifest);
    this.logger.log(`published configs/${v}/* (manifest rewritten last)`);
    return manifest;
  }
}
