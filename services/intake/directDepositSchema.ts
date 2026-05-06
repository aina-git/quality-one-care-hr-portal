// Field shape for intake step "direct_deposit" — mirrors the QOC
// Direct Deposit Authorization (ACH / NACHA).

export const DIRECT_DEPOSIT_AUTHORIZATION =
  "I authorize Quality One Care Home Health, Inc. to deposit my pay automatically to the account(s) listed above through the Automated Clearing House (ACH) network. I further authorize Quality One Care to debit any of my account(s) listed above to recover any funds deposited in error. I understand and agree that ACH transactions are governed by the rules of the National Automated Clearing House Association (NACHA) and applicable federal and state law. This authorization will remain in full force and effect until I notify Quality One Care in writing of its termination, in such time and manner as to afford the company a reasonable opportunity to act on it. I am responsible for promptly notifying Quality One Care of any change in my account or financial institution.";

export type DirectDepositAction = "new" | "change" | "cancel" | "";
export type DirectDepositAccountType = "checking" | "savings" | "";
export type DirectDepositAmountKind = "net" | "remainder" | "fixed_amount" | "percentage" | "";

export type DirectDepositAccount = {
  accountType: DirectDepositAccountType;
  financialInstitutionName: string;
  routingNumber: string;
  accountNumber: string;
  amountKind: DirectDepositAmountKind;
  amountSpecified: string;
  accountNickname: string;
};

export type DirectDepositData = {
  employeeFullName: string;
  employeeId: string;
  positionTitle: string;
  department: string;
  email: string;
  phone: string;
  action: DirectDepositAction;
  effectivePayDate: string;
  primary: DirectDepositAccount;
  useSecondary: boolean;
  secondary: DirectDepositAccount;
  attestProofUploaded: boolean;
  authorized: boolean;
  signatureName: string;
  signatureDate: string;
};

export function emptyDirectDepositAccount(allowRemainder: boolean): DirectDepositAccount {
  return {
    accountType: "",
    financialInstitutionName: "",
    routingNumber: "",
    accountNumber: "",
    amountKind: "",
    amountSpecified: "",
    accountNickname: ""
  };
  // allowRemainder kept in signature for symmetry — UI decides which kinds to surface.
  void allowRemainder;
}

export function emptyDirectDepositData(): DirectDepositData {
  return {
    employeeFullName: "",
    employeeId: "",
    positionTitle: "",
    department: "Home Health Nursing",
    email: "",
    phone: "",
    action: "",
    effectivePayDate: "",
    primary: emptyDirectDepositAccount(false),
    useSecondary: false,
    secondary: emptyDirectDepositAccount(true),
    attestProofUploaded: false,
    authorized: false,
    signatureName: "",
    signatureDate: ""
  };
}

export function mergeDirectDepositData(stored: unknown): DirectDepositData {
  const empty = emptyDirectDepositData();
  if (!stored || typeof stored !== "object") return empty;
  const obj = stored as Record<string, unknown>;
  const merged: DirectDepositData = { ...empty };
  for (const k of Object.keys(empty) as Array<keyof DirectDepositData>) {
    const value = obj[k as string];
    if (value === undefined || value === null) continue;
    if (k === "primary" || k === "secondary") {
      const base = emptyDirectDepositAccount(k === "secondary");
      const acct = value as Partial<DirectDepositAccount>;
      for (const ak of Object.keys(base) as Array<keyof DirectDepositAccount>) {
        if (acct[ak] !== undefined && acct[ak] !== null) {
          (base as Record<string, unknown>)[ak] = acct[ak] as never;
        }
      }
      (merged as Record<string, unknown>)[k] = base;
      continue;
    }
    (merged as Record<string, unknown>)[k] = value;
  }
  return merged;
}

function isValidRouting(value: string) {
  return /^\d{9}$/.test(value.trim());
}

function isValidAccount(value: string) {
  return /^\d{4,17}$/.test(value.trim());
}

export function validateDirectDepositForCompletion(data: DirectDepositData): string[] {
  const errors: string[] = [];
  if (!data.employeeFullName.trim()) errors.push("Employee full name is required.");
  if (!data.action) errors.push("Choose an action (new enrollment, change, or cancel).");

  if (data.action === "cancel") {
    // For cancel, account info is not required.
  } else if (data.action) {
    if (!data.primary.accountType) errors.push("Choose primary account type (checking or savings).");
    if (!data.primary.financialInstitutionName.trim()) errors.push("Primary financial institution name is required.");
    if (!isValidRouting(data.primary.routingNumber)) errors.push("Primary routing number must be exactly 9 digits.");
    if (!isValidAccount(data.primary.accountNumber)) errors.push("Primary account number must be 4–17 digits.");
    if (!data.primary.amountKind) errors.push("Choose how the primary account is funded.");
    if ((data.primary.amountKind === "fixed_amount" || data.primary.amountKind === "percentage") && !data.primary.amountSpecified.trim()) {
      errors.push("Specify the primary account amount or percentage.");
    }
    if (data.useSecondary) {
      if (!data.secondary.accountType) errors.push("Choose secondary account type.");
      if (!data.secondary.financialInstitutionName.trim()) errors.push("Secondary financial institution name is required.");
      if (!isValidRouting(data.secondary.routingNumber)) errors.push("Secondary routing number must be exactly 9 digits.");
      if (!isValidAccount(data.secondary.accountNumber)) errors.push("Secondary account number must be 4–17 digits.");
      if (!data.secondary.amountKind) errors.push("Choose how the secondary account is funded.");
      if ((data.secondary.amountKind === "fixed_amount" || data.secondary.amountKind === "percentage") && !data.secondary.amountSpecified.trim()) {
        errors.push("Specify the secondary account amount or percentage.");
      }
    }
    if (!data.attestProofUploaded) errors.push("Confirm that you have uploaded proof of account (voided check, bank slip, or online printout).");
  }

  if (!data.authorized) errors.push("Sign the ACH authorization to enable direct deposit.");
  if (!data.signatureName.trim()) errors.push("Type your full legal name to sign.");
  if (!data.signatureDate.trim()) errors.push("Sign date is required.");
  return errors;
}
