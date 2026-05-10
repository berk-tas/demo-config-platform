import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { Octokit } from "@octokit/rest";
import { z } from "zod";
import {
  AssetSchema,
  AssetsSchema,
  CONTRACT_VERSION,
  type Asset,
} from "@demo/config-contracts";

const NetworkInputSchema = z.object({
  isNative: z.boolean(),
  assetAddress: z.string(),
  assetType: z.string().min(1),
  decimals: z.number().int().min(0),
  displayDecimals: z.number().int().min(0),
  isHidden: z.boolean(),
});

export const CreateAssetPrBodySchema = z.object({
  symbol: z.string().min(1),
  name: z.string().min(1),
  coinGeckoId: z.string().min(1),
  icon: z.string().min(1),
  minimumAmountToSweep: z.string().min(1),
  depositSuspended: z.boolean(),
  withdrawSuspended: z.boolean(),
  gasLimit: z.string().min(1).optional(),
  networks: z.record(z.string().min(1), NetworkInputSchema),
});

export type CreateAssetPrBody = z.infer<typeof CreateAssetPrBodySchema>;

export interface CreateAssetPrResult {
  prUrl: string;
  branch: string;
  filePath: string;
}

@Injectable()
export class AssetsPrService {
  private readonly logger = new Logger(AssetsPrService.name);
  private readonly filePath = `values/${CONTRACT_VERSION}/assets.json`;
  private octokit?: Octokit;

  private config() {
    const token = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const baseBranch = process.env.GITHUB_BASE_BRANCH ?? "staging";
    if (!token || !owner || !repo) {
      throw new InternalServerErrorException(
        "GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO must be set",
      );
    }
    if (!this.octokit) {
      this.octokit = new Octokit({ auth: token });
    }
    return { octokit: this.octokit, owner, repo, baseBranch };
  }

  private buildAsset(body: CreateAssetPrBody): Asset {
    const networkEntries = Object.entries(body.networks);
    if (networkEntries.length === 0) {
      throw new InternalServerErrorException(
        "at least one network is required",
      );
    }
    const [, primary] = networkEntries[0];

    const asset: Asset = {
      depositSuspended: body.depositSuspended,
      withdrawSuspended: body.withdrawSuspended,
      symbol: body.symbol,
      name: body.name,
      icon: body.icon,
      coinGeckoId: body.coinGeckoId,
      minimumAmountToSweep: body.minimumAmountToSweep,
      gasLimit: body.gasLimit ?? "0",
      networks: Object.fromEntries(
        networkEntries.map(([chain, n]) => [
          chain,
          {
            chain,
            ...(!n.isNative && n.assetAddress
              ? { contractAddress: n.assetAddress }
              : {}),
            decimals: n.decimals,
          },
        ]),
      ),
      isNative: primary.isNative,
      assetAddress: primary.assetAddress,
      assetType: primary.assetType,
      decimals: primary.decimals,
      displayDecimals: primary.displayDecimals,
      isHidden: primary.isHidden,
    };

    return AssetSchema.parse(asset);
  }

  async createPr(rawBody: unknown): Promise<CreateAssetPrResult> {
    const body = CreateAssetPrBodySchema.parse(rawBody);
    const asset = this.buildAsset(body);

    const { octokit, owner, repo, baseBranch } = this.config();

    const current = await octokit.repos.getContent({
      owner,
      repo,
      path: this.filePath,
      ref: baseBranch,
    });
    if (Array.isArray(current.data) || current.data.type !== "file") {
      throw new InternalServerErrorException(
        `${this.filePath} is not a regular file`,
      );
    }
    const currentSha = current.data.sha;
    const currentText = Buffer.from(current.data.content, "base64").toString(
      "utf8",
    );
    const currentAssets = AssetsSchema.parse(JSON.parse(currentText));

    if (currentAssets.some((a) => a.symbol === asset.symbol)) {
      throw new ConflictException(
        `asset with symbol "${asset.symbol}" already exists`,
      );
    }

    const updated = AssetsSchema.parse([...currentAssets, asset]);
    const updatedText = JSON.stringify(updated, null, 2) + "\n";

    const baseRef = await octokit.repos.getBranch({
      owner,
      repo,
      branch: baseBranch,
    });
    const baseSha = baseRef.data.commit.sha;

    const branch = `add-asset-${body.symbol.toLowerCase()}-${Date.now()}`;
    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branch}`,
      sha: baseSha,
    });

    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: this.filePath,
      branch,
      message: `Add ${body.symbol} asset config`,
      content: Buffer.from(updatedText, "utf8").toString("base64"),
      sha: currentSha,
    });

    const networksList = Object.keys(body.networks)
      .map((n) => `- ${n}`)
      .join("\n");
    const prBody = [
      "### New asset",
      "",
      `- **symbol**: ${body.symbol}`,
      `- **coinGeckoId**: ${body.coinGeckoId}`,
      "",
      "**networks:**",
      networksList,
      "",
      "_Generated by config-service. CI will validate and publish after merge._",
    ].join("\n");

    const pr = await octokit.pulls.create({
      owner,
      repo,
      title: `Add ${body.symbol} asset config`,
      head: branch,
      base: baseBranch,
      body: prBody,
    });

    this.logger.log(
      `opened PR ${pr.data.html_url} (branch=${branch}) for asset ${body.symbol}`,
    );

    return {
      prUrl: pr.data.html_url,
      branch,
      filePath: this.filePath,
    };
  }
}
