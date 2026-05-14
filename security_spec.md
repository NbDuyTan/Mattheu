# Security Specification - Expense Tracker

## 1. Data Invariants
- An expense must have a date, description, amount, payer, and at least one person in the split list.
- Settings must have a list of members, a title, and a default payer.
- Only signed-in users can read or write data.

## 2. The "Dirty Dozen" Payloads (Red Team Test Cases)

1. **Identity Spoofing (Create)**: Creating an expense with a future `createdAt` timestamp.
2. **Identity Spoofing (Update)**: Attempting to change the `createdAt` of an existing expense.
3. **Ghost Field Injection**: Adding an `isAdmin: true` field to an expense document.
4. **Value Poisoning**: Setting `amount` to a string or a negative number.
5. **ID Poisoning**: Using a 1MB string as an expense ID.
6. **Relation Orphanage**: Creating an expense without a required `payer`.
7. **Size Exhaustion**: Providing a description longer than 500 characters.
8. **Unauthorized Update**: Changing the `payer` of an expense to someone else (if ownership was strict, but here it's shared tracker).
9. **Settings Hijack**: Removing all members from the house settings.
10. **Timestamp Spoofing**: Setting `updatedAt` to a client-provided time instead of `request.time`.
11. **Type Mismatch**: Sending a string for the `split` array.
12. **Field Deletion**: Removing the `amount` field in an update.

## 3. Test Runner Plan
Using `firestore.rules.test.ts` to verify these constraints. (Note: In this environment we deploy directly, but we use the spec to derive the rules).
