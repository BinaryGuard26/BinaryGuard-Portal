import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

interface PortalSession {
  currentStep: 1 | 2 | 3 | 4;
  authenticatedEmail: string;
  otpVerifiedAt: string | null;
}

interface SessionContextValue extends PortalSession {
  startSession: (email: string) => void;
  completeOtpVerification: () => void;
  setCurrentStep: (step: PortalSession['currentStep']) => void;
  clearSession: () => void;
}

const initialSession: PortalSession = {
  currentStep: 1,
  authenticatedEmail: '',
  otpVerifiedAt: null,
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<PortalSession>(initialSession);

  const value = useMemo<SessionContextValue>(
    () => ({
      ...session,
      startSession: (email: string) => {
        setSession({
          currentStep: 2,
          authenticatedEmail: email.trim().toLowerCase(),
          otpVerifiedAt: null,
        });
      },
      completeOtpVerification: () => {
        setSession((current) => ({
          ...current,
          currentStep: 3,
          otpVerifiedAt: new Date().toISOString(),
        }));
      },
      setCurrentStep: (currentStep) => {
        setSession((current) => ({ ...current, currentStep }));
      },
      clearSession: () => setSession(initialSession),
    }),
    [session],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error('useSession must be used inside SessionProvider.');
  }

  return context;
}
