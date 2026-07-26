import {
  LAB_CSV_TEMPLATE_FILENAME,
  readLabCsvTemplate,
} from "@/server/labs/template";

export const createLabTemplateDownloadHandler =
  ({ readTemplate = readLabCsvTemplate } = {}) =>
  async () => {
    try {
      const template = await readTemplate();

      return new Response(template, {
        headers: {
          "Cache-Control": "no-store, private",
          "Content-Disposition": `attachment; filename="${LAB_CSV_TEMPLATE_FILENAME}"`,
          "Content-Type": "text/csv; charset=utf-8",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch (error) {
      console.error("Lab CSV template download failed.", {
        name: error instanceof Error ? error.name : "UnknownError",
      });
      return Response.json(
        { error: "Internal server error." },
        { status: 500 },
      );
    }
  };
