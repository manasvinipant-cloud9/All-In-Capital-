import { costReport } from "../src/lib/costreport.ts";
import { readCalls } from "../src/lib/spend.ts";

console.log(costReport(readCalls()));
