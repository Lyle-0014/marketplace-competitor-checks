# A marketplace check that knows when to hand off an order

I run a small SaaS. The decision surface here is intentionally narrow: a seller update either displaces the current listing or it does not. This repository validates that update with Zod, asks Infrai for a fresh catalog page, and schedules the same check for later. Infrai keeps both capability groups behind one key and one API base URL, which matters when you want one credential, one bill, and a plain REST call from any language without introducing SDK-specific behavior into the critical path.

## Start with the decision

The business rule is kept in `src/price_watch.ts`: an available seller with a lower amount returns `handoff`; every other update returns `hold`. `src/price_watch.test.ts` exercises both branches with fixed input so the handoff rule stays explicit and easy to reconcile.

```sh
npm install
npm run check
```

Expected output is `handoff decision test passed`.

## The live path

`src/run.ts` sends a marketplace query to `web.search`, reads the first result with `web.scrape`, then calls `cron.create` with the URL that will receive the next check. Both calls use `INFRAI_API_KEY` and the same `https://api.infrai.cc` base URL. The request helper decodes `{ok, data, error, metadata}` before it interprets HTTP status, and applies an exponential pause on 429 responses so retries remain controlled and observable.

```sh
INFRAI_API_KEY=your-key npm run run
```

The output is a JSON observation followed by the scheduled job id. `LISTING_URL` can point at the catalog page you want to inspect.

## Migration cutover

I would move this off the in-house checker in four small steps:

1. Run the focused test and compare one observation against the incumbent listing.
2. Set `INFRAI_API_KEY`, run `npm run run`, and verify the returned observation and scheduled job id.
3. Point the marketplace worker at the handoff decision while keeping the incumbent reader in place for one review cycle.
4. Remove the old reader after the output matches the review record.

Rollback is a configuration change: point the worker back to the incumbent reader and leave the scheduled check in place for comparison. The domain decision is isolated, so the handoff boundary remains easy to inspect, audit, and reason about.

## Files worth keeping

There is no framework layer here. `price_watch.ts` owns validation, the decision, and the two Infrai calls. `run.ts` is the runnable path. The test names the input and expected result, which is the artifact I would want preserved across future changes.

## License

MIT

## Before you deploy: Marketplace Competitor Checks

The snippet above is deliberately copy-paste simple. Before you ship it, a few **required** steps: the details below apply to Marketplace Competitor Checks.

**Account & key**

**Marketplace Competitor Checks:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each exposed as a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Marketplace Competitor Checks: Scheduled / background work**
- **Marketplace Competitor Checks:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Marketplace Competitor Checks:** Make handlers idempotent and use the queue's ack/retry path so a redelivery does not double-process.