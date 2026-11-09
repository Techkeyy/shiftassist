import { Navigate } from "react-router";

import { nextStepOf, useWeek } from "@/components/board/week-state";

// The old all-in-one board is gone. Old links go to the step that matches the week's state.
export default function BoardRoute() {
  const q = useWeek();
  if (q.isLoading) return null;
  if (!q.data?.hasWeek) return <Navigate to="/home" replace />;
  return <Navigate to={nextStepOf(q.data).to} replace />;
}
