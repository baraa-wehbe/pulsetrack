import { resolvePreferences } from "@/config/preferences";
import { getTranslations } from "@/i18n/translations";
import { labImportRouteParamsSchema } from "@/lib/lab-import-detail";
import { getLabImportDetail } from "@/server/labs/detail";
import {
  createLabValidationReport,
  getLabValidationReportFilename,
} from "@/server/labs/report";

const notFoundResponse = () =>
  Response.json(
    { error: "Lab import not found." },
    {
      status: 404,
      headers: { "Cache-Control": "no-store, private" },
    },
  );

export const createLabValidationReportHandler =
  ({ prismaClient, onInternalError = console.error }) =>
  async (request, { clinician, params }) => {
    const parsed = labImportRouteParamsSchema.safeParse(await params);
    if (!parsed.success) {
      return notFoundResponse();
    }

    try {
      const labImport = await getLabImportDetail(
        prismaClient,
        clinician.id,
        parsed.data.importId,
        "all",
      );
      if (!labImport) {
        return notFoundResponse();
      }

      const language = resolvePreferences(request.cookies).language;
      const report = createLabValidationReport(
        labImport,
        getTranslations(language),
      );
      return new Response(report, {
        headers: {
          "Cache-Control": "no-store, private",
          "Content-Disposition": `attachment; filename="${getLabValidationReportFilename(labImport.id)}"`,
          "Content-Type": "text/csv; charset=utf-8",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch (error) {
      onInternalError("Lab validation report failed.", {
        name: error instanceof Error ? error.name : "UnknownError",
      });
      return Response.json(
        { error: "Internal server error." },
        {
          status: 500,
          headers: { "Cache-Control": "no-store, private" },
        },
      );
    }
  };
