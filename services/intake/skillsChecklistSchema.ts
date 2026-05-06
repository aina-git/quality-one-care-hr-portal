// Field shape for intake step "skills_checklist" — Home Health Nursing
// Skills Competency Checklist (QOC).
//
// The full QOC checklist has the validator (RN preceptor / DON) rating
// each task by method + competency level during orientation. At intake,
// we collect the applicant's SELF-assessment at the skill-AREA level so
// the validator knows where to focus during validation. The validator
// fills the per-task method/level ratings later (offline), signs the
// validator-certification block, and HR uploads the signed PDF.

export const COMPETENCY_LEVELS = [
  "independent",
  "needs_supervision",
  "not_yet_competent",
  "not_applicable"
] as const;
export type CompetencyLevel = (typeof COMPETENCY_LEVELS)[number] | "";

export type SkillArea = {
  key: string;
  title: string;
  taskExamples: string[];
};

export const SKILL_AREAS: SkillArea[] = [
  {
    key: "tracheostomy_suctioning",
    title: "Tracheostomy Suctioning",
    taskExamples: [
      "Demonstrate need for suctioning",
      "Assemble supplies (catheter, gloves, saline, suction tubing, AMBU bag)",
      "Set suction machine to 2–10 mmHg",
      "Limit continuous suction within airway to no more than 10 seconds",
      "Assess respiratory status",
      "Empty and disinfect the suction canister"
    ]
  },
  {
    key: "nasopharyngeal_suctioning",
    title: "Nasopharyngeal Suctioning",
    taskExamples: [
      "Lubricate 3–4 inches of catheter tip",
      "Insert catheter through nares with slight downward slant",
      "Limit continuous suction to ≤10 seconds"
    ]
  },
  {
    key: "oxygen_admin_trach_vent",
    title: "Oxygen Administration via Humidified Trach Collar and Ventilator Machine",
    taskExamples: [
      "Home oxygen safety precautions",
      "Connect oxygen tubing to compressor, AMBU bag, and ventilator",
      "Adjust flow to prescribed LPM"
    ]
  },
  {
    key: "humidified_trach_collar",
    title: "Humidified Trach Collar",
    taskExamples: [
      "Attach sterile water bottle to compressor",
      "Adjust heat to prescribed level and check mist"
    ]
  },
  {
    key: "nebulizer",
    title: "Nebulizer Treatment",
    taskExamples: [
      "Measure medication accurately",
      "Open nebulizer cup, instill medication, attach to tubing",
      "Check mist and store equipment properly"
    ]
  },
  {
    key: "pulse_oximetry",
    title: "Pulse Oximetry Monitoring",
    taskExamples: [
      "Select sensor site free of moisture/drainage",
      "Assess capillary refill",
      "Confirm pulse rate matches oximeter rate"
    ]
  },
  {
    key: "tracheostomy_change",
    title: "Tracheostomy Change",
    taskExamples: [
      "Place obturator in new tube",
      "Inflate cuff and check balloon for leak",
      "Insert new tube using downward arc",
      "Suction trach and reassess breath sounds"
    ]
  },
  {
    key: "tracheostomy_ties_change",
    title: "Tracheostomy Ties Change",
    taskExamples: [
      "Cut ties to twice neck circumference + 3 inches",
      "Have helper secure tube while removing old ties",
      "Allow one finger between ties and neck"
    ]
  },
  {
    key: "vent_cpap_bipap",
    title: "Ventilator / CPAP / BiPAP Management",
    taskExamples: [
      "Plug ventilator into external + backup battery",
      "Adjust SIMV/PC settings (Rate, PIP, PS, PEEP, I-Time, alarms)",
      "Connect water heater chamber and tubing",
      "Demonstrate proper AMBU bag use"
    ]
  },
  {
    key: "equipment_cleaning",
    title: "Equipment Cleaning",
    taskExamples: [
      "Disinfect top, bottom, and sides of equipment",
      "Allow to dry for at least 10 minutes"
    ]
  },
  {
    key: "ambu_bag",
    title: "Use of AMBU Bag",
    taskExamples: [
      "Attach AMBU bag to oxygen regulator",
      "Disconnect ventilator tubing and attach AMBU bag to trach",
      "Give three deep breaths and observe chest rise"
    ]
  },
  {
    key: "g_tube_bolus_feed",
    title: "G-Tube Bolus Feed",
    taskExamples: [
      "Warm formula to room temperature",
      "Position patient upright or semi-Fowler",
      "Check G-tube placement and residual",
      "Set rate and volume on infusion pump",
      "Flush G-tube at end of feeding"
    ]
  },
  {
    key: "g_tube_change",
    title: "G-Tube Change",
    taskExamples: [
      "Test new balloon for leakage",
      "Lubricate 3–4 cm of new tube tip",
      "Withdraw water from balloon, gently remove old tube",
      "Insert new tube and inflate balloon"
    ]
  },
  {
    key: "g_tube_residual_check",
    title: "G-Tube Residual Check",
    taskExamples: [
      "Position patient semi-Fowler",
      "Connect 60cc syringe to large port",
      "Aspirate stomach contents, measure, return to stomach"
    ]
  },
  {
    key: "g_tube_placement_check",
    title: "G-Tube Placement Check by Auscultation",
    taskExamples: [
      "Connect 60cc syringe to small port",
      "Push 5–10cc into feeding port",
      "Listen for 'air rush' over mid-left abdomen"
    ]
  },
  {
    key: "seizure_management",
    title: "Seizure Management",
    taskExamples: [
      "Identify signs/symptoms of seizure",
      "Maintain patent airway and proper position",
      "Know seizure meds + side effects (Keppra, Dilantin, Diastat, etc.)",
      "Demonstrate when to call 911",
      "Oxygen administration during/after seizure"
    ]
  },
  {
    key: "diastat",
    title: "Administration of Diastat",
    taskExamples: [
      "Verify expiration date",
      "Position patient on left side",
      "Insert syringe tip into rectum, push plunger over count of three"
    ]
  },
  {
    key: "med_admin_tube",
    title: "Medication Administration via NG-Tube / G-Tube / GJ-Tube",
    taskExamples: [
      "8 rights of medication administration",
      "Confirm tube placement",
      "Administer each medication separately and flush"
    ]
  },
  {
    key: "med_admin_oral_topical",
    title: "Medication Administration via Oral / Eye / Nasal / Ear / Rectal / Topical",
    taskExamples: [
      "8 rights of medication administration",
      "Identify required information on the medication label",
      "Document appropriately on the MAR"
    ]
  },
  {
    key: "chest_physiotherapy",
    title: "Chest Physiotherapy (Manual / Machine)",
    taskExamples: [
      "Assess pulse, respiratory rate, auscultate chest",
      "Position patient per segmental drainage chart",
      "Allow 30 minutes after feeds",
      "Demonstrate appropriate percussion technique"
    ]
  }
];

