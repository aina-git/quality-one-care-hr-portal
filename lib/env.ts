const requiredEnv = ["DATABASE_URL", "AUTH_SECRET", "NEXT_PUBLIC_APP_URL"] as const;
const optionalEnv = [
  "OCR_PROVIDER",
  "OCR_API_KEY",
  "AI_PROVIDER",
  "AI_API_KEY",
  "EMAIL_PROVIDER",
  "EMAIL_API_KEY",
  "EMAIL_FROM",
  "STORAGE_PROVIDER",
  "STORAGE_BUCKET",
  "STORAGE_ACCESS_KEY",
  "STORAGE_SECRET_KEY",
  "STORAGE_ENDPOINT"
] as const;

const globalForEnvValidation = globalThis as unknown as { qocEnvValidated?: boolean };

export function validateEnvironment() {
  if (globalForEnvValidation.qocEnvValidated) return;
  globalForEnvValidation.qocEnvValidated = true;

  const missingRequired = requiredEnv.filter((key) => !process.env[key]);
  if (missingRequired.length > 0) {
    const message = `Missing required environment variables: ${missingRequired.join(", ")}`;
    if (process.env.NODE_ENV === "production") {
      throw new Error(message);
    }
    console.warn(message);
  }

  const warnings: string[] = [];
  if (!process.env.EMAIL_PROVIDER || !process.env.EMAIL_API_KEY) {
    warnings.push("Email provider is not configured. Emails will remain queued.");
  }
  const ocrProvider = (process.env.OCR_PROVIDER ?? "").trim().toLowerCase();
  if (!ocrProvider) {
    warnings.push("OCR provider is not configured. Fallback OCR will be used.");
  } else if (ocrProvider !== "local" && !process.env.OCR_API_KEY) {
    warnings.push("OCR provider is selected but OCR_API_KEY is not configured.");
  }
  if (!process.env.AI_PROVIDER || !process.env.AI_API_KEY) {
    warnings.push("AI provider is not configured. Rule-based review will be used.");
  }
  if ((process.env.STORAGE_PROVIDER ?? "local") !== "local") {
    if (!process.env.STORAGE_BUCKET || !process.env.STORAGE_ACCESS_KEY || !process.env.STORAGE_SECRET_KEY) {
      warnings.push("Cloud storage provider is selected but storage credentials are incomplete.");
    }
  }
  warnings.forEach((warning) => console.warn(warning));

  optionalEnv.forEach((key) => {
    if (!(key in process.env)) {
      console.warn(`Optional environment variable ${key} is not set.`);
    }
  });
}

export function getStorageProvider() {
  return (process.env.STORAGE_PROVIDER ?? "local").trim().toLowerCase();
}

export function getEmailProvider() {
  return (process.env.EMAIL_PROVIDER ?? "").trim().toLowerCase();
}
