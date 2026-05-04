import { startJobRunner } from "@/services/jobs/jobRunner";

export function JobRunnerBootstrap() {
  startJobRunner();
  return null;
}
