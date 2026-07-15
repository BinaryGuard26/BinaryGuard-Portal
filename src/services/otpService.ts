import { requestOtp, verifyOtp } from "./api";
export type OtpPurpose = "registration" | "login";
export async function sendOtp(email: string, purpose: OtpPurpose = "login") { return requestOtp(email, purpose); }
export async function confirmOtp(email: string, code: string, purpose: OtpPurpose = "login") { return verifyOtp(email, code, purpose); }
