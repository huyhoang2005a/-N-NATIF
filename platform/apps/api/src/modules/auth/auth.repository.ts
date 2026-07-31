import type { Database } from "@r2m/db";
import { schema } from "@r2m/db";
import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DATABASE } from "../../database/database.module";

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

  async touchLastLogin(userId: string): Promise<void> {
    await this.db
      .update(schema.userAccount)
      .set({ lastLoginAt: new Date() })
      .where(eq(schema.userAccount.id, userId));
  }
}
