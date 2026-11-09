import { ShareStep } from "@/components/board/ShareStep";
import { WeekLoader } from "@/components/board/StepShell";
import { APP_TITLE } from "@/lib/app-config";

export function meta() {
  return [{ title: `Share | ${APP_TITLE}` }];
}

export default function Route() {
  return <WeekLoader current="share" allowEmpty={false}>{(w) => <ShareStep data={w} />}</WeekLoader>;
}
