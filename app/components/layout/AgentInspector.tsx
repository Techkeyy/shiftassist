import { navigateWithAgentChatViewTransition } from "@agent-native/core/client/agent-chat";
import { useT } from "@agent-native/core/client/i18n";
import { focusAgentChat } from "@agent-native/toolkit/app/chat";
import { AgentSidebar } from "@agent-native/toolkit/app/chat";
import { type ReactNode, useEffect, useState } from "react";
import { useActionQuery } from "@agent-native/core/client/hooks";
import { useLocation, useNavigate } from "react-router";

import { chatThreadPath } from "@/lib/chat-paths";
import { TAB_ID } from "@/lib/tab-id";

interface AgentInspectorProps {
  children: ReactNode;
  chatHomeHandoffActive: boolean;
  chatHomeHandoffPending: boolean;
}

/** Below 1280 px the chat panel floats over the board instead of squeezing it. */
function useNarrowViewport() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1279px)");
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return narrow;
}

/** Prompts that fit the screen the manager is looking at, with real names from their own week. */
function useScreenSuggestions(fallback: string[]): string[] {
  const { pathname } = useLocation();
  const onStep = /^\/(home|team|rules|week|share)(\/|$)/.test(pathname);
  const week = useActionQuery("get-week", {}, { enabled: onStep });
  const w = week.data;
  if (!onStep || !w?.hasWeek) return fallback;
  const first = w.staff[0]?.name ?? "someone";
  const second = w.staff[1]?.name ?? first;
  if (pathname.startsWith("/week")) {
    const lunch = w.slots.find((x) => x.start < "15:00");
    const day = lunch ? new Date(`${lunch.date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" }) : "Friday";
    return [`Give ${first} ${day}'s lunch shift`, "Who has the most closing shifts?", `Why does ${second} have so many weekend shifts?`];
  }
  if (pathname.startsWith("/rules")) {
    return [`Add a rule: ${first} can't work Mondays`, "What do the rules in use mean for my week?", "Which of my staff have the tightest limits?"];
  }
  if (pathname.startsWith("/team")) {
    return ["Add a new cook to my team", `Change ${first}'s most shifts a week to 4`, "Who on my team can work as a server?"];
  }
  if (pathname.startsWith("/share")) {
    return ["Write the message I will send my staff with the link", "What will my staff see on the link?", "Is anyone missing a shift this week?"];
  }
  return ["What should I do next?", "Who is working this Friday?", "Someone called in sick. What do I do?"];
}

/** Contextual inspector shell used on secondary chat routes. */
export function AgentInspector({
  children,
  chatHomeHandoffActive,
  chatHomeHandoffPending,
}: AgentInspectorProps) {
  const navigate = useNavigate();
  const t = useT();
  const narrow = useNarrowViewport();
  const screenSuggestions = useScreenSuggestions([
    t("chat.inspectSuggestionCapabilities"),
    t("chat.inspectSuggestionHello"),
    t("chat.inspectSuggestionAction"),
  ]);

  function openAskAgentFullscreen(threadId?: string) {
    focusAgentChat();
    navigateWithAgentChatViewTransition(navigate, chatThreadPath(threadId));
  }

  return (
    <AgentSidebar
      position="right"
      forceOverlay={narrow}
      chatViewTransition
      chatViewTransitionHandoff={chatHomeHandoffPending}
      storageKey="chat"
      browserTabId={TAB_ID}
      openOnChatRunning={chatHomeHandoffActive}
      onFullscreenRequest={openAskAgentFullscreen}
      emptyStateText={t("chat.inspectEmptyState")}
      agentPageHref="/settings/agent"
      suggestions={screenSuggestions}
    >
      {children}
    </AgentSidebar>
  );
}
