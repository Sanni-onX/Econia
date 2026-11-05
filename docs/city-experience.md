# City experience verification

The World is now the primary interface. Its map stays mounted when a person, business or story opens, and closing a panel preserves the camera. Four player destinations are World, Discover, Exchange and My Econia; the Chronicle has its own labelled control. Developer tools are available at `?dev=1`.

Verified journey on the existing NEAR testnet checkpoint:

1. Enter the city and meet Mira.
2. Open her Sunrise Bakery and inspect its worker, stock and recorded counterparties.
3. Revisit Mira’s cycle 6 founding decision, including recorded capital, reserve, margin estimate and quoted prices.
4. Open the sponsorship preview without a wallet. Recipient, amount, discretion, ownership restriction and lack of guaranteed return are explicit.
5. Follow Mira without a wallet, open My Econia, and reload to verify persistence.

Desktop camera continuity was checked by comparing the map transform before and after closing a panel. Mobile was checked at 390 × 844: the sheet fits the viewport, document width stays 390 pixels, and bottom navigation remains available. Browser checks did not submit a sponsorship or purchase.

History APIs retain important decisions separately from routine activity and serve recorded Chronicle milestones. World motion requires a connected stream and a recently observed or persisted cycle advance. Chain settlement notices are excluded from the story feed.

## Current operational limitation

The existing testnet operator allowance cannot cover the next settlement. The app serves the last confirmed checkpoint, labels settlement as delayed, stops activity animations and disables connected participation until recovery. The pending stage remains intact. Restoring automatic testnet advancement requires renewing the restricted operator allowance; wallet permissions and funds were not changed during this redesign.

## Validation

- Production frontend build passes.
- 22 automated tests pass; the PostgreSQL integration test requires `TEST_DATABASE_URL` and was skipped locally. GitHub CI supplies PostgreSQL.
- Coverage includes retained founding choices after 280 additional cycles, Chronicle history, grouping of routine choices, suppression of settlement stories, and readable confirmed state during a settlement failure.
- Screenshots: [city](screenshots/city-world.png), [Mira](screenshots/city-mira.png), [mobile](screenshots/city-mobile.png).
