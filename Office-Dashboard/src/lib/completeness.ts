import prisma from '@/lib/db/prisma';

/**
 * Profile completeness derivation (REPAIR: D-004, FR-012).
 *
 * Documented business rule (canonical):
 *
 *  - A phone number with **zero** linked platform accounts is **EMPTY**, not
 *    "incomplete". It is still onboarding. The previous implementation counted
 *    these, which made `incompleteNumbers` equal `totalNumbers` on a fresh
 *    install and made the metric useless.
 *  - A phone number WITH linked accounts is **COMPLETE** when *every* linked
 *    account passes the required-field checks below, otherwise **PARTIAL**.
 *
 * Required fields for a linked platform account to be COMPLETE:
 *   1. A stored credential/password exists (FR-007).
 *   2. At least one identity anchor is non-empty after trimming:
 *      `accountHandle`, `loginIdentifier` or `displayName`.
 *   3. `accountStatus` has a real operator-recorded value (not `UNKNOWN`).
 *
 * Zero / empty / null states are all treated as "missing": `''`, `'   '`,
 * `null` and `undefined` fail every check.
 */

export type CompletenessState = 'COMPLETE' | 'PARTIAL' | 'EMPTY';

export interface CompletenessAccountInput {
  displayName?: string | null;
  accountHandle?: string | null;
  loginIdentifier?: string | null;
  accountStatus?: string | null;
  hasCredential: boolean;
}

export interface AccountCompleteness {
  complete: boolean;
  missingFields: string[];
}

const nonEmpty = (v: unknown): boolean =>
  typeof v === 'string' ? v.trim().length > 0 : v !== null && v !== undefined;

export function evaluateAccountCompleteness(account: CompletenessAccountInput): AccountCompleteness {
  const missingFields: string[] = [];

  if (!nonEmpty(account.accountHandle) && !nonEmpty(account.loginIdentifier) && !nonEmpty(account.displayName)) {
    missingFields.push('accountHandle|loginIdentifier|displayName');
  }

  if (!account.hasCredential) {
    missingFields.push('credential');
  }

  if (!nonEmpty(account.accountStatus) || account.accountStatus === 'UNKNOWN') {
    missingFields.push('accountStatus');
  }

  return { complete: missingFields.length === 0, missingFields };
}

export function evaluatePhoneCompleteness(accounts: CompletenessAccountInput[]) {
  const evaluated = accounts.map(a => ({ ...a, ...evaluateAccountCompleteness(a) }));
  const totalAccounts = evaluated.length;
  const completeAccounts = evaluated.filter(a => a.complete).length;

  let state: CompletenessState;
  if (totalAccounts === 0) {
    state = 'EMPTY';
  } else if (completeAccounts === totalAccounts) {
    state = 'COMPLETE';
  } else {
    state = 'PARTIAL';
  }

  return { state, accounts: evaluated, completeAccounts, totalAccounts };
}

/** Shapes a raw Prisma link (with credential include) for the evaluator. */
export function linkToCompletenessInput(link: any): CompletenessAccountInput {
  const acct = link?.platformAccount ?? link;
  return {
    displayName: acct?.displayName ?? null,
    accountHandle: acct?.accountHandle ?? null,
    loginIdentifier: acct?.loginIdentifier ?? null,
    accountStatus: acct?.accountStatus ?? null,
    hasCredential: !!(acct?.credential ?? acct?.hasCredential),
  };
}

/**
 * Count phone numbers that have at least one linked account but where at least
 * one linked account fails the completeness checks (REPAIR: D-004).
 *
 * Only phone numbers that actually have links are fetched, so the working set
 * is bounded by real business data rather than total phone rows.
 */
export async function countIncompleteNumbers(): Promise<number> {
  const rows = await fetchLinkedPhoneProjections();
  let incomplete = 0;
  for (const accounts of rows) {
    const { state } = evaluatePhoneCompleteness(accounts);
    if (state === 'PARTIAL') incomplete += 1;
  }
  return incomplete;
}

/** Count phone numbers whose entire linked-account set is COMPLETE. */
export async function countCompleteNumbers(): Promise<number> {
  const rows = await fetchLinkedPhoneProjections();
  let complete = 0;
  for (const accounts of rows) {
    const { state } = evaluatePhoneCompleteness(accounts);
    if (state === 'COMPLETE') complete += 1;
  }
  return complete;
}

/** Compute both dashboard metrics from one bounded projection query. */
export async function countCompletenessNumbers(): Promise<{ complete: number; incomplete: number }> {
  const rows = await fetchLinkedPhoneProjections();
  let complete = 0;
  let incomplete = 0;
  for (const accounts of rows) {
    const { state } = evaluatePhoneCompleteness(accounts);
    if (state === 'COMPLETE') complete += 1;
    if (state === 'PARTIAL') incomplete += 1;
  }
  return { complete, incomplete };
}

/** Count phone numbers with zero linked accounts (EMPTY / onboarding). */
export async function countEmptyNumbers(): Promise<number> {
  return prisma.phoneNumber.count({
    where: { status: 'ACTIVE', archivedAt: null, accountLinks: { none: {} } },
  });
}

async function fetchLinkedPhoneProjections(): Promise<CompletenessAccountInput[][]> {
  const rows = await prisma.phoneNumber.findMany({
    where: {
      status: 'ACTIVE',
      archivedAt: null,
      accountLinks: { some: {} },
    },
    select: {
      id: true,
      accountLinks: {
        select: {
          platformAccount: {
            select: {
              displayName: true,
              accountHandle: true,
              loginIdentifier: true,
              accountStatus: true,
              archivedAt: true,
              credential: { select: { id: true } },
            },
          },
        },
      },
    },
  });

  return rows.map(row =>
    row.accountLinks
      .map(link => link.platformAccount)
      .filter((a): a is NonNullable<typeof a> => !!a && a.archivedAt === null)
      .map(a => ({
        displayName: a.displayName,
        accountHandle: a.accountHandle,
        loginIdentifier: a.loginIdentifier,
        accountStatus: a.accountStatus,
        hasCredential: !!a.credential,
      })),
  );
}

