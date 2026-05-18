import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { hrV2, hrV2Scenes } from "./hrV2Data";

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const rise = (frame: number, delay = 0, distance = 30) => {
  const s = spring({
    frame: frame - delay,
    fps: 30,
    config: { damping: 18, stiffness: 88, mass: 0.85 },
  });

  return {
    opacity: clamp(interpolate(frame - delay, [0, 16], [0, 1]), 0, 1),
    transform: `translateY(${interpolate(s, [0, 1], [distance, 0])}px)`,
  };
};

const Person = ({ variant }: { variant: "female" | "male" }) => (
  <div className={`v2Person ${variant}`}>
    <div className="v2Head">
      <div className="v2Hair" />
      <div className="v2Face">
        <span className="v2Eye left" />
        <span className="v2Eye right" />
        <span className="v2Smile" />
      </div>
    </div>
    <div className="v2Body">
      <span>HR</span>
    </div>
  </div>
);

const OpeningGraphic = ({ localFrame, pillars }: { localFrame: number; pillars: string[] }) => (
  <div className="v2OperatingSystem" style={rise(localFrame, 24, 22)}>
    <div className="v2LogoCore">
      <Img src={staticFile("assets/qco-logo.png")} />
    </div>
    {pillars.map((pillar, index) => (
      <div className={`v2OrbitItem item${index + 1}`} key={pillar}>
        {pillar}
      </div>
    ))}
  </div>
);

const PipelineGraphic = ({ localFrame, pillars }: { localFrame: number; pillars: string[] }) => (
  <div className="v2Pipeline" style={rise(localFrame, 24, 22)}>
    {pillars.map((pillar, index) => (
      <div className={localFrame > 58 + index * 34 ? "v2PipeStep active" : "v2PipeStep"} key={pillar}>
        <span>{index + 1}</span>
        <strong>{pillar}</strong>
      </div>
    ))}
  </div>
);

const PolicyGraphic = ({ localFrame, pillars }: { localFrame: number; pillars: string[] }) => (
  <div className="v2PolicyGrid" style={rise(localFrame, 24, 22)}>
    {pillars.map((pillar, index) => (
      <div className={localFrame > 62 + index * 30 ? "v2PolicyCell active" : "v2PolicyCell"} key={pillar}>
        <div className="v2DocIcon" />
        <strong>{pillar}</strong>
        <span>Clear standard</span>
      </div>
    ))}
  </div>
);

const ComplianceGraphic = ({ localFrame, pillars }: { localFrame: number; pillars: string[] }) => (
  <div className="v2Dashboard" style={rise(localFrame, 24, 22)}>
    <div className="v2DashHeader">Compliance Dashboard</div>
    {pillars.map((pillar, index) => (
      <div className={localFrame > 55 + index * 32 ? "v2DashRow active" : "v2DashRow"} key={pillar}>
        <strong>{pillar}</strong>
        <div>
          <span style={{ width: `${58 + index * 8}%` }} />
        </div>
        <em>Ready</em>
      </div>
    ))}
  </div>
);

const CollaborationGraphic = ({ localFrame, pillars }: { localFrame: number; pillars: string[] }) => (
  <div className="v2FieldScene" style={rise(localFrame, 24, 22)}>
    <div className="v2FieldMap">
      {pillars.map((pillar, index) => (
        <div className={localFrame > 70 + index * 26 ? "v2MapPin active" : "v2MapPin"} key={pillar}>
          {pillar}
        </div>
      ))}
    </div>
    <div className="v2People">
      <Person variant="female" />
      <div className="v2SharedFolder">Field + Office</div>
      <Person variant="male" />
    </div>
  </div>
);

const TransformationGraphic = ({ localFrame, pillars }: { localFrame: number; pillars: string[] }) => (
  <div className="v2Transform" style={rise(localFrame, 24, 22)}>
    <div className="v2Before">
      <span>Before</span>
      <strong>Reactive HR</strong>
    </div>
    <div className="v2Arrow">→</div>
    <div className="v2After">
      <span>After</span>
      <strong>Strategic HR</strong>
    </div>
    <div className="v2Outcomes">
      {pillars.map((pillar, index) => (
        <div className={localFrame > 80 + index * 24 ? "active" : ""} key={pillar}>
          {pillar}
        </div>
      ))}
    </div>
  </div>
);

const Graphic = ({ scene, localFrame }: { scene: (typeof hrV2Scenes)[number]; localFrame: number }) => {
  if (scene.id === "opening" || scene.id === "close") {
    return <OpeningGraphic localFrame={localFrame} pillars={scene.pillars} />;
  }
  if (scene.id === "people") {
    return <PipelineGraphic localFrame={localFrame} pillars={scene.pillars} />;
  }
  if (scene.id === "policy") {
    return <PolicyGraphic localFrame={localFrame} pillars={scene.pillars} />;
  }
  if (scene.id === "compliance") {
    return <ComplianceGraphic localFrame={localFrame} pillars={scene.pillars} />;
  }
  if (scene.id === "culture") {
    return <CollaborationGraphic localFrame={localFrame} pillars={scene.pillars} />;
  }
  return <TransformationGraphic localFrame={localFrame} pillars={scene.pillars} />;
};

const Scene = ({ scene }: { scene: (typeof hrV2Scenes)[number] }) => {
  const frame = useCurrentFrame();
  const localFrame = frame - scene.start;
  const fadeOut = clamp(interpolate(localFrame, [scene.duration - 36, scene.duration], [1, 0]), 0, 1);

  return (
    <AbsoluteFill className="v2Scene" style={{ opacity: fadeOut }}>
      <div className="v2Header">
        <div className="v2Logo">
          <Img src={staticFile("assets/qco-logo.png")} />
        </div>
        <div>
          <strong>{hrV2.brand}</strong>
          <span>{hrV2.tagline}</span>
        </div>
      </div>

      <main className="v2Layout">
        <section className="v2Text">
          <div className="v2Chapter" style={rise(localFrame, 5, 16)}>
            {scene.chapter}
          </div>
          <h1 style={rise(localFrame, 18, 26)}>{scene.title}</h1>
          <div className="v2Caption" style={rise(localFrame, 42, 22)}>
            {scene.narration}
          </div>
        </section>
        <section className="v2Graphic">
          <Graphic localFrame={localFrame} scene={scene} />
        </section>
      </main>
    </AbsoluteFill>
  );
};

export const HRStrategicV2 = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill className="v2Canvas">
      <div className="v2Grid" />
      <div className="v2SideBand" />
      {hrV2Scenes.map((scene) =>
        frame >= scene.start && frame < scene.start + scene.duration ? (
          <Scene key={scene.id} scene={scene} />
        ) : null,
      )}
      <Audio src={staticFile("assets/qoc-hr-v2-narration.mp3")} volume={0.96} />
      <div
        className="v2Progress"
        style={{
          width: `${interpolate(frame, [0, hrV2.durationInFrames], [0, 100], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}%`,
        }}
      />
    </AbsoluteFill>
  );
};
