import { Router, type Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { compare, hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import {
  AuthGoogleBody,
  AuthGoogleResponse,
  AuthLoginBody,
  AuthLoginResponse,
  AuthLogoutResponse,
  AuthMeResponse,
  AuthRegisterBody,
  AuthRegisterResponse,
} from "@workspace/api-zod";
import { db, usersTable, type User } from "@workspace/db";
import {
  getSessionUserId,
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  signSessionToken,
} from "../middlewares/auth";

const router = Router();
const googleClient = new OAuth2Client();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function toPublicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
  };
}

function issueSession(res: Response, user: User): void {
  res.cookie(SESSION_COOKIE, signSessionToken(user.id), {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: SESSION_MAX_AGE,
  });
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

function invalidEmail(email: string): boolean {
  return email.length > 254 || !EMAIL_PATTERN.test(email);
}

async function verifyGoogleCredential(credential: string, clientId: string) {
  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: clientId,
  });
  return ticket.getPayload();
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = AuthRegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a name, valid email, and password with at least 8 characters." });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const name = parsed.data.name.trim();
  if (invalidEmail(email) || name.length === 0 || name.length > 100) {
    res.status(400).json({ error: "Enter a valid name and email address." });
    return;
  }

  try {
    const [existingUser] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (existingUser) {
      res.status(409).json({ error: "An account with this email already exists." });
      return;
    }

    const passwordHash = await hash(parsed.data.password, 12);
    const [user] = await db
      .insert(usersTable)
      .values({ email, passwordHash, name })
      .returning();

    issueSession(res, user);
    res
      .status(201)
      .json(AuthRegisterResponse.parse({ user: toPublicUser(user) }));
  } catch (error: unknown) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "An account with this email already exists." });
      return;
    }
    req.log.error({ err: error }, "Failed to register account");
    res.status(500).json({ error: "Unable to create your account right now." });
  }
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = AuthLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a valid email and password." });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  if (invalidEmail(email)) {
    res.status(400).json({ error: "Enter a valid email address." });
    return;
  }

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (!user?.passwordHash || !(await compare(parsed.data.password, user.passwordHash))) {
      res.status(401).json({ error: "Email or password is incorrect." });
      return;
    }

    issueSession(res, user);
    res.json(AuthLoginResponse.parse({ user: toPublicUser(user) }));
  } catch (error: unknown) {
    req.log.error({ err: error }, "Failed to sign in with email");
    res.status(500).json({ error: "Unable to sign in right now." });
  }
});

router.post("/auth/google", async (req, res): Promise<void> => {
  const parsed = AuthGoogleBody.safeParse(req.body);
  if (!parsed.success || parsed.data.credential.length > 10_000) {
    res.status(400).json({ error: "A valid Google sign-in credential is required." });
    return;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    res.status(503).json({ error: "Google sign-in is not configured yet." });
    return;
  }

  let profile: Awaited<ReturnType<typeof verifyGoogleCredential>>;
  try {
    profile = await verifyGoogleCredential(parsed.data.credential, clientId);
  } catch (error: unknown) {
    req.log.warn({ err: error }, "Google credential verification failed");
    res.status(400).json({ error: "Google sign-in could not be verified. Please try again." });
    return;
  }

  if (
    !profile?.sub ||
    !profile.email ||
    profile.email_verified !== true ||
    invalidEmail(profile.email)
  ) {
    res.status(400).json({ error: "Google did not provide a verified email address." });
    return;
  }

  const email = profile.email.trim().toLowerCase();
  try {
    let [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.googleId, profile.sub))
      .limit(1);

    if (!user) {
      const [emailUser] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, email))
        .limit(1);

      if (emailUser) {
        if (emailUser.googleId && emailUser.googleId !== profile.sub) {
          res.status(409).json({ error: "This email is linked to a different Google account." });
          return;
        }

        [user] = await db
          .update(usersTable)
          .set({
            googleId: profile.sub,
            name: emailUser.name ?? profile.name ?? null,
            avatarUrl: emailUser.avatarUrl ?? profile.picture ?? null,
          })
          .where(eq(usersTable.id, emailUser.id))
          .returning();
      } else {
        [user] = await db
          .insert(usersTable)
          .values({
            email,
            googleId: profile.sub,
            name: profile.name ?? null,
            avatarUrl: profile.picture ?? null,
          })
          .returning();
      }
    }

    issueSession(res, user);
    res.json(AuthGoogleResponse.parse({ user: toPublicUser(user) }));
  } catch (error: unknown) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "This Google account is already linked to another user." });
      return;
    }
    req.log.error({ err: error }, "Failed to complete Google sign-in");
    res.status(500).json({ error: "Unable to sign in with Google right now." });
  }
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const userId = getSessionUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) {
      res.clearCookie(SESSION_COOKIE, SESSION_COOKIE_OPTIONS);
      res.status(401).json({ error: "Not signed in." });
      return;
    }

    res.json(AuthMeResponse.parse({ user: toPublicUser(user) }));
  } catch (error: unknown) {
    req.log.error({ err: error }, "Failed to load current user");
    res.status(500).json({ error: "Unable to load your account right now." });
  }
});

router.post("/auth/logout", (_req, res): void => {
  res.clearCookie(SESSION_COOKIE, SESSION_COOKIE_OPTIONS);
  res.json(AuthLogoutResponse.parse({ ok: true }));
});

export default router;
