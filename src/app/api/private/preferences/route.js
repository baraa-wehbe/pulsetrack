import { NextResponse } from "next/server";

import {
  PREFERENCE_COOKIE_NAMES,
  PREFERENCE_COOKIE_OPTIONS,
} from "@/config/preferences";
import { withClinicianAuthentication } from "@/server/auth/api";
import { preferenceUpdateSchema } from "@/server/preferences/validation";

export const POST = withClinicianAuthentication(async (request) => {
  let payload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid preference input." },
      { status: 400 },
    );
  }

  const parsed = preferenceUpdateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid preference input." },
      { status: 400 },
    );
  }

  const response = NextResponse.json({
    preference: {
      kind: parsed.data.kind,
      value: parsed.data.value,
    },
  });

  response.cookies.set(
    PREFERENCE_COOKIE_NAMES[parsed.data.kind],
    parsed.data.value,
    PREFERENCE_COOKIE_OPTIONS,
  );
  response.headers.set("Cache-Control", "no-store");

  return response;
});
