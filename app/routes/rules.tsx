import { RulesStep } from "@/components/board/RulesPanel";
import { WeekLoader } from "@/components/board/StepShell";
import { APP_TITLE } from "@/lib/app-config";

export function meta() {
  return [{ title: `Rules | ${APP_TITLE}` }];
}

export default function Route() {
  return <WeekLoader current="rules" allowEmpty={false}>{(w) => <RulesStep data={w} />}</WeekLoader>;
}
