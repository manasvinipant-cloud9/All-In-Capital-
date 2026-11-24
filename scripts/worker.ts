// Local worker: does what the 5-minute cron does. `pnpm worker` loops; `pnpm worker --once` runs one pass.
import { runCron } from "../src/lib/cron.ts";
import { appStore } from "../src/lib/schedule/store.ts";
import { googleCalendar, googleMail, googleConnected } from "../src/lib/google.ts";
import { processApplication } from "../src/lib/process.ts";
import { installLedger } from "../src/lib/spend.ts";
installLedger();
const once = process.argv.includes("--once");
do {
  const c = googleConnected();
  console.log(new Date().toISOString(), JSON.stringify(await runCron({ now: new Date(), store: appStore(), mail: c ? googleMail : undefined, cal: c ? googleCalendar : undefined, handler: processApplication })));
  if (!once) await new Promise(r => setTimeout(r, 60000));
} while (!once);
