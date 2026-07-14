import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { customersRouter } from "./routers/customers";
import { salesNotesRouter } from "./routers/salesNotes";
import { followUpsRouter } from "./routers/followUps";
import { installmentsRouter } from "./routers/installments";
import { salesOpportunitiesRouter } from "./routers/salesOpportunities";
import { lostDealsRouter } from "./routers/lostDeals";
import { teamsRouter } from "./routers/teams";
import { usersRouter } from "./routers/usersRouter";
import { leadSourcesRouter } from "./routers/leadSources";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // CRM feature routers — Phase 1 (backend + permissions)
  customers: router(customersRouter),
  salesNotes: router(salesNotesRouter),
  followUps: router(followUpsRouter),
  installments: router(installmentsRouter),
  salesOpportunities: router(salesOpportunitiesRouter),
  lostDeals: router(lostDealsRouter),
  teams: router(teamsRouter),
  users: router(usersRouter),
  leadSources: router(leadSourcesRouter),
});

export type AppRouter = typeof appRouter;
