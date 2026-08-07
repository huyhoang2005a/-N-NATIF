import { createHash } from "node:crypto";
import type { ActorContext } from "@r2m/authz";
import type { Database } from "@r2m/database";
import { ConflictError, ErrorCode } from "@r2m/domain";
import { Inject, Injectable } from "@nestjs/common";
import { DATABASE } from "../../../database/database.module";
import { AuditService } from "../../platform-operations/audit/audit.service";
import { OutboxService } from "../../platform-operations/jobs/outbox.service";
import { EmailVerificationRepository } from "./email-verification.repository";

const PURPOSE = "EMAIL_VERIFICATION";
const RESEND_COOLDOWN_MS = 60 * 1000;

/** UC bổ sung 2026-08-07 ("vá lỗ hổng xác minh"): closes the gap where
 * user_account.email_verified_at existed in the schema from the start but had no writer. */
@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly repository: EmailVerificationRepository,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  async confirm(token: string): Promise<void> {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const record = await this.repository.findValidTokenByHash(tokenHash);
    if (!record) {
      throw new ConflictError(
        ErrorCode.AUTH_EMAIL_VERIFICATION_TOKEN_INVALID,
        "Invalid or already-used verification token.",
      );
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new ConflictError(
        ErrorCode.AUTH_EMAIL_VERIFICATION_TOKEN_EXPIRED,
        "This verification link has expired — request a new one.",
      );
    }

    await this.db.transaction(async (tx) => {
      await this.repository.markUsed(record.id, tx);
      await this.repository.markEmailVerified(record.userId, tx);
      await this.auditService.write(
        {
          actorUserId: record.userId,
          action: "user_account.email_verified",
          entityType: "user_account",
          entityId: record.userId,
        },
        tx,
      );
    });
  }

  async resend(actor: ActorContext): Promise<void> {
    if (actor.isEmailVerified) {
      return;
    }

    const latest = await this.repository.findLatestByUserAndPurpose(actor.userId, PURPOSE);
    if (latest && Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS) {
      throw new ConflictError(
        ErrorCode.AUTH_EMAIL_VERIFICATION_RATE_LIMITED,
        "Please wait before requesting another verification email.",
      );
    }

    const user = await this.repository.findUserById(actor.userId);
    if (!user) {
      throw new Error("resend: authenticated actor has no user_account row");
    }

    const { row, rawToken } = await this.repository.createToken(actor.userId, PURPOSE);
    await this.outboxService.append("user_account", actor.userId, {
      type: "EmailVerificationRequested",
      userId: actor.userId,
      email: user.primaryEmail,
      token: rawToken,
      expiresAt: row.expiresAt.toISOString(),
    });
  }
}
