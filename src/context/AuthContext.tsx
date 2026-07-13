import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

interface AuthState {
  email: string;
  domainVerified: boolean;
  otpVerified: boolean;
}

interface AuthContextValue extends AuthState {
  beginAuthentication: (email: string) => void;
  markDomainVerified: () => void;
  markOtpVerified: () => void;
  signOut: () => void;
}

const initialState: AuthState = {
  email: '',
  domainVerified: false,
  otpVerified: false,
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(initialState);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      beginAuthentication: (email: string) => {
        setState({ email: email.trim().toLowerCase(), domainVerified: false, otpVerified: false });
      },
      markDomainVerified: () => {
        setState((current) => ({ ...current, domainVerified: true }));
      },
      markOtpVerified: () => {
        setState((current) => ({ ...current, otpVerified: true }));
      },
      signOut: () => setState(initialState),
    }),
    [state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return context;
}
