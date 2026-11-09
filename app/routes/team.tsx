import { TeamStep } from "@/components/board/TeamStep";
import { WeekLoader } from "@/components/board/StepShell";
import { APP_TITLE } from "@/lib/app-config";

export function meta() {
  return [{ title: `Team | ${APP_TITLE}` }];
}

export default function Route() {
  return <WeekLoader current="team" allowEmpty={true}>{(w) => <TeamStep data={w} />}</WeekLoader>;
}
