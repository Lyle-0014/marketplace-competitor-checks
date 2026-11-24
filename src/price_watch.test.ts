import assert from "node:assert/strict";
import { decideHandoff, parseSellerUpdate } from "./price_watch.ts";

const update = parseSellerUpdate({ seller: "rival", amount: 80, available: true, observedAt: "2026-10-24T00:00:00Z" });
assert.equal(decideHandoff(update, 100), "handoff");
assert.equal(decideHandoff({ ...update, available: false }, 100), "hold");
console.log("handoff decision test passed");
