import { redirect } from "react-router";

import { APP_TITLE } from "@/lib/app-config";

export function meta() {
  return [{ title: APP_TITLE }];
}

// ShiftAssist has no Get started page: signed-in users land on the week.
export function loader() {
  return redirect("/board");
}

export default function HomeRoute() {
  return null;
}
