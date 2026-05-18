import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { hrScenes, hrVideo } from "./hrVideoData";

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const motion = (frame: number, delay = 0, distance = 34) => {
  const progress = spring({
    frame: frame - delay,
    fps: 30,
    config: { damping: 20, stiffness: 88, mass: 0.8 },
  });

  return {
    opacity: clamp(interpolate(frame - delay, [0, 18], [0, 1]), 0, 1),
    transform: `translateY(${interpolate(progress, [0, 1], [distance, 0])}px)`,
  };
};

const HRVisual = ({
  bullets,
  localFrame,
  id,
}: {
  bullets: string[];
  localFrame: number;
  id: string;
}) => {
  const progress = clamp(interpolate(localFrame, [30, 240], [0, 1]), 0, 1);

  return (
    <div className="hrVisualPanel" style={motion(localFrame, 18, 20)}>
      <div className="hrOrbit" style={{ transform: `rotate(${progress * 24}deg)` }}>
        <div className="hrCenterNode">{id === "intro" || id === "close" ? "HR" : "QOC"}</div>
        {bullets.slice(0, 5).map((bullet, index) => {
          const active = localFrame > 70 + index * 26;
          return (
            <div className={active ? "hrNode active" : "hrNode"} key={bullet}>
              {bullet}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const HRPerson = ({
  active,
  role,
}: {
  active: boolean;
  role: "female" | "male";
}) => (
  <div className={active ? `hrPerson ${role} active` : `hrPerson ${role}`}>
    <div className="personHead">
      <div className="personHair" />
      <div className="personFace">
        <span className="eye left" />
        <span className="eye right" />
        <span className="smile" />
      </div>
    </div>
    <div className="personBody">
      <div className="shirt" />
      <div className="badge">HR</div>
    </div>
    <div className="personLabel">
      {role === "female" ? "HR Partner" : "HR Director"}
    </div>
  </div>
);

const CollaborationVisual = ({
  scene,
  localFrame,
}: {
  scene: (typeof hrScenes)[number];
  localFrame: number;
}) => {
  const activeLine = localFrame < scene.duration / 2 ? scene.dialogue[0] : scene.dialogue[1];

  return (
    <div className="collabPanel" style={motion(localFrame, 18, 20)}>
      <div className="fieldBoard">
        <div className="fieldHeader">Field collaboration plan</div>
        {scene.bullets.slice(0, 5).map((bullet, index) => (
          <div className={localFrame > 70 + index * 24 ? "fieldRow active" : "fieldRow"} key={bullet}>
            <span>{index + 1}</span>
            <strong>{bullet}</strong>
          </div>
        ))}
      </div>
      <div className="peopleStage">
        <HRPerson active={activeLine.speaker === "female"} role="female" />
        <div className="sharedDoc">
          <span>QOC</span>
          <strong>Policy + People</strong>
        </div>
        <HRPerson active={activeLine.speaker === "male"} role="male" />
      </div>
    </div>
  );
};

const HRScene = ({ scene }: { scene: (typeof hrScenes)[number] }) => {
  const frame = useCurrentFrame();
  const localFrame = frame - scene.start;
  const out = clamp(interpolate(localFrame, [scene.duration - 35, scene.duration], [1, 0]), 0, 1);
  const activeLineIndex = localFrame < scene.duration / 2 ? 0 : 1;
  const activeLine = scene.dialogue[activeLineIndex];

  return (
    <AbsoluteFill className="hrScene" style={{ opacity: out }}>
      <div className="hrTopBar">
        <div className="hrLogoBox">
          <Img src={staticFile("assets/qco-logo.png")} />
        </div>
        <div>
          <strong>{hrVideo.brand}</strong>
          <span>{hrVideo.tagline}</span>
        </div>
      </div>

      <div className="hrMain">
        <section className="hrCopy">
          <div className="hrChapter" style={motion(localFrame, 4, 16)}>
            {scene.chapter}
          </div>
          <h1 style={motion(localFrame, 18, 28)}>{scene.title}</h1>
          <div className="hrNarration" style={motion(localFrame, 42, 22)}>
            <span>{activeLine.speaker === "female" ? "HR Partner" : "HR Director"}</span>
            {activeLine.text}
          </div>
        </section>

        <section className="hrSide">
          <div className="hrStat" style={motion(localFrame, 12, 20)}>
            <strong>{scene.stat}</strong>
            <span>{scene.statLabel}</span>
          </div>
          {scene.id === "intro" || scene.id === "close" ? (
            <HRVisual bullets={scene.bullets} id={scene.id} localFrame={localFrame} />
          ) : (
            <CollaborationVisual localFrame={localFrame} scene={scene} />
          )}
        </section>
      </div>
    </AbsoluteFill>
  );
};

export const HRTraining = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill className="hrCanvas">
      <div className="hrGrid" />
      <div className="hrBand" />
      <div
        className="hrProgress"
        style={{
          width: `${interpolate(frame, [0, hrVideo.durationInFrames], [0, 100], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}%`,
        }}
      />

      {hrScenes.map((scene, index) => {
        const visible = frame >= scene.start && frame < scene.start + scene.duration;
        return (
          <Sequence durationInFrames={scene.duration} from={scene.start} key={scene.id}>
            {visible ? <HRScene scene={scene} /> : null}
            {scene.dialogue.map((line, lineIndex) => (
              <Sequence from={lineIndex === 0 ? 0 : Math.floor(scene.duration / 2)} key={line.text}>
                <Audio
                  endAt={Math.floor(scene.duration / 2) - 10}
                  src={staticFile(
                    `assets/hr-voice/scene-${String(index + 1).padStart(2, "0")}-line-${lineIndex + 1}.mp3`,
                  )}
                  volume={0.96}
                />
              </Sequence>
            ))}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
