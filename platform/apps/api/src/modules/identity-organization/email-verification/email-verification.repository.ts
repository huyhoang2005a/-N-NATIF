import { createHash, randomBytes } from "node:crypto";
import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, isNull } from "drizzle-orm";
import { DATABASE } from "../../../database/database.module";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class EmailVerificationRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async findUserById(userId: string) {
    return this.db.query.userAccount.findFirst({ where: eq(schema.userAccount.id, userId) });
  }

  async findValidTokenByHash(tokenHash: string) {
    return this.db.query.emailVerificationToken.findFirst({
      where: and(
        eq(schema.emailVerificationToken.tokenHash, tokenHash),
        isNull(schema.emailVerificationToken.usedAt),
      ),
    });
  }

  async findLatestByUserAndPurpose(userId: string, purpose: string) {
    return this.db.query.emailVerificationToken.findFirst({
      where: and(
        eq(schema.emailVerificationToken.userId, userId),
        eq(schema.emailVerificationToken.purpose, purpose),
      ),
      orderBy: [desc(schema.emailVerificationToken.createdAt)],
    });
  }

  /** Raw token is returned once here and never persisted — only its sha256 hash is stored. */
  async createToken(
    userId: string,
    purpose: string,
    tx?: Database,
  ): Promise<{ row: typeof schema.emailVerificationToken.$inferSelect; rawToken: string }> {
    const client = tx ?? this.db;
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
    const [row] = await client
      .insert(schema.emailVerificationToken)
      .values({ userId, tokenHash, purpose, expiresAt })
      .returning();
    if (!row) throw new Error("createToken: insert returned no row");
    return { row, rawToken };
  }

  async markUsed(id: string, tx: Database): Promise<void> {
    await tx
      .update(schema.emailVerificationToken)
      .set({ usedAt: new Date() })
      .where(eq(schema.emailVerificationToken.id, id));
  }

  async markEmailVerified(userId: string, tx: Database): Promise<void> {
    await tx.update(schema.userAccount).set({ emailVerifiedAt: new Date() }).where(eq(schema.userAccount.id, userId));
  }
}
