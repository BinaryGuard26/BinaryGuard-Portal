import { supabase } from './supabaseClient';

export type DomainValidationResult = {
  valid: boolean;
  message?: string;
};

function normalizeDomain(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^@+/, '');
}

export async function validateApprovedDomain(
  domain: string
): Promise<DomainValidationResult> {
  const normalizedDomain = normalizeDomain(domain);

  if (!normalizedDomain) {
    return {
      valid: false,
      message: 'Please select a corporate email domain.',
    };
  }

  const { data, error } = await supabase.rpc(
    'is_approved_domain',
    {
      input_domain: normalizedDomain,
    }
  );

  if (error) {
    console.error('Domain validation failed:', error);

    return {
      valid: false,
      message:
        'We could not validate your domain. Please try again.',
    };
  }

  return {
    valid: data === true,
  };
}
