import { collectObservation, scheduleChecks } from "./price_watch.ts";

const listing = process.env.LISTING_URL ?? "https://example.com/catalog/sku-42";
const result = await collectObservation({
  listing: "sku-42",
  sourceUrl: listing,
  seller: "incumbent",
  amount: 100,
  observedAt: new Date().toISOString()
});
console.log(JSON.stringify(result, null, 2));
const job = await scheduleChecks("https://example.com/marketplace/checks");
console.log(`scheduled ${job.job_id}`);
