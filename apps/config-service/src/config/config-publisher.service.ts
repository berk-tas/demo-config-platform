import { Inject, Injectable, Logger } from "@nestjs/common";
import { execSync } from "node:child_process";
import {
  CONTRACT_VERSION,
  ManifestSchema,
  type Manifest,
} from "@demo/config-contracts";
import { ConsulClient } from "./consul.client";
import { loadAndValidate, type DiscoveredFile } from "./values-loader";

export interface PreviewResult {
  keys: string[];
  configs: Record<string, unknown>;
}

@Injectable()
export class ConfigPublisherService {
  private readonly logger = new Logger(ConfigPublisherService.name);

  constructor(
    @Inject(ConsulClient) private readonly consul: ConsulClient,
  ) {}

  validate(): { files: DiscoveredFile[]; keys: string[] } {
    const { files, keys } = loadAndValidate();
    return { files, keys };
  }

  preview(): PreviewResult {
    const { files, keys } = this.validate();
    const configs: Record<string, unknown> = {};
    for (const f of files) configs[f.key] = f.parsed;
    return { keys, configs };
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
    const { files, keys } = this.validate();
    const v = CONTRACT_VERSION;

    for (const f of files) {
      await this.consul.putKey(`configs/${v}/${f.filename}`, f.raw);
    }

    const manifest: Manifest = ManifestSchema.parse({
      contractVersion: v,
      publishedAt: new Date().toISOString(),
      gitCommit: this.gitCommit(),
      keys,
    });

    await this.consul.putKey(`configs/${v}/manifest.json`, manifest);
    this.logger.log(
      `published configs/${v}/* (manifest written last) keys=[${keys.join(",")}]`,
    );
    return manifest;
  }
}
