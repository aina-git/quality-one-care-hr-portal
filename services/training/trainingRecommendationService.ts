import type { TrainingPriority } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

type RecommendationInput = {
  trainingTitle: string;
  reason: string;
  priority: TrainingPriority;
};

function includesAny(text: string, values: string[]) {
  const lower = text.toLowerCase();
  return values.some((value) => lower.includes(value));
}

function buildRecommendations(application: {
  desiredRole: string | null;
  applicantProfile: { pediatricExperience: string | null };
  employmentHistory: Array<{ duties: string | null; roleTitle: string; pediatricCare: boolean }>;
  certifications: Array<{ name: string }>;
}) {
  const role = application.desiredRole ?? "";
  const duties = application.employmentHistory.map((entry) => `${entry.roleTitle} ${entry.duties ?? ""}`).join(" ");
  const certifications = application.certifications.map((entry) => entry.name).join(" ");
  const pediatricEvidence = `${application.applicantProfile.pediatricExperience ?? ""} ${duties}`;
  const recs: RecommendationInput[] = [
    {
      trainingTitle: "KanTime onboarding",
      reason: "All new hires should complete KanTime workflow orientation before assignment.",
      priority: "high"
    },
    {
      trainingTitle: "Documentation training",
      reason: "Consistent care documentation is required for home health care operations.",
      priority: "normal"
    },
    {
      trainingTitle: "Infection control",
      reason: "Infection control training supports safe care delivery in home settings.",
      priority: "high"
    }
  ];

  if (/\b(rn|lpn|nurse|nursing)\b/i.test(role)) {
    recs.push({
      trainingTitle: "Pediatric care basics",
      reason: "Nursing applicants should complete pediatric care basics before pediatric assignment.",
      priority: includesAny(pediatricEvidence, ["pediatric", "child", "infant", "youth"]) ? "normal" : "high"
    });
    recs.push({
      trainingTitle: "G-tube care",
      reason: includesAny(pediatricEvidence, ["g-tube", "gtube", "feeding tube"])
        ? "Applicant has related pediatric clinical exposure; confirm agency procedure alignment."
        : "No clear G-tube care evidence was found in the application record.",
      priority: includesAny(pediatricEvidence, ["g-tube", "gtube", "feeding tube"]) ? "normal" : "high"
    });
    recs.push({
      trainingTitle: "Tracheostomy care",
      reason: includesAny(pediatricEvidence, ["trach", "tracheostomy"])
        ? "Applicant reported tracheostomy-related experience; verify competency expectations."
        : "No clear tracheostomy care evidence was found in the application record.",
      priority: includesAny(pediatricEvidence, ["trach", "tracheostomy"]) ? "normal" : "high"
    });
    recs.push({
      trainingTitle: "Seizure management",
      reason: includesAny(pediatricEvidence, ["seizure"])
        ? "Applicant reported seizure-related experience; confirm agency protocol knowledge."
        : "Seizure management evidence was not clearly identified.",
      priority: "normal"
    });
  }

  if (/\b(dsp|support|aide|caregiver|home health)\b/i.test(role)) {
    recs.push({
      trainingTitle: "Behavioral support",
      reason: includesAny(pediatricEvidence, ["behavior", "autism", "developmental"])
        ? "Applicant has possible behavioral support exposure; align with Quality One Care practices."
        : "Behavioral support training is recommended for direct support and care roles.",
      priority: "normal"
    });
    recs.push({
      trainingTitle: "Pediatric care basics",
      reason: "Direct care applicants may support pediatric patients and should understand pediatric care basics.",
      priority: includesAny(pediatricEvidence, ["pediatric", "child", "infant", "youth"]) ? "normal" : "high"
    });
  }

  if (!includesAny(certifications, ["cpr", "bls"])) {
    recs.push({
      trainingTitle: "CPR readiness review",
      reason: "Current CPR/BLS certification was not clearly identified in the certification list.",
      priority: "critical"
    });
  }

  return recs;
}

export async function generateTrainingRecommendations(applicationId: string, userId?: string | null) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      applicantProfile: true,
      employmentHistory: true,
      certifications: true
    }
  });
  if (!application) throw new Error("Application not found.");

  const recommendations = buildRecommendations(application);
  const stored = [];
  for (const recommendation of recommendations) {
    const entry = await prisma.trainingRecommendation.upsert({
      where: {
        applicationId_trainingTitle: {
          applicationId,
          trainingTitle: recommendation.trainingTitle
        }
      },
      update: {
        reason: recommendation.reason,
        priority: recommendation.priority
      },
      create: {
        applicationId,
        ...recommendation
      }
    });
    stored.push(entry);
  }

  await logAction(userId ?? null, "training_recommended", "application", applicationId, {
    count: stored.length
  });
  return stored;
}
