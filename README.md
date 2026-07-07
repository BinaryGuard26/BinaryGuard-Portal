# BinaryGuard Portal - User/Organization Display Fix

Replace:

```text
src/App.tsx
```

Changes:
- User display name is generated from login email username.
- `azeem.akram@binaryguard.ca` displays as `Azeem Akram`.
- `@binaryguard.ca` displays organization as `BinaryGuard Innovations Inc.`.
- `@gov.mb.ca` displays organization as `Government of Manitoba`.
- Authorized Services heading uses the logged-in user's organization.
- Top-right user card uses the correct logged-in user and organization.
