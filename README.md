# BinaryGuard Portal

Single ZIP-ready React + Vite bundle for `portal.binaryguard.ca`.

## Run
```bash
npm install
npm run dev
```

## Deploy on DigitalOcean App Platform
- Build command: `npm install && npm run build`
- Output directory: `dist`
- Domain: `portal.binaryguard.ca`

## Flow
1. User Authentication
2. OTP Verification
3. Service Authorization
4. Access Card Order Portal

Layer 2 is locked until OTP verification. Layer 3 is locked until Service Authorization. Logout resets to Layer 1.
