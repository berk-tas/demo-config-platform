import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { ConfigController } from "./config/config.controller";
import { ConsulClient } from "./config/consul.client";
import { ConfigPublisherService } from "./config/config-publisher.service";

@Module({
  controllers: [HealthController, ConfigController],
  providers: [ConsulClient, ConfigPublisherService],
})
export class AppModule {}
