import { FormEvent, useEffect, useRef, useState } from 'react';

interface OTPFormProps {
  onVerify: (otp: string) => Promise<void>;
  onResend?: () => Promise<void>;
  disabled?: boolean;
  codeLength?: number;
  attemptsRemaining?: number;
  expiresInSeconds?: number;
}

export default function OTPForm({
  onVerify,
  onResend,
  disabled = false,
  codeLength = 6,
  attemptsRemaining = 3,
  expiresInSeconds = 600,
}: OTPFormProps) {
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(expiresInSeconds);
  const lastSubmittedCode = useRef('');

  useEffect(() => {
    setSecondsRemaining(expiresInSeconds);
  }, [expiresInSeconds]);

  useEffect(() => {
    if (secondsRemaining <= 0) return;

    const timer = window.setInterval(() => {
      setSecondsRemaining((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [secondsRemaining]);

  const verifyCode = async (code: string) => {
    if (
      disabled ||
      isVerifying ||
      secondsRemaining <= 0 ||
      code.length !== codeLength ||
      lastSubmittedCode.current === code
    ) {
      return;
    }

    lastSubmittedCode.current = code;
    setIsVerifying(true);
    setError('');

    try {
      await onVerify(code);
    } catch (verificationError) {
      console.error('OTP verification failed:', verificationError);
      setError(
        verificationError instanceof Error
          ? verificationError.message
          : 'Invalid or expired verification code.',
      );
      setOtp('');
      lastSubmittedCode.current = '';
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    if (otp.length === codeLength) {
      void verifyCode(otp);
    }
  }, [otp, codeLength]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void verifyCode(otp);
  };

  const handleResend = async () => {
    if (!onResend || isResending) return;

    setIsResending(true);
    setError('');

    try {
      await onResend();
      setOtp('');
      lastSubmittedCode.current = '';
      setSecondsRemaining(expiresInSeconds);
    } catch (resendError) {
      console.error('OTP resend failed:', resendError);
      setError(
        resendError instanceof Error
          ? resendError.message
          : 'Unable to resend the verification code.',
      );
    } finally {
      setIsResending(false);
    }
  };

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = String(secondsRemaining % 60).padStart(2, '0');

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="otp" className="mb-2 block text-sm font-semibold text-slate-700">
          Verification code
        </label>

        <input
          id="otp"
          name="otp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={codeLength}
          value={otp}
          disabled={disabled || isVerifying || secondsRemaining <= 0}
          onChange={(event) => {
            const value = event.target.value.replace(/\D/g, '').slice(0, codeLength);
            setOtp(value);
            setError('');
            if (value !== lastSubmittedCode.current) {
              lastSubmittedCode.current = '';
            }
          }}
          aria-describedby="otp-help otp-error"
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-4 text-lg font-semibold tracking-[0.35em] text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100"
          placeholder={''.padStart(codeLength, '•')}
        />
      </div>

      <div className="flex items-center justify-between rounded-xl border border-teal-100 bg-teal-50 px-4 py-3">
        <span className="text-sm font-medium text-slate-600">Code expires in</span>
        <span className="text-xl font-bold text-teal-700" aria-live="polite">
          {minutes}:{seconds}
        </span>
      </div>

      <div id="otp-help" className="flex items-center justify-between text-xs text-slate-500">
        <span>Enter the {codeLength}-digit code sent to your email.</span>
        <span>{attemptsRemaining} attempts maximum</span>
      </div>

      {isVerifying && (
        <p className="text-sm font-medium text-teal-700" aria-live="polite">
          Verifying code…
        </p>
      )}

      {error && (
        <p id="otp-error" role="alert" className="text-sm font-medium text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={
          disabled ||
          isVerifying ||
          secondsRemaining <= 0 ||
          otp.length !== codeLength
        }
        className="w-full rounded-xl bg-teal-600 px-5 py-4 font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isVerifying ? 'Verifying…' : 'Verify & continue'}
      </button>

      {secondsRemaining <= 0 && onResend && (
        <button
          type="button"
          onClick={() => void handleResend()}
          disabled={isResending}
          className="w-full rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isResending ? 'Sending…' : 'Resend OTP'}
        </button>
      )}
    </form>
  );
}
