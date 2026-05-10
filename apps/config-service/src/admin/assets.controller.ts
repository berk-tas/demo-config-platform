import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  Post,
} from "@nestjs/common";
import { ZodError } from "zod";
import { AssetsPrService } from "./assets-pr.service";

@Controller("admin/assets")
export class AssetsController {
  constructor(
    @Inject(AssetsPrService) private readonly service: AssetsPrService,
  ) {}

  @Post("create-pr")
  async createPr(@Body() body: unknown) {
    try {
      return await this.service.createPr(body);
    } catch (err) {
      if (err instanceof ZodError) {
        throw new BadRequestException({ ok: false, issues: err.issues });
      }
      throw err;
    }
  }
}
