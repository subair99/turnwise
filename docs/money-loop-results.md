Ledger balances (positive = net debit):
┌─────────┬───────────────────────────────────────────────┬─────────┐
│ (index) │ account                                       │ balance │
├─────────┼───────────────────────────────────────────────┼─────────┤
│ 0       │ 'cash:circle'                                 │ '$0.00' │
│ 1       │ 'pot:cycle-1'                                 │ '$0.00' │
│ 2       │ 'liability:deposit:cmw0l3czj0004ug9a819gqjix' │ '$0.00' │
│ 3       │ 'pot:cycle-2'                                 │ '$0.00' │
└─────────┴───────────────────────────────────────────────┴─────────┘

Audit log:
┌─────────┬───────────────┬───────────────────┬─────────┬─────────────────────┬────────────────────────────────────────────────────────────────────────────────────┐
│ (index) │ agent         │ kind              │ allowed │ paypalId            │ reasons                                                                            │
├─────────┼───────────────┼───────────────────┼─────────┼─────────────────────┼────────────────────────────────────────────────────────────────────────────────────┤
│ 0       │ 'member'      │ 'create_payin'    │ true    │ '0MN298555B920134V' │ ''                                                                                 │
│ 1       │ 'member'      │ 'capture_payin'   │ true    │ '9Y268131SB237390J' │ ''                                                                                 │
│ 2       │ 'member'      │ 'create_payin'    │ true    │ '7N412326JF059073W' │ ''                                                                                 │
│ 3       │ 'member'      │ 'capture_payin'   │ true    │ '9S921088JS536105X' │ ''                                                                                 │
│ 4       │ 'treasurer'   │ 'payout_batch'    │ true    │ '3KWEBAMYVMFSA'     │ ''                                                                                 │
│ 5       │ 'replay-test' │ 'payout_batch'    │ false   │ ''                  │ 'already executed (idempotency); cycle not settling; payout exceeds collected pot' │
│ 6       │ 'guardian'    │ 'create_preauth'  │ true    │ '10L24016MM1045053' │ ''                                                                                 │
│ 7       │ 'guardian'    │ 'capture_preauth' │ true    │ '19Y4852043407335V' │ ''                                                                                 │
│ 8       │ 'guardian'    │ 'create_preauth'  │ true    │ '6LV61341H7107134C' │ ''                                                                                 │
│ 9       │ 'guardian'    │ 'capture_preauth' │ true    │ '8DL83796TB255194K' │ ''                                                                                 │
│ 10      │ 'treasurer'   │ 'payout_batch'    │ true    │ '4G3GZ6BY8WKTA'     │ ''                                                                                 │
│ 11      │ 'treasurer'   │ 'refund_deposit'  │ true    │ 'ZK9572N56DCJC'     │ ''                                                                                 │
└─────────┴───────────────┴───────────────────┴─────────┴─────────────────────┴────────────────────────────────────────────────────────────────────────────────────┘

Results:
┌─────────┬───────────────────────────────────┬───────────────────────────────────────────────────────────────────────────────────────────┐
│ (index) │ check                             │ result                                                                                    │
├─────────┼───────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────┤
│ 0       │ 'cycle 1 pay-in Ada'              │ 'PASS'                                                                                    │
│ 1       │ 'wallet saved Ada'                │ 'PASS'                                                                                    │
│ 2       │ 'cycle 1 pay-in Bola'             │ 'PASS'                                                                                    │
│ 3       │ 'wallet saved Bola'               │ 'PASS'                                                                                    │
│ 4       │ 'cycle 1 payout batch'            │ 'PASS — 3KWEBAMYVMFSA'                                                                    │
│ 5       │ 'replayed payout refused by gate' │ 'PASS — already executed (idempotency); cycle not settling; payout exceeds collected pot' │
│ 6       │ 'cycle 2 pre-auth + capture Ada'  │ 'PASS'                                                                                    │
│ 7       │ 'cycle 2 pre-auth + capture Bola' │ 'PASS'                                                                                    │
│ 8       │ 'cycle 2 payout batch'            │ 'PASS — 4G3GZ6BY8WKTA'                                                                    │
│ 9       │ 'cycle pots cleared'              │ 'PASS — $0.00, $0.00'                                                                     │
│ 10      │ 'circle cash back to $0.00'       │ 'PASS — $0.00'                                                                            │
│ 11      │ 'deposit liabilities cleared'     │ 'PASS — $0.00'                                                                            │
│ 12      │ 'ledger sums to zero'             │ 'PASS'                                                                                    │
└─────────┴───────────────────────────────────┴───────────────────────────────────────────────────────────────────────────────────────────┘