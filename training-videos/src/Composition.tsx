import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { checklist, scenes, speakerScript, video } from "./videoData";

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const enter = (frame: number, delay = 0, distance = 40) => {
  const progress = spring({
    frame: frame - delay,
    fps: 30,
    config: { damping: 18, stiffness: 90, mass: 0.8 },
  });

  return {
    opacity: clamp(interpolate(frame - delay, [0, 18], [0, 1]), 0, 1),
    transform: `translateY(${interpolate(progress, [0, 1], [distance, 0])}px)`,
  };
};

const ProgressRail = ({ frame }: { frame: number }) => {
  const width = `${interpolate(frame, [0, video.durationInFrames], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  })}%`;

  return (
    <div className="progressShell">
      <div className="progressFill" style={{ width }} />
    </div>
  );
};

const BrowserMock = ({ localFrame }: { localFrame: number }) => {
  const rows = ["Visit completed", "Meal prepared", "Medication reminder", "Mobility support"];

  return (
    <div className="browserMock" style={enter(localFrame, 20, 24)}>
      <div className="browserTop">
        <span />
        <span />
        <span />
      </div>
      <div className="browserBody">
        <div className="browserHeader">Daily Note Review</div>
        {rows.map((row, index) => {
          const active = localFrame > 45 + index * 18;
          return (
            <div className="noteRow" key={row}>
              <div className={active ? "checkDot active" : "checkDot"} />
              <div>
                <strong>{row}</strong>
                <p>{active ? "Specific detail captured" : "Waiting for review"}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const BrandIntro = ({ localFrame }: { localFrame: number }) => (
  <div className="brandIntro" style={enter(localFrame, 10, 26)}>
    <Img className="heroLogo" src={staticFile("assets/qco-logo.png")} />
    <div className="brandDivider" />
    <p>{video.tagline}</p>
  </div>
);

const WorkflowSteps = ({ localFrame }: { localFrame: number }) => {
  const steps = ["Time", "Care", "Response", "Change", "Next action"];

  return (
    <div className="stepGrid">
      {steps.map((step, index) => {
        const active = localFrame > 42 + index * 18;
        return (
          <div className={active ? "stepCard active" : "stepCard"} key={step}>
            <div className="stepNumber">{index + 1}</div>
            <span>{step}</span>
          </div>
        );
      })}
    </div>
  );
};

const QualityPanel = ({ localFrame }: { localFrame: number }) => {
  const reveal = clamp(interpolate(localFrame, [70, 140], [0, 1]), 0, 1);

  return (
    <div className="qualityPanel" style={enter(localFrame, 25, 24)}>
      <div className="badNote">
        <span>Vague</span>
        <p>"Client was fine today."</p>
      </div>
      <div className="arrowLine" style={{ transform: `scaleX(${reveal})` }} />
      <div className="goodNote">
        <span>Better</span>
        <p>Client ate lunch, completed hygiene routine, and reported mild knee discomfort at 2:15 PM.</p>
      </div>
    </div>
  );
};

const EscalationPanel = ({ localFrame }: { localFrame: number }) => {
  const items = ["Condition", "Safety", "Medication routine", "Family concern"];

  return (
    <div className="escalationPanel" style={enter(localFrame, 28, 24)}>
      {items.map((item, index) => {
        const active = localFrame > 52 + index * 24;
        return (
          <div className={active ? "alertItem active" : "alertItem"} key={item}>
            <div className="alertIcon">!</div>
            <span>{item}</span>
          </div>
        );
      })}
    </div>
  );
};

const PrivacyPanel = ({ localFrame }: { localFrame: number }) => {
  const pulse = 1 + Math.sin(localFrame / 10) * 0.035;

  return (
    <div className="privacyPanel" style={enter(localFrame, 25, 22)}>
      <div className="shield" style={{ transform: `scale(${pulse})` }}>
        <div className="shieldInner">PHI</div>
      </div>
      <div className="privacyList">
        <span>Keep records secure</span>
        <span>Use approved systems</span>
        <span>Limit details to the care record</span>
      </div>
    </div>
  );
};

const ChecklistPanel = ({ localFrame }: { localFrame: number }) => (
  <div className="checklistPanel">
    {checklist.map((item, index) => {
      const active = localFrame > 60 + index * 22;
      return (
        <div className={active ? "finalCheck active" : "finalCheck"} key={item}>
          <div className="tick">{active ? "OK" : ""}</div>
          <span>{item}</span>
        </div>
      );
    })}
  </div>
);

const SceneVisual = ({ sceneId, localFrame }: { sceneId: string; localFrame: number }) => {
  if (sceneId === "opening" || sceneId === "outro") {
    return <BrandIntro localFrame={localFrame} />;
  }

  if (sceneId === "workflow") {
    return <WorkflowSteps localFrame={localFrame} />;
  }

  if (sceneId === "quality") {
    return <QualityPanel localFrame={localFrame} />;
  }

  if (sceneId === "privacy") {
    return <PrivacyPanel localFrame={localFrame} />;
  }

  if (sceneId === "escalation") {
    return <EscalationPanel localFrame={localFrame} />;
  }

  if (sceneId === "close" || sceneId === "checklist") {
    return <ChecklistPanel localFrame={localFrame} />;
  }

  if (sceneId === "example") {
    return <QualityPanel localFrame={localFrame} />;
  }

  return <BrowserMock localFrame={localFrame} />;
};

const Scene = ({
  scene,
  frame,
}: {
  scene: (typeof scenes)[number];
  frame: number;
}) => {
  const localFrame = frame - scene.start;
  const sceneProgress = clamp(localFrame / scene.duration, 0, 1);
  const out = clamp(interpolate(localFrame, [scene.duration - 35, scene.duration], [1, 0]), 0, 1);

  return (
    <AbsoluteFill className="scene" style={{ opacity: out }}>
      <div className="sceneGlow" style={{ transform: `translateX(${sceneProgress * 220}px)` }} />
      <div className="topBar">
        <div className="brandMark">
          <Img src={staticFile("assets/qco-logo.png")} />
        </div>
        <span>{video.brand}</span>
      </div>

      <main className="layout">
        <section className="copyBlock">
          <div className="eyebrow" style={enter(localFrame, 5, 18)}>
            {scene.eyebrow}
          </div>
          <h1 style={enter(localFrame, 18, 34)}>{scene.title}</h1>
          <p className="bodyCopy" style={enter(localFrame, 34, 28)}>
            {scene.body}
          </p>
          <div className="captionStrip" style={enter(localFrame, 58, 24)}>
            <span>Voiceover</span>
            <p>{speakerScript[Math.min(scenes.indexOf(scene), speakerScript.length - 1)]}</p>
          </div>
        </section>

        <section className="visualBlock">
          <div className="metricBadge" style={enter(localFrame, 12, 22)}>
            <strong>{scene.metric}</strong>
            <span>{scene.metricLabel}</span>
          </div>
          <SceneVisual sceneId={scene.id} localFrame={localFrame} />
        </section>
      </main>
    </AbsoluteFill>
  );
};

export const MyComposition = ({
  audio = "full",
}: {
  audio?: "full" | "preview" | "none";
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  return (
    <AbsoluteFill className="videoCanvas" style={{ width, height }}>
      <div className="backgroundGrid" />
      <div className="accentBlock one" />
      <div className="accentBlock two" />

      {scenes.map((scene) => {
        const isVisible = frame >= scene.start && frame < scene.start + scene.duration;
        return isVisible ? <Scene frame={frame} key={scene.id} scene={scene} /> : null;
      })}

      {audio === "full" ? (
        <Audio src={staticFile("assets/qoc-american-female-voiceover.wav")} volume={0.95} />
      ) : null}
      {audio === "preview" ? (
        <Audio endAt={1740} src={staticFile("assets/qoc-preview-jenny-neural.mp3")} volume={0.95} />
      ) : null}
      <ProgressRail frame={frame} />
    </AbsoluteFill>
  );
};
