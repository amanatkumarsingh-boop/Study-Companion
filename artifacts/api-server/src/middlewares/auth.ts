import { sign, verify, type JwtPayload } from "jsonwebtoken";
import type { Request, RequestHandler } from "express";

export const SESSION_COOKIE = "study_session";
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

const SESSION_ISSUER = "study-companion";

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET must be set.");
  }
  return secret;
}

export function getSessionUserId(req: Request): string | null {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token !== "string" || token.length === 0) {
    return null;
  }

  try {
    const payload = verify(token, getSessionSecret(), {
      algorithms: ["HS256"],
      issuer: SESSION_ISSUER,
    }) as JwtPayload;
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export const requireAuth: RequestHandler = (req, res, next): void => {
  const userId = getSessionUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Please sign in to continue." });
    return;
  }

  res.locals.authUserId = userId;
  next();
};

export function signSessionToken(userId: string): string {
  return sign({ sub: userId }, getSessionSecret(), {
    algorithm: "HS256",
    expiresIn: "7d",
    issuer: SESSION_ISSUER,
  });
}
