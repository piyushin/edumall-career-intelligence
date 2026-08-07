import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { AppConfig } from "@edumall/config";
import type { Request, Response } from "express";
import { APP_CONFIG } from "../config/app-config.token";

type CsrfConfig = Pick<
  AppConfig,
  "authCookieSecure" | "authCsrfCookieName" | "authCsrfSecret" | "authSessionTtlSeconds"
>;

@Injectable()
export class CsrfService {
  public constructor(@Inject(APP_CONFIG) private readonly config: CsrfConfig) {}

  public issue(response: Response): string {
    const token = randomBytes(32).toString("base64url");
    const signature = this.sign(token);

    response.cookie(this.config.authCsrfCookieName, `${token}.${signature}`, {
      httpOnly: false,
      maxAge: this.config.authSessionTtlSeconds * 1000,
      path: "/",
      sameSite: "lax",
      secure: this.config.authCookieSecure,
    });
    response.setHeader("cache-control", "no-store");

    return token;
  }

  public validate(request: Request): boolean {
    const supplied = request.headers["x-csrf-token"];
    const header = Array.isArray(supplied) ? supplied[0] : supplied;
    const rawCookie = request.cookies?.[this.config.authCsrfCookieName] as unknown;

    if (!header || typeof rawCookie !== "string") {
      return false;
    }

    const parts = rawCookie.split(".");
    if (parts.length !== 2) {
      return false;
    }

    const [token, signature] = parts;
    if (!token || !signature) {
      return false;
    }

    return this.safeEqual(signature, this.sign(token)) && this.safeEqual(header, token);
  }

  public clear(response: Response): void {
    response.clearCookie(this.config.authCsrfCookieName, {
      httpOnly: false,
      path: "/",
      sameSite: "lax",
      secure: this.config.authCookieSecure,
    });
  }

  private safeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);

    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  }

  private sign(value: string): string {
    return createHmac("sha256", this.config.authCsrfSecret).update(value).digest("base64url");
  }
}
