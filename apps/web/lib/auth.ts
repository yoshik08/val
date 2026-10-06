import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

const DEV_AUTH = process.env.VAL_DEV_AUTH === "true";
const GOOGLE_CONFIGURED = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
);

if (DEV_AUTH) {
  // eslint-disable-next-line no-console
  console.warn(
    "[val-web] VAL_DEV_AUTH=true — fake dev sign-in is ENABLED. " +
      "Never enable this in production."
  );
}

const providers: NextAuthConfig["providers"] = [];

if (GOOGLE_CONFIGURED) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    })
  );
}

if (DEV_AUTH) {
  providers.push(
    Credentials({
      id: "dev",
      name: "Dev login",
      credentials: {},
      authorize: async () => {
        return {
          id: "dev-user",
          name: "Dev User",
          email: "dev@localhost",
        };
      },
    })
  );
}

export const authConfig = {
  providers,
  trustHost: true,
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

export { GOOGLE_CONFIGURED, DEV_AUTH };
