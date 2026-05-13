# Security Specification - Lazaro Expense Tracker

## Data Invariants
1. `AppSettings` (settings/house) must contain a `members` list.
2. `Expense` documents must have an `amount` > 0.
3. `Expense` documents must have a `payer` who is a current member.
4. `Expense` documents must have a `split` list containing only current members.
5. All updates must refresh the `updatedAt` timestamp with the server time.

## The Dirty Dozen Payloads

1. **Identity Spoofing**: Attempt to create an expense where `payer` is "Admin" (not a member).
2. **Resource Poisoning**: High-size string in `desc` (e.g., 2MB).
3. **Ghost Field**: Adding `isVerified: true` to an expense.
4. **Invalid Type**: Setting `amount` to a string "1000".
5. **Orphaned Write**: Creating an expense without a corresponding `settings/house` document existing (if rules required it).
6. **Self-Assigned Role**: (N/A as there are no roles yet, but we'll prevent adding arbitrary keys to settings).
7. **Timestamp Spoofing**: Setting `createdAt` to a date in 2020.
8. **Negative Amount**: Setting `amount` to -100.
9. **Empty Split**: Creating an expense with `split: []`.
10. **ID Hijacking**: Attempting to update the `id` field of a document.
11. **PII Leak**: (N/A for this app currently as it's simple names, but we'll restrict broad reads if we added emails).
12. **Unauthorized Deletion**: (If we had owners, currently anyone can edit/delete).

## Test Runner (Mocks for Rules)
The `firestore.rules.test.ts` would verify that these payloads return PERMISSION_DENIED.
