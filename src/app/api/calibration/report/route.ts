import { runCalibration, reportMarkdown } from "../../../../lib/calibration";
export async function GET() {
  return new Response(reportMarkdown(runCalibration()), { headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": 'attachment; filename="calibration-report.md"' } });
}
