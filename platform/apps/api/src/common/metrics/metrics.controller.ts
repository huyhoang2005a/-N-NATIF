import { Controller, Get, Header } from "@nestjs/common";
import { Public } from "../decorators/public.decorator";
import { metricsRegistry } from "./metrics.registry";

@Controller("metrics")
export class MetricsController {
  @Public()
  @Get()
  @Header("Content-Type", metricsRegistry.contentType)
  async get(): Promise<string> {
    return metricsRegistry.metrics();
  }
}
