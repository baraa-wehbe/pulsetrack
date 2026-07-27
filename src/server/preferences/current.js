import { cookies } from "next/headers";
import { cache } from "react";

import { resolvePreferences } from "@/config/preferences";

export const getRequestPreferences = cache(async () => {
  const cookieStore = await cookies();

  return resolvePreferences(cookieStore);
});
