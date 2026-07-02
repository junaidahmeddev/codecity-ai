import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../../../../apps/backend/src/trpc/router.js';

/**
 * Type-safe React Query hooks generated from our backend tRPC Router.
 * Section 3 Contract 6: Type safety end-to-end.
 */
export const trpc = createTRPCReact<AppRouter>();