export type SkillRating = {
  level: CompetencyLevel;
  notes: string;
};

export type SkillsChecklistData = {
  // Employee section
  employeeFullName: string;
  position: string;
  employeeId: string;
  hireDate: string;
  clinicalSpecialty: string;
  dateOfValidation: string;
  validationType: "initial" | "annual" | "targeted" | "remediation" | "";

  // Per-area self-assessment
  ratings: Record<string, SkillRating>;

  // Acknowledgement
  acknowledged: boolean;
  signatureName: string;
  signatureDate: string;
};

export function emptySkillRating(): SkillRating {
  return { level: "", notes: "" };
}

export function emptySkillsChecklistData(): SkillsChecklistData {
  const ratings: Record<string, SkillRating> = {};
  for (const area of SKILL_AREAS) ratings[area.key] = emptySkillRating();
  return {
    employeeFullName: "",
    position: "",
    employeeId: "",
    hireDate: "",
    clinicalSpecialty: "Pediatric / Adult Home Health",
    dateOfValidation: "",
    validationType: "",
    ratings,
    acknowledged: false,
    signatureName: "",
    signatureDate: ""
  };
}

export function mergeSkillsChecklistData(stored: unknown): SkillsChecklistData {
  const empty = emptySkillsChecklistData();
  if (!stored || typeof stored !== "object") return empty;
  const obj = stored as Record<string, unknown>;
  const merged: SkillsChecklistData = { ...empty, ratings: { ...empty.ratings } };
  for (const k of Object.keys(empty) as Array<keyof SkillsChecklistData>) {
    const value = obj[k as string];
    if (value === undefined || value === null) continue;
    if (k === "ratings") {
      const incoming = value as Record<string, Partial<SkillRating>>;
      for (const areaKey of Object.keys(merged.ratings)) {
        const inc = incoming[areaKey];
        if (!inc) continue;
        merged.ratings[areaKey] = {
          level: (inc.level as CompetencyLevel) ?? merged.ratings[areaKey].level,
          notes: typeof inc.notes === "string" ? inc.notes : merged.ratings[areaKey].notes
        };
      }
      continue;
    }
    (merged as Record<string, unknown>)[k] = value;
  }
  return merged;
}

export function validateSkillsChecklistForCompletion(data: SkillsChecklistData): string[] {
  const errors: string[] = [];
  if (!data.employeeFullName.trim()) errors.push("Employee full name is required.");
  if (!data.position.trim()) errors.push("Position (RN / LPN / CNA / HHA) is required.");
  const unrated = SKILL_AREAS.filter((a) => !data.ratings[a.key]?.level);
  if (unrated.length > 0) {
    errors.push(`Self-rate every skill area before submitting. Missing: ${unrated[0].title}.`);
  }
  if (!data.acknowledged) errors.push("Acknowledge the employee statement at the bottom.");
  if (!data.signatureName.trim()) errors.push("Type your full legal name to sign.");
  if (!data.signatureDate.trim()) errors.push("Sign date is required.");
  return errors;
}
