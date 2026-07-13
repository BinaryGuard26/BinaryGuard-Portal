import OTPForm from '../components/OTPForm';

interface VerifyOTPProps {
  email: string;
  verifyOtp: (email: string, otp: string) => Promise<void>;
  resendOtp?: (email: string) => Promise<void>;
  onVerified: () => void;
}

export default function VerifyOTP({
  email,
  verifyOtp,
  resendOtp,
  onVerified,
}: VerifyOTPProps) {
  const handleVerify = async (otp: string) => {
    await verifyOtp(email, otp);
    onVerified();
  };

  const handleResend = resendOtp
    ? async () => {
        await resendOtp(email);
      }
    : undefined;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16">
      <section className="mx-auto max-w-xl">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-teal-700">
          Identity verification
        </p>

        <h1 className="mb-3 text-3xl font-bold text-slate-950">Verify your identity</h1>

        <p className="mb-8 text-slate-600">
          We sent a six-digit verification code to{' '}
          <strong className="text-slate-800">{email}</strong>. The code expires in 10 minutes.
        </p>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <OTPForm
            onVerify={handleVerify}
            onResend={handleResend}
            codeLength={6}
            expiresInSeconds={600}
            attemptsRemaining={3}
          />
        </div>
      </section>
    </main>
  );
}
