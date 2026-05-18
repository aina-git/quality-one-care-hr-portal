import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
} from "remotion";

const duration = 5760;

const scenes = [
  {
    id: "opening",
    start: 0,
    duration: 780,
    chapter: "Strategic HR",
    title: "HR is the operating system for growth",
    caption:
      "HR keeps Quality One Care organized, compliant, professional, and ready to serve clients with consistency.",
    visual: "system",
    items: ["People", "Policy", "Compliance", "Culture", "Growth"],
  },
  {
    id: "workforce",
    start: 780,
    duration: 600,
    chapter: "People Pipeline",
    title: "Build the right workforce",
    caption:
      "Recruit dependable caregivers, nurses, therapists, coordinators, and office staff who can protect the QOC standard.",
    visual: "pipeline",
    items: ["Recruit", "Screen", "Verify", "Interview", "Select"],
  },
  {
    id: "onboarding",
    start: 1380,
    duration: 540,
    chapter: "Prepared Staff",
    title: "Turn new hires into prepared staff",
    caption:
      "Onboarding must explain mission, policy, documentation, privacy, attendance, communication, and escalation.",
    visual: "training",
    items: ["Mission", "Policy", "Privacy", "Documentation", "Escalation"],
  },
  {
    id: "compliance",
    start: 1920,
    duration: 600,
    chapter: "Compliance Control",
    title: "Protect the agency before an audit",
    caption:
      "Strong HR organizes files, licenses, background checks, training records, incident follow-up, and fair employment practices.",
    visual: "dashboard",
    items: ["Files", "Licenses", "Checks", "Training", "Incidents"],
  },
  {
    id: "policy",
    start: 2520,
    duration: 570,
    chapter: "Policy System",
    title: "Policies remove confusion",
    caption:
      "Good policies show staff how to communicate, document, protect client information, handle attendance, and manage performance fairly.",
    visual: "policy",
    items: ["Communication", "Documentation", "Privacy", "Attendance", "Performance"],
  },
  {
    id: "field",
    start: 3090,
    duration: 630,
    chapter: "Field Collaboration",
    title: "HR must connect office and field",
    caption:
      "The best HR personnel listen to caregivers, support supervisors, collaborate with schedulers, and help leadership see what is happening outside the office.",
    visual: "field",
    items: ["Caregivers", "Supervisors", "Schedulers", "Leadership", "Clients"],
  },
  {
    id: "culture",
    start: 3720,
    duration: 540,
    chapter: "Culture",
    title: "Make values visible every day",
    caption:
      "HR shapes compassion and professionalism through coaching, recognition, accountability, and consistent communication.",
    visual: "culture",
    items: ["Coach", "Recognize", "Correct", "Support", "Listen"],
  },
  {
    id: "transform",
    start: 4260,
    duration: 780,
    chapter: "Transformation",
    title: "Strong HR transforms the organization",
    caption:
      "Hiring improves, onboarding becomes smoother, policies become clearer, compliance becomes easier, turnover goes down, and care becomes more stable.",
    visual: "transform",
    items: ["Better hiring", "Smoother onboarding", "Clear policy", "Lower turnover", "Stable care"],
  },
  {
    id: "close",
    start: 5040,
    duration: 720,
    chapter: "Final Standard",
    title: "HR protects the future of Quality One Care",
    caption:
      "A very good HR person connects people, policy, compliance, culture, and growth into one system that protects the organization.",
    visual: "system",
    items: ["People", "Policy", "Compliance", "Culture", "Growth"],
  },
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const entrance = (frame: number, delay = 0, distance = 34) => {
  const s = spring({
    frame: frame - delay,
    fps: 30,
    config: { damping: 18, stiffness: 90, mass: 0.85 },
  });
  return {
    opacity: clamp(interpolate(frame - delay, [0, 18], [0, 1]), 0, 1),
    transform: `translateY(${interpolate(s, [0, 1], [distance, 0])}px)`,
  };
};

const HumanPanel = ({ localFrame }: { localFrame: number }) => {
  const float = Math.sin(localFrame / 28) * 8;
  return (
    <div className="v3HumanPanel" style={{ transform: `translateY(${float}px)` }}>
      <Img src={staticFile("assets/qoc-hr-team.svg")} />
    </div>
  );
};

const Visual = ({
  visual,
  items,
  localFrame,
}: {
  visual: string;
  items: string[];
  localFrame: number;
}) => {
  if (visual === "field") {
    return (
      <div className="v3Field">
        <HumanPanel localFrame={localFrame} />
        <div className="v3FieldRoute">
          {items.map((item, index) => (
            <span className={localFrame > 80 + index * 34 ? "active" : ""} key={item}>
              {item}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (visual === "transform") {
    return (
      <div className="v3Transform">
        <div className="v3Before">Reactive HR</div>
        <div className="v3TransitionArrow">→</div>
        <div className="v3After">Strategic HR</div>
        <div className="v3OutcomeGrid">
          {items.map((item, index) => (
            <span className={localFrame > 70 + index * 28 ? "active" : ""} key={item}>
              {item}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`v3Visual ${visual}`}>
      <HumanPanel localFrame={localFrame} />
      <div className="v3ItemStack">
        {items.map((item, index) => (
          <div className={localFrame > 70 + index * 30 ? "active" : ""} key={item}>
            <span>{index + 1}</span>
            <strong>{item}</strong>
          </div>
        ))}
      </div>
    </div>
  );
};

const Scene = ({ scene }: { scene: (typeof scenes)[number] }) => {
  const frame = useCurrentFrame();
  const localFrame = frame - scene.start;
  const fadeIn = clamp(interpolate(localFrame, [0, 28], [0, 1]), 0, 1);
  const fadeOut = clamp(interpolate(localFrame, [scene.duration - 34, scene.duration], [1, 0]), 0, 1);
  const slide = interpolate(localFrame, [0, 35], [36, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      className="v3Scene"
      style={{ opacity: fadeIn * fadeOut, transform: `translateX(${slide}px)` }}
    >
      <div className="v3Top">
        <div className="v3Logo">
          <Img src={staticFile("assets/qco-logo.png")} />
        </div>
        <div>
          <strong>Quality One Care Home Health Inc.</strong>
          <span>We Care with Golden Hands.</span>
        </div>
      </div>

      <main className="v3Layout">
        <section className="v3Copy">
          <div className="v3Chapter" style={entrance(localFrame, 5, 14)}>
            {scene.chapter}
          </div>
          <h1 style={entrance(localFrame, 18, 28)}>{scene.title}</h1>
          <p style={entrance(localFrame, 42, 24)}>{scene.caption}</p>
        </section>
        <section className="v3Graphic" style={entrance(localFrame, 26, 24)}>
          <Visual items={scene.items} localFrame={localFrame} visual={scene.visual} />
        </section>
      </main>
    </AbsoluteFill>
  );
};

export const HRStrategicV3 = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill className="v3Canvas">
      <div className="v3Grid" />
      <div className="v3WarmBand" />
      {scenes.map((scene) =>
        frame >= scene.start && frame < scene.start + scene.duration ? (
          <Scene key={scene.id} scene={scene} />
        ) : null,
      )}
      <Audio src={staticFile("assets/qoc-hr-v3-narration.mp3")} volume={0.97} />
      <div
        className="v3Progress"
        style={{
          width: `${interpolate(frame, [0, duration], [0, 100], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}%`,
        }}
      />
    </AbsoluteFill>
  );
};

export const hrStrategicV3Duration = duration;
