import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { ConfigController } from "./config/config.controller";
import { ConsulClient } from "./config/consul.client";
import { ConfigPublisherService } from "./config/config-publisher.service";
import { AssetsController } from "./admin/assets.controller";
import { AssetsPrService } from "./admin/assets-pr.service";

@Module({
  controllers: [HealthController, ConfigController, AssetsController],
  providers: [ConsulClient, ConfigPublisherService, AssetsPrService],
})
export class AppModule {}
