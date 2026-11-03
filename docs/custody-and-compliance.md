# Custody and compliance

- **Sandbox only.** The PayPal client refuses to run unless `PAYPAL_ENV=sandbox`.
- **Custody.** In this prototype the circle's business account receives contributions, pays out the pot and holds
  deposits, so it is custodial. Pre-authorized contributions are not: funds stay in the member's own account until captured.
- **Authorization lifetime.** PayPal honours an authorization for 29 days, and the API reference is inconsistent about
  reauthorization. Turnwise therefore creates one authorization per contribution, 5 days before it is due, never relies on
  reauthorization, and its charter validator refuses rules where lead days + grace days + the cure window could exceed it.
- **Vaulting.** Saving PayPal for merchant-initiated use (`usage_type: MERCHANT`) needs PayPal's approval in production and
  is offered only in listed countries. Without a saved wallet, members are invoiced instead.
- **Payouts.** A batch PayPal accepts can still fail per item (for example `RECEIVER_COUNTRY_NOT_ALLOWED`). Turnwise checks
  every item; a failed amount is held as owed to the member and can be sent again only through the gate.
- **Production paths** (possible, not claimed): a licensed partner on PayPal's multiparty platform, which needs PayPal's
  approval; or a design where members pay each turn's winner directly so the app never holds funds.
- **Regulation.** Pooled and bidding savings circles are regulated in some countries; a production version would need
  legal review in each market.
- **Data.** Demo members are fictional. No real personal or payment data is stored.
