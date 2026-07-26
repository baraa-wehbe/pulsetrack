import { NextResponse } from "next/server";

import {
  ASSESSMENT_ACCESS_COOKIE_NAME,
  ASSESSMENT_ACCESS_COOKIE_OPTIONS,
} from "@/config/assessment-access";
import { env } from "@/config/env.mjs";
import { prisma } from "@/lib/prisma";
import { verifyAssessmentAccessCredential } from "@/server/assessments/access";
import {
  PublicAssessmentError,
  submitPublicAssessment,
} from "@/server/assessments/public-service";

const json = (body, init = {}) =>
  NextResponse.json(body, {
    ...init,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      ...init.headers,
    },
  });

const unavailable = () =>
  json(
    {
      error: "This assessment is unavailable.",
      code: "ASSESSMENT_UNAVAILABLE",
    },
    { status: 404 },
  );

export async function POST(request) {
  const credential = request.cookies.get(ASSESSMENT_ACCESS_COOKIE_NAME)?.value;
  const access = verifyAssessmentAccessCredential(credential, env.AUTH_SECRET);
  if (!access) return unavailable();

  let body;
  try {
    body = await request.json();
  } catch {
    return json(
      {
        error: "Every question requires a valid answer.",
        code: "INVALID_ANSWERS",
      },
      { status: 400 },
    );
  }

  try {
    const result = await submitPublicAssessment(
      prisma,
      access.assessmentId,
      body,
    );
    const response = json(result);
    response.cookies.set(ASSESSMENT_ACCESS_COOKIE_NAME, "", {
      ...ASSESSMENT_ACCESS_COOKIE_OPTIONS,
      maxAge: 0,
    });
    return response;
  } catch (error) {
    if (error instanceof PublicAssessmentError) {
      if (error.code === "INVALID_ANSWERS") {
        return json(
          {
            error: "Every question requires a valid answer.",
            code: "INVALID_ANSWERS",
          },
          { status: 400 },
        );
      }
      return unavailable();
    }

    console.error("Public assessment submission failed.", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return json(
      { error: "Internal server error.", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
