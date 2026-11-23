# F13 #51 163b468 round 5: FAIL (CI web red; the code passes checks 1-4)
CI web failure (job 137552625937, ci-web.log). Unit 1565/1565 and the first e2e suite 166 passed. The paid e2e suite failed in 2 specs unrelated to F13:
qa-c-billing.spec.ts:7 (page.goto net::ERR_ABORTED /account) and t291-plans.spec.ts:5 (apiRequestContext.get ECONNRESET). Both follow
dev-server "[Error: aborted] ECONNRESET" uncaught exceptions. final 67cab85 web is green, so by the rule this is a FAIL until a rerun is green.
Checks (non-demo next dev with the E2E mock, UNSUBSCRIBE_SECRET set; probe.log):
1. 6771258 (positive-edge non-flag), hand-signed s=1: image bytes are the same as the teaser (42926 B); og:description = TEASER; og:image unsigned.
   /api/share/link for Free/Pro/Premium: no s/sig in the path or the image. PASS
2. 6674492 (flag, side 0): numbers image (50144 B vs 43120 B teaser), numbers description, signed og:image; the link route signs it for all
   three plans (same sig). PASS
3. 6674492 side 1, hand-signed: teaser image + teaser description. PASS
4. Signed out (what a crawler sees), og:description matches the image in all 4 cases at 390 and 1440. PASS
Note: a signed-in GET of an unsigned /m page shows the model line in og:description (paid data for that viewer). Crawlers are signed out.
Unit lib/share 11/11. Disclaimer present for every plan at both widths; share button present.
