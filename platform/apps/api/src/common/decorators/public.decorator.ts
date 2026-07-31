import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/** Marks an endpoint as not requiring authentication (login, register-organization, refresh). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
