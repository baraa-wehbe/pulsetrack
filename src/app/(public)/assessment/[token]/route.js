import { NextResponse } from "next/server";

import {
  ASSESSMENT_ACCESS_COOKIE_NAME,
  ASSESSMENT_ACCESS_COOKIE_OPTIONS,
} from "@/config/assessment-access";
import { env } from "@/config/env.mjs";
import { prisma } from "@/lib/prisma";
import { createAssessmentAccessCredential } from "@/server/assessments/access";
import { exchangeAssessmentToken } from "@/server/assessments/public-service";

const unavailableResponse = (request) => {
  const response = NextResponse.redirect(
    new URL("/assessment?state=unavailable", request.url),
    303,
  );
  response.cookies.set(ASSESSMENT_ACCESS_COOKIE_NAME, "", {
    ...ASSESSMENT_ACCESS_COOKIE_OPTIONS,
    maxAge: 0,
  });
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
};

export async function GET(request, { params }) {
  const { token } = await params;
  let exchanged;
  try {
    exchanged = await exchangeAssessmentToken(prisma, token);
  } catch (error) {
    console.error("Public assessment access exchange failed.", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
  }
  if (!exchanged) return unavailableResponse(request);

  const response = NextResponse.redirect(
    new URL("/assessment", request.url),
    303,
  );
  response.cookies.set(
    ASSESSMENT_ACCESS_COOKIE_NAME,
    createAssessmentAccessCredential(exchanged.assessmentId, env.AUTH_SECRET),
    ASSESSMENT_ACCESS_COOKIE_OPTIONS,
  );
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
