import { test } from "node:test"; import assert from "node:assert/strict";
import { failures } from "../scripts/contrast.ts";
test("every text/background token pair passes WCAG AA in both themes", () => assert.deepEqual(failures(), []));
