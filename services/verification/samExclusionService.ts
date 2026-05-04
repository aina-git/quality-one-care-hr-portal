/**
 * SAM.gov Exclusions auto-verification.
 *
 * SAM.gov (System for Award Management) publishes a public dataset of all
 * federal entities/individuals excluded from receiving federal contracts,
 * grants, or subsidies. Broader scope than OIG LEIE — covers all federal
 * exclusions, not just healthcare.
 *
 * Public download: https://sam.gov/data-services/Exclusions/Public%20V2
 *
 * Note: SAM.gov requires API key registration for full programmatic access.
 * The "Public V2" dataset is downloadable as CSV without auth.
 *
 * Strategy: cache the file weekly; check applicants locally; if download
 * fails (e.g., format change), fall back to "needs_followup" rather than
 * silently passing.
 */

import fs from "fs/promises";
import path from "path";

// Public SAM.gov exclusions extract — updated daily
// We use the public V2 endpoint that doesn't require an API key
export const SAM_EXCLUSIONS_URL =
  process.env.SAM_EXCLUSIONS_URL
  ?? "https://sam.gov/api/prod/fileextractservices/v1/api/download/Exclusions/Public/CURRENT?privacy=Public";

const STORAGE_DIR = path.join(process.cwd(), "storage", "verification", "sam");
const DATA_FILE = path.join(STORAGE_DIR, "sam_exclusions.csv");
const META_FILE = path.join(STORAGE_DIR, "meta.json");

export type SamExclusionRecord = {
  classification: string;
  name: string;
  prefix: string;
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  exclusionType: string;
  exclusionProgram: string;
  exclusionAgency: string;
  cTCode: string;
  exclusionType2: string;
  activeDate: string;
  terminationDate: string;
  recordStatus: string;
  state: string;
};

export type SamCheckResult = {
  matched: boolean;
  matchType: "none" | "name_only" | "name_and_state";
  matches: SamExclusionRecord[];
  datasetLoaded: boolean;
  recordCount: number;
  datasetLastUpdated: Date | null;
};

export async function refreshSamDataset(): Promise<{ recordCount: number; lastUpdated: Date }> {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
  const response = await fetch(SAM_EXCLUSIONS_URL, {
    headers: { "User-Agent": "QualityOneCare-HR-Portal/1.0 (+verification)" }
  });
  if (!response.ok) {
    throw new Error(`SAM.gov exclusion download failed: HTTP ${response.status}`);
  }
  const text = await response.text();
  if (text.length < 1000) {
    throw new Error("SAM.gov download returned suspiciously small payload; aborting cache write.");
  }
  await fs.writeFile(DATA_FILE, text, "utf-8");
  const recordCount = Math.max(0, text.split(/\r?\n/).length - 1);
  await fs.writeFile(META_FILE, JSON.stringify({
    lastUpdated: new Date().toISOString(),
    recordCount,
    source: SAM_EXCLUSIONS_URL
  }, null, 2), "utf-8");
  return { recordCount, lastUpdated: new Date() };
}

export async function getSamDatasetMetadata(): Promise<{ lastUpdated: Date | null; recordCount: number }> {
  try {
    const raw = await fs.readFile(META_FILE, "utf-8");
    const meta = JSON.parse(raw);
    return { lastUpdated: new Date(meta.lastUpdated), recordCount: meta.recordCount };
  } catch {
    return { lastUpdated: null, recordCount: 0 };
  }
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === "," && !inQuotes) {
      fields.push(current); current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

async function readDataset(): Promise<SamExclusionRecord[]> {
  let text: string;
  try {
    text = await fs.readFile(DATA_FILE, "utf-8");
  } catch {
    return [];
  }
  const lines = text.split(/\r?\n/);
  const records: SamExclusionRecord[] = [];
  // SAM.gov CSV column order varies by extract version — we only depend on a few fields
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const f = parseCsvLine(line);
    if (f.length < 8) continue;
    records.push({
      classification: (f[0] ?? "").trim(),
      name: (f[1] ?? "").trim(),
      prefix: (f[2] ?? "").trim(),
      firstName: (f[3] ?? "").trim(),
      middleName: (f[4] ?? "").trim(),
      lastName: (f[5] ?? "").trim(),
      suffix: (f[6] ?? "").trim(),
      exclusionType: (f[7] ?? "").trim(),
      exclusionProgram: (f[8] ?? "").trim(),
      exclusionAgency: (f[9] ?? "").trim(),
      cTCode: (f[10] ?? "").trim(),
      exclusionType2: (f[11] ?? "").trim(),
      activeDate: (f[12] ?? "").trim(),
      terminationDate: (f[13] ?? "").trim(),
      recordStatus: (f[14] ?? "").trim(),
      state: (f[20] ?? "").trim()
    });
  }
  return records;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export async function checkApplicantAgainstSam(input: {
  firstName: string;
  lastName: string;
  state?: string | null;
}): Promise<SamCheckResult> {
  const dataset = await readDataset();
  const meta = await getSamDatasetMetadata();
  if (dataset.length === 0) {
    return {
      matched: false,
      matchType: "none",
      matches: [],
      datasetLoaded: false,
      recordCount: 0,
      datasetLastUpdated: meta.lastUpdated
    };
  }
  const inputFirst = normalize(input.firstName);
  const inputLast = normalize(input.lastName);
  const inputState = input.state ? normalize(input.state) : "";
  if (!inputFirst || !inputLast) {
    return {
      matched: false,
      matchType: "none",
      matches: [],
      datasetLoaded: true,
      recordCount: dataset.length,
      datasetLastUpdated: meta.lastUpdated
    };
  }

  const nameMatches = dataset.filter((r) => {
    const recFirst = normalize(r.firstName || r.name.split(/\s+/)[0] || "");
    const recLast = normalize(r.lastName || r.name.split(/\s+/).slice(-1)[0] || "");
    return recFirst === inputFirst && recLast === inputLast;
  });

  if (nameMatches.length === 0) {
    return {
      matched: false,
      matchType: "none",
      matches: [],
      datasetLoaded: true,
      recordCount: dataset.length,
      datasetLastUpdated: meta.lastUpdated
    };
  }

  if (inputState) {
    const stateMatches = nameMatches.filter((r) => normalize(r.state) === inputState);
    if (stateMatches.length > 0) {
      return {
        matched: true,
        matchType: "name_and_state",
        matches: stateMatches,
        datasetLoaded: true,
        recordCount: dataset.length,
        datasetLastUpdated: meta.lastUpdated
      };
    }
  }

  return {
    matched: true,
    matchType: "name_only",
    matches: nameMatches,
    datasetLoaded: true,
    recordCount: dataset.length,
    datasetLastUpdated: meta.lastUpdated
  };
}
