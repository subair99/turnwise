# Custody and compliance

- **Sandbox only.** The PayPal client refuses to run unless `PAYPAL_ENV=sandbox`.
- **Custody.** In this prototype the circle's business account receives contributions, pays out the pot and holds
  deposits, so it is custodial. Pre-authorized contributions are not: funds stay in the member's account until captured.
- **Authorization lifetime.** PayPal authorizations are valid for 29 days with a 3-day honor period; after 30 days a new
  authorization is required. Turnwise therefore creates one authorization per contribution, 5 days before it is due,
  and does not rely on reauthorization.
- **Vaulting.** Saving PayPal for merchant-initiated use needs PayPal approval in production and is limited to listed
  countries. The fallback is a one-tap approval link in the reminder.
- **Production paths.** A licensed partner on PayPal's multiparty platform (requires PayPal approval), or a version in
  which members pay each turn's winner directly. Pooled and bidding savings circles are regulated in some countries.
