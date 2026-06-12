# Security Specification for LazaroHome

## Data Invariants
1. **Membership**: Every user must have a profile document in `/profiles/{uid}` that contains a valid `code` referencing a document in `/accounts/{code}`.
2. **Admin Privileges**: Administrative actions (modifying settings, managing accounts, toggling settlements) are only permitted if the user's account has `role: 'admin'`.
3. **Expense Integrity**: Expenses must have a positive amount, a valid date (YYYY-MM-DD), and matching server timestamps for `createdAt` and `updatedAt`.
4. **Settlement Isolation**: Settlements are keyed by month (YYYY-MM) and only admins can toggle member statuses.
5. **Account Bootstrapping**: The initial admin account `tan.nd.05` can only be created once if it doesn't exist.

## The "Dirty Dozen" Payloads (Deny Targets)

1. **Self-Promotion**: Non-admin attempts to create an admin account.
   ```json
   // accounts/fake.admin
   { "role": "admin" }
   ```
2. **Profile Hijacking**: User A attempts to create/update profile for User B.
   ```json
   // profiles/UserB_UID
   { "code": "some.code" }
   ```
3. **System Field Poisoning**: Attempt to set `createdAt` manually to a past/future date.
   ```json
   // expenses/new_exp
   { "desc": "Cheat", "amount": 100, "createdAt": "2000-01-01T00:00:00Z" }
   ```
4. **Unauthorized Settlement**: Member (non-admin) attempts to mark themselves as "paid" in settlements.
   ```json
   // settlements/2026-05
   { "MyName": true }
   ```
5. **ID Injection/Poisoning**: Attempt to use a massive/invalid string as month ID.
   ```json
   // settlements/2026-05-very-long-id-poisoning-attack...
   { "Vanh": true }
   ```
6. **Immutable Field Change**: Attempt to change `createdAt` on an existing expense.
   ```json
   // expenses/exp123 (Update)
   { "createdAt": "2021-01-01T00:00:00Z" }
   ```
7. **Role Escalation**: Attempt to change own role in `accounts` from `member` to `admin`.
   ```json
   // accounts/my.member.code
   { "role": "admin" }
   ```
8. **Shadow Field Injection**: Adding undocumented fields to an expense.
   ```json
   // expenses/new_exp
   { "desc": "Lunch", "amount": 20, "is_hacked": true, ... }
   ```
9. **Negative Amount**: Creating an expense with a negative amount.
   ```json
   // expenses/new_exp
   { "amount": -1000 }
   ```
10. **Unauthenticated Read**: Attempt to read settlements or expenses without being signed in.
11. **Settings Destruction**: Attempt to delete the `house` settings document.
12. **Orphaned Profile**: Create a profile pointing to a non-existent account code.

## Test Runner (Logic)
The following Firestore Security Rules are designed to block these payloads.
The `isAdmin()` helper will strictly verify roles via a nested lookup that is mathematically grounded in the existing profile.
