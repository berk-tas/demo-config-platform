import { z } from "zod";

export const AssetNetworkDetailsSchema = z.object({
  chain: z.string().min(1),
  contractAddress: z.string().min(1).optional(),
  decimals: z.number().int().min(0),
});

export const AssetSchema = z.object({
  depositSuspended: z.boolean(),
  withdrawSuspended: z.boolean(),
  symbol: z.string().min(1),
  name: z.string().min(1),
  icon: z.string().min(1),
  coinGeckoId: z.string().min(1),
  minimumAmountToSweep: z.string().min(1),
  gasLimit: z.string().min(1),
  networks: z.record(z.string().min(1), AssetNetworkDetailsSchema),
  isNative: z.boolean(),
  assetAddress: z.string(),
  assetType: z.string().min(1),
  decimals: z.number().int().min(0),
  displayDecimals: z.number().int().min(0),
  isHidden: z.boolean(),
});

export const AssetsSchema = z.array(AssetSchema);

export type AssetNetworkDetails = z.infer<typeof AssetNetworkDetailsSchema>;
export type Asset = z.infer<typeof AssetSchema>;
export type Assets = z.infer<typeof AssetsSchema>;
