import { cookies } from "next/headers";

import { resolvePreferences } from "@/config/preferences";

export const getRequestPreferences = async () => {
  const cookieStore = await cookies();

  return resolvePreferences(cookieStore);
};
