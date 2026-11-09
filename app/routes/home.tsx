import { Home } from "@/components/board/Home";
import { APP_TITLE } from "@/lib/app-config";

export function meta() {
  return [{ title: `Home | ${APP_TITLE}` }];
}

export default function HomeRoute() {
  return <Home />;
}
