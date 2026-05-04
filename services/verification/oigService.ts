/**
 * OIG (Office of Inspector General) Exclusion List auto-verification.
 *
 * The OIG publishes the LEIE (List of Excluded Individuals/Entities) as a public
 * downloadable CSV at https://oig.hhs.gov/exclusions/. We download the dataset,
 * cache it on disk, and check applicants against it locally.
 *
 * This is the LEGITIMATE way to verify OIG status — no scraping, no login.
 *
 * Dataset: ~75K individuals, ~2MB, updated monthly.
 * Format columns (in order):
 *   0  LASTNAME
 *   1  FIRSTNAME
 *   2  MIDNAME
 *   3  BUSNAME
 *   4  GENERAL
 *   5  SPECIALTY
 *   6  UPIN
 *   7  NPI
 *   8  DOB        (YYYYMMDD or MM/DD/YYYY)
 *   9  ADDRESS
 *   10 CITY
 *   11 STATE
 *   12 ZIP
 *   13 EXCLTYPE
 *   14 EXCLDATE   (YYYYMMDD)
 *   15 REINDATE
 *   16 WAIVERDATE
 *   17 WVRSTATE
 */

import fs from "fs/promises";
import path from "path";

export const OIG_LEIE_URL = "https://oig.hhs.gov/exclusions/downloadables/UPDATED.csv";

const STORAGE_DIR = path.join(process.cwd(), "storage", "verification", "oig");
const DATA_FILE = path.join(STORAGE_DIR, "leie.csv");
const META_FILE = path.join(STORAGE_DIR, "meta.json");

export type LeieRecord = {
  lastName: string;
  firstName: string;
  middleName: string;
  busName: string;
  general: string;
  specialty: string;
  dob: string;            // ISO date or ""
  state: string;
  exclusionType: string;
  exclusionDate: string;  // ISO date or ""
};

export type OigCheckResult = {
  matched: boolean;
  matchType: "none" | "exact_with_dob" | "name_only";
  matches: LeieRecord[];
  datasetLoaded: boolean;
  recordCount: number;
  datasetLastUpdated: Date | null;
};

type DatasetMeta = {
  lastUpdated: string;
  recordCount: number;
  source: string;
};

// ───── Download + cache ──────────────────────────────────────────────

export async function refreshOigDataset(): Promise<{ recordCount: number; lastUpdated: Date }> {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
  const response = await fetch(OIG_LEIE_URL, {
    headers: { "User-Agent": "QualityOneCare-HR-Portal/1.0 (+verification)" }
  });
  if (!response.ok) {
    throw new Error(`OIG download failed: HTTP ${response.status}`);
  }
  const text = await response.text();
  if (text.length < 1000) {
    throw new Error("OIG download returned suspiciously small payload; aborting cache write.");
  }
  await fs.writeFile(DATA_FILE, text, "utf-8");
  const recordCount = Math.max(0, text.split(/\r?\n/).length - 1);
  const meta: DatasetMeta = {
    lastUpdated: new Date().toISOString(),
    recordCount,
    source: OIG_LEIE_URL
  };
  await fs.writeFile(META_FILE, JSON.stringify(meta, null, 2), "utf-8");
  return { recordCount, lastUpdated: new Date(meta.lastUpdated) };
}

export async function getOigDatasetMetadata(): Promise<{ lastUpdated: Date | null; recordCount: number }> {
  try {
    const raw = await fs.readFile(META_FILE, "utf-8");
    const meta = JSON.parse(raw) as DatasetMeta;
    return {
      lastUpdated: new Date(meta.lastUpdated),
      recordCount: meta.recordCount
    };
  } catch {
    return { lastUpdated: null, recordCount: 0 };
  }
}

// ───── CSV parsing ───────────────────────────────────────────────────

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function parseLeieDate(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "0") return "";
  if (/^\d{8}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
    const [m, d, y] = trimmed.split("/");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return "";
}

async function readDataset(): Promise<LeieRecord[]> {
  let text: string;
  try {
    text = await fs.readFile(DATA_FILE, "utf-8");
  } catch {
    return [];
  }
  const lines = text.split(/\r?\n/);
  const records: LeieRecord[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const f = parseCsvLine(line);
    if (f.length < 14) continue;
    records.push({
      lastName: (f[0] ?? "").trim(),
      firstName: (f[1] ?? "").trim(),
      middleName: (f[2] ?? "").trim(),
      busName: (f[3] ?? "").trim(),
      general: (f[4] ?? "").trim(),
      specialty: (f[5] ?? "").trim(),
      dob: parseLeieDate(f[8] ?? ""),
      state: (f[11] ?? "").trim(),
      exclusionType: (f[13] ?? "").trim(),
      exclusionDate: parseLeieDate(f[14] ?? "")
    });
  }
  return records;
}

// ───── Matching ──────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export async function checkApplicantAgainstOig(input: {
  firstName: string;
  lastName: string;
  middleName?: string | null;
  dateOfBirth?: Date | string | null;
  state?: string | null;
}): Promise<OigCheckResult> {
  const dataset = await readDataset();
  const meta = await getOigDatasetMetadata();
  const datasetLoaded = dataset.length > 0;
  if (!datasetLoaded) {
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
  const dobStr = input.dateOfBirth
    ? (input.dateOfBirth instanceof Date
        ? input.dateOfBirth.toISOString().slice(0, 10)
        : new Date(input.dateOfBirth).toISOString().slice(0, 10))
    : "";

  const nameMatches = dataset.filter((r) =>
    normalize(r.lastName) === inputLast && normalize(r.firstName) === inputFirst
  );
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

  if (dobStr) {
    const exactMatches = nameMatches.filter((r) => r.dob === dobStr);
    if (exactMatches.length > 0) {
      return {
        matched: true,
        matchType: "exact_with_dob",
        matches: exactMatches,
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
