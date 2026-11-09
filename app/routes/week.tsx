import { WeekStep } from "@/components/board/WeekStep";
import { WeekLoader } from "@/components/board/StepShell";
import { APP_TITLE } from "@/lib/app-config";

export function meta() {
  return [{ title: `Week | ${APP_TITLE}` }];
}

export default function Route() {
  return <WeekLoader current="week" allowEmpty={false}>{(w) => <WeekStep data={w} />}</WeekLoader>;
}
