import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DATABASE } from "../../../database/database.module";

@Injectable()
export class AuthRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async findLocalIdentityByEmail(email: string) {
    const identity = await this.db.query.userIdentity.findFirst({
      where: and(eq(schema.userIdentity.provider, "LOCAL"), eq(schema.userIdentity.providerSubject, email)),
    });
    if (!identity) {
      return null;
    }
    const user = await this.db.query.userAccount.findFirst({
      where: eq(schema.userAccount.id, identity.userId),
    });
    if (!user) {
      return null;
    }
    return { identity, user };
  }

  async findUserById(userId: string) {
    return this.db.query.userAccount.findFirst({
      where: eq(schema.userAccount.id, userId),
    });
  }

  /** Login-gate check (see `AuthService.login`) — the org this user registered and owns,
   * if any. A user only ever holds one ORG_OWNER membership under the current
   * one-owner-per-registration flow, so `findFirst` is enough (not `findMany`). */
  async findOwnedOrganizationStatus(userId: string) {
    const membership = await this.db.query.organizationMember.findFirst({
      where: and(eq(schema.organizationMember.userId, userId), eq(schema.organizationMember.role, "ORG_OWNER")),
      with: { organization: true },
    });
    return membership?.organization ?? null;
  }

  async findLocalIdentityByUserId(userId: string) {
    return this.db.query.userIdentity.findFirst({
      where: and(eq(schema.userIdentity.provider, "LOCAL"), eq(schema.userIdentity.userId, userId)),
    });
  }

  async updatePasswordHash(identityId: string, passwordHash: string, tx?: Database): Promise<void> {
    const client = tx ?? this.db;
    await client.update(schema.userIdentity).set({ passwordHash }).where(eq(schema.userIdentity.id, identityId));
  }

  async touchLastLogin(userId: string): Promise<void> {
    await this.db
      .update(schema.userAccount)
      .set({ lastLoginAt: new Date() })
      .where(eq(schema.userAccount.id, userId));
  }
}
