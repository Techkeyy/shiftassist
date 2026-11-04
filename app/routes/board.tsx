import { Board } from "@/components/board/Board";
import { APP_TITLE } from "@/lib/app-config";

export function meta() {
  return [{ title: `Board — ${APP_TITLE}` }];
}

export default function BoardRoute() {
  return <Board />;
}
