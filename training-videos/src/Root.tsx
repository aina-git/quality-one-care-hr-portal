import "./index.css";
import { Composition } from "remotion";
import { HRTraining } from "./HRTraining";
import { HRStrategicV2 } from "./HRStrategicV2";
import { HRStrategicV3, hrStrategicV3Duration } from "./HRStrategicV3";
import { MyComposition } from "./Composition";
import { hrVideo } from "./hrVideoData";
import { hrV2 } from "./hrV2Data";
import { video } from "./videoData";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="QOC-Daily-Notes-Training"
        component={MyComposition}
        durationInFrames={video.durationInFrames}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ audio: "full" }}
      />
      <Composition
        id="QOC-Quality-Preview-Neural-Voice"
        component={MyComposition}
        durationInFrames={1800}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ audio: "preview" }}
      />
      <Composition
        id="QOC-HR-Department-Training"
        component={HRTraining}
        durationInFrames={hrVideo.durationInFrames}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="QOC-HR-Strategic-Training-V2"
        component={HRStrategicV2}
        durationInFrames={hrV2.durationInFrames}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="QOC-HR-Strategic-Training-V3"
        component={HRStrategicV3}
        durationInFrames={hrStrategicV3Duration}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
