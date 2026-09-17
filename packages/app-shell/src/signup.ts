import { countOperators, isSignupOpen } from "@repo/auth/signup";
import { prisma } from "@repo/db";
import { connection } from "next/server";
import { cache } from "react";

const getSignupState = cache(async (): Promise<{ open: boolean }> => {
  await connection();
  return { open: isSignupOpen(await countOperators(prisma)) };
});

export { getSignupState };
export { SIGNUP_CLOSED_MESSAGE } from "@repo/auth/signup";
