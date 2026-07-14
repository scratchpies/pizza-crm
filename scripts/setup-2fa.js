// One-time setup: generates a fresh TOTP secret and shows a QR code you scan
// once with an authenticator app (Google Authenticator, Authy, 1Password...).
// Run this locally so the secret never leaves your machine:
//   npm run setup-2fa

const { authenticator } = require("otplib");
const qrcode = require("qrcode-terminal");

const secret = authenticator.generateSecret();
const otpauth = authenticator.keyuri("owner", "Scratch Pies CRM", secret);

console.log("\n1) Add this line to your .env file (and later to Vercel's env vars):\n");
console.log(`TOTP_SECRET=${secret}\n`);
console.log("2) Scan this QR code with your authenticator app:\n");
qrcode.generate(otpauth, { small: true });
console.log(`\nCan't scan? Enter this secret manually instead: ${secret}\n`);
console.log("Once TOTP_SECRET is set and the app is restarted, logging in will ask for a 6-digit code after your password.\n");
