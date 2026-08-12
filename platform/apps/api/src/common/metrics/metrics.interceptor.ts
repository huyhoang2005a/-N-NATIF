import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from "@nestjs/common";
import type { Request, Response } from "express";
import type { Observable } from "rxjs";
import { httpRequestDurationSeconds, httpRequestsTotal } from "./metrics.registry";

/** Phase 7 Sprint 7.3. Route label uses Express's matched pattern (`/technology-cases/:id`),
 * not the raw URL — otherwise every distinct resource id would create its own metric
 * series (unbounded cardinality, the classic Prometheus footgun). Records on the
 * response's `finish` event rather than the RxJS interceptor's `next`/`error` callbacks —
 * on error, those fire before `DomainErrorFilter` has written the real status code, which
 * would record every failed request as whatever Express's default status was at that
 * point, not the actual 4xx/5xx the client received. */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const start = process.hrtime.bigint();

    res.on("finish", () => {
      const route = (req.route?.path as string | undefined) ?? req.path;
      const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
      const labels = { method: req.method, route, status: String(res.statusCode) };
      httpRequestsTotal.inc(labels);
      httpRequestDurationSeconds.observe(labels, durationSeconds);
    });

    return next.handle();
  }
}
