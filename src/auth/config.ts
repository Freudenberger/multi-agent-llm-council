import { randomBytes } from "node:crypto";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { userStorage } from "./userStorage";
import { logger } from "@/core/logger";

const credentialsSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

/**
 * Resolve the Auth.js signing secret. Prefer the configured `AUTH_SECRET`; when
 * it is absent (zero-config / demo deploys) fall back to a per-process random
 * secret so the app still boots instead of crashing with `MissingSecret`.
 *
 * The fallback is generated at runtime — never a committed constant — so there
 * is no shared, guessable secret that would let anyone forge sessions. The
 * trade-off is that sessions are invalidated whenever the process restarts;
 * set `AUTH_SECRET` for stable, multi-instance sessions in real deployments.
 */
function resolveAuthSecret(): string {
  const configured = process.env.AUTH_SECRET;
  if (configured && configured.length > 0) return configured;

  logger.error(
    "AUTH_SECRET is not set — generating an ephemeral secret for this process. " +
      "Sessions will not survive restarts and won't work across instances. " +
      "Set AUTH_SECRET for production-grade auth.",
  );
  return randomBytes(32).toString("base64");
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Signing secret — falls back to an ephemeral random value when AUTH_SECRET
  // is unset so the app boots zero-config (see resolveAuthSecret).
  secret: resolveAuthSecret(),
  // Self-hosted behind a reverse proxy (Render, Docker). Auth.js otherwise
  // infers the request host from the internal address (e.g. localhost:10000)
  // and rejects it with `UntrustedHost`; trusting the proxy's forwarded host
  // makes session/callback URLs resolve to the real public origin.
  trustHost: true,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await userStorage.findByEmail(email);
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
