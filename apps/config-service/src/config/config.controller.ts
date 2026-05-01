import {
  BadRequestException,
  Controller,
  Get,
  Inject,
} from "@nestjs/common";
import { ZodError } from "zod";
import { CONTRACT_VERSION } from "@demo/config-contracts";
import { ConfigPublisherService } from "./config-publisher.service";

@Controller("config")
export class ConfigController {
  constructor(
    @Inject(ConfigPublisherService)
    private readonly publisher: ConfigPublisherService,
  ) {}

  @Get("version")
  version() {
    return { version: CONTRACT_VERSION };
  }

  @Get("validate")
  validate() {
    try {
      this.publisher.validate();
      return { ok: true, version: CONTRACT_VERSION };
    } catch (err) {
      if (err instanceof ZodError) {
        throw new BadRequestException({ ok: false, issues: err.issues });
      }
      throw err;
    }
  }

  @Get("preview")
  preview() {
    try {
      return this.publisher.preview();
    } catch (err) {
      if (err instanceof ZodError) {
        throw new BadRequestException({ ok: false, issues: err.issues });
      }
      throw err;
    }
  }

  @Get("publish")
  async publish() {
    try {
      const manifest = await this.publisher.publish();
      return { ok: true, manifest };
    } catch (err) {
      if (err instanceof ZodError) {
        throw new BadRequestException({ ok: false, issues: err.issues });
      }
      throw err;
    }
  }
}
