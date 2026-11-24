import { authRouter } from "./auth-router";
import { createRouter, publicQuery } from "./middleware";
import { adminRouter, novelRouter, progressRouter } from "./library-router";
import { membershipRouter } from "./membership-router";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  novel: novelRouter,
  progress: progressRouter,
  membership: membershipRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
