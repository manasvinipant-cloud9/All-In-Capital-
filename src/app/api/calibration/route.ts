import { runCalibration } from "../../../lib/calibration";
export async function POST() { return Response.json(runCalibration()); }
