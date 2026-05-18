export const hrV2 = {
  title: "The Strategic Role of HR at Quality One Care",
  subtitle: "How the right HR leadership builds people, policies, compliance, culture, and growth",
  brand: "Quality One Care Home Health Inc.",
  tagline: "We Care with Golden Hands.",
  durationInFrames: 4440,
};

export const hrV2Scenes = [
  {
    id: "opening",
    start: 0,
    duration: 540,
    chapter: "Strategic HR",
    title: "HR is the operating system for growth",
    narration:
      "At Quality One Care, Human Resources is not just hiring and paperwork. HR is the operating system that helps the agency grow with order, protect compliance, support caregivers, and deliver consistent home health care.",
    pillars: ["People", "Policy", "Compliance", "Culture", "Growth"],
  },
  {
    id: "people",
    start: 540,
    duration: 720,
    chapter: "People Pipeline",
    title: "A strong HR team builds the right workforce",
    narration:
      "The first role of HR is to bring in the right people. That means recruiting caregivers, nurses, therapists, coordinators, and office staff who match the Quality One Care standard: reliable, compassionate, professional, and ready to serve.",
    pillars: ["Recruit", "Screen", "Verify", "Onboard", "Retain"],
  },
  {
    id: "policy",
    start: 1260,
    duration: 720,
    chapter: "Policy System",
    title: "Good policies turn values into daily behavior",
    narration:
      "Good HR policies remove confusion. They explain attendance, documentation, communication, client privacy, discipline, training, and escalation. When policies are clear, staff know what is expected before problems become expensive.",
    pillars: ["Attendance", "Documentation", "Privacy", "Escalation", "Performance"],
  },
  {
    id: "compliance",
    start: 1980,
    duration: 720,
    chapter: "Compliance Control",
    title: "HR protects the agency before an audit arrives",
    narration:
      "In home health, compliance must be organized every day. HR keeps employee files complete, tracks licenses and background checks, monitors training records, follows up on incidents, and makes sure employment practices are fair and consistent.",
    pillars: ["Files", "Licenses", "Checks", "Training", "Incidents"],
  },
  {
    id: "culture",
    start: 2700,
    duration: 720,
    chapter: "Culture And Collaboration",
    title: "HR connects office leadership with field care",
    narration:
      "The best HR personnel do not stay hidden in the office. They collaborate with field staff, supervisors, schedulers, and leadership. They listen, coach, recognize good work, correct issues early, and help people feel supported while standards remain high.",
    pillars: ["Listen", "Coach", "Recognize", "Correct", "Support"],
  },
  {
    id: "transformation",
    start: 3420,
    duration: 720,
    chapter: "Transformation",
    title: "Great HR transforms the whole organization",
    narration:
      "When HR is strong, hiring improves, onboarding becomes smoother, policies become clearer, compliance becomes easier, turnover goes down, and client care becomes more stable. That is how Human Resources helps Quality One Care scale with excellence.",
    pillars: ["Better hiring", "Smoother onboarding", "Clearer policy", "Lower turnover", "Stable care"],
  },
  {
    id: "close",
    start: 4140,
    duration: 300,
    chapter: "Final Standard",
    title: "Strong HR protects the future of Quality One Care",
    narration:
      "Human Resources is where people, policy, compliance, culture, and growth meet. A strong HR person is not just helpful to the organization. A strong HR person transforms it.",
    pillars: ["People", "Policy", "Compliance", "Culture", "Growth"],
  },
];

export const hrV2Script = hrV2Scenes.map((scene) => scene.narration).join("\n\n");
