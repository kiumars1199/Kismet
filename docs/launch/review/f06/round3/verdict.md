# F6 #46 delta efb6c1b..57ed4de — PASS with notes (CI web still running at send time)
- Diff: 3 files. HowToBet reads useAvailability(), and venueStatus maps VenueId to F9's VenueKey. Only a type is imported from availability-text, so no JSON reaches the client.
- Checks: vitest lib/venues 28/28; build OK; check:js 146.6 kB (budget 150).
- Bundle: no F9 config in .next/static. The "source_url" hits are the F8 helpline (account/page), and "Wyoming" is US_STATES in the settings picker, which is expected.
- Browser, demo build at 390 and 1440 on /bets and /check?m=6417673:
  - none: "Check Polymarket for your state" / "Check Polymarket US for your state", and no venue is preselected.
  - CA: "Polymarket US: available in California", and Polymarket US is preselected. "Polymarket: not available in California" is shown in warning colour.
  - NV: "Polymarket US: not available in Nevada" and "Polymarket: not available in Nevada", and nothing is preselected.
  - In every case the F9 line above the card's bet button agrees with the guide, and there is no horizontal scroll.
- Note: with no state set, F9's line is a "Check your state" link, but the guide's "Check <venue> for your state" is plain text with no way to set a state from the guide. It is minor wording drift. It also inherits the F9 prod finding: signed out, /settings#state goes to sign-up.
