import type { WeekView } from "../../../server/lib/week-view";
import { PublishPanel } from "./PublishPanel";
import { StepShell } from "./StepShell";
import { WeekPreview } from "./WeekPreview";

export function ShareStep({ data }: { data: WeekView }) {
  const live = Boolean(data.published);
  return (
    <StepShell
      current="share"
      title="Send your staff their week"
      lead={live ? "Your week is live. Copy the link and paste it where your staff will see it." : "Publish your week to get a link your staff can open on their phone."}
      back={{ label: "Back", to: "/week" }}
      next={{ label: live ? "Done" : "Skip for now", to: "/home" }}
      nextQuiet={!live}
    >
      <div className="share-grid">
        <div>
          <PublishPanel week={data} />
        </div>
        <div>
          <h2 className="display setup-h">What your staff will see</h2>
          <WeekPreview week={data} label="What your staff will see" />
        </div>
      </div>
    </StepShell>
  );
}
