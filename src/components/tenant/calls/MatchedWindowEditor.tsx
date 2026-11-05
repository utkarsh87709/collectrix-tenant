import { useState, type ReactNode } from "react";
import { AlertCircle, Bot, User, UserCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { AgentGroup, MatchedWindow } from "@/lib/call-configuration-api";
import type { AnsweringDevice } from "@/lib/status-automation-api";
import type { AssignableMember } from "@/lib/team-deck-api";
import {
  AnsweringDevicePanel,
  AssignedFilesPanel,
  ChoiceCard,
  GreetingPanel,
  NoAnswerPanel,
  PatchTabBar,
  type PatchTab,
} from "./CallPatchingPanels";
import { AgentSelect } from "./InboundCallFields";

const ASSIGNED_HINT =
  "The caller's number matched a customer file that already sits with a team and a member.";
const AGENT_HINT =
  "Built in the Template Library. It answers the call, works through Right Party Verification and follows its own prompt.";

/** One team's setup for one business-hours window. */
export function MatchedWindowEditor({
  name,
  value,
  onChange,
  members,
  agentGroups,
  canEdit,
  device,
  onDeviceChange,
  canEditDevice,
}: {
  /** Radio group prefix — unique per team and window. */
  name: string;
  value: MatchedWindow;
  onChange: (value: MatchedWindow) => void;
  members: AssignableMember[];
  agentGroups: AgentGroup[];
  canEdit: boolean;
  device: AnsweringDevice;
  onDeviceChange: (device: AnsweringDevice) => void;
  canEditDevice: boolean;
}) {
  const [chosenTab, setTab] = useState<PatchTab>("assigned");
  const { mode } = value;
  const ai = mode === "ai";
  const setAi = (p: Partial<MatchedWindow["ai"]>) =>
    onChange({ ...value, ai: { ...value.ai, ...p } });
  const setDirect = (p: Partial<MatchedWindow["direct"]>) =>
    onChange({ ...value, direct: { ...value.direct, ...p } });

  const tabs: PatchTab[] = ai
    ? ["assigned", "device", "noAnswer"]
    : ["greeting", "assigned", "device", "noAnswer"];
  const tab = tabs.includes(chosenTab) ? chosenTab : "assigned";
  const routing = ai ? value.ai : value.direct;
  const setRouting = ai ? setAi : setDirect;

  const assignedPanel = (
    <AssignedFilesPanel
      name={`${name}-${mode}-assigned`}
      value={routing.assigned}
      onChange={(assigned) => setRouting({ assigned })}
      members={members}
      description={ASSIGNED_HINT}
      forwarding
    />
  );

  return (
    <div className="px-6 py-5 space-y-5">
      <fieldset disabled={!canEdit} className="min-w-0">
        <div className="text-sm font-medium mb-2">Calls are answered by</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceCard
            name={`${name}-mode`}
            checked={ai}
            onSelect={() => onChange({ ...value, mode: "ai" })}
            icon={<Bot className="h-4 w-4" />}
            title="AI"
            hint="The voice agent answers, identifies the caller against a customer file, and follows your inbound script."
          />
          <ChoiceCard
            name={`${name}-mode`}
            checked={mode === "directPatch"}
            onSelect={() => onChange({ ...value, mode: "directPatch" })}
            icon={<User className="h-4 w-4" />}
            title="A human"
            hint="The call rings your people."
          />
        </div>
        {mode === null && (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-warning/15 px-3 py-2 text-xs text-warning-foreground">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            Pick who answers inbound calls for this team. The configuration can&apos;t be saved
            until you do.
          </p>
        )}
      </fieldset>

      {mode !== null && (
        <div className="space-y-3">
          {/* The tab bar stays outside the fieldset so it can still be browsed
              in read-only mode. */}
          <PatchTabBar tabs={tabs} active={tab} onSelect={setTab} />
          <fieldset disabled={!canEdit} className="min-w-0">
            {tab === "greeting" && (
              <GreetingPanel
                value={value.direct.greeting}
                onChange={(greeting) => setDirect({ greeting })}
              />
            )}
            {tab === "assigned" &&
              (ai ? (
                <AiFilesBranch
                  on={value.ai.assignedOn}
                  onToggle={(assignedOn) => setAi({ assignedOn })}
                  agentId={value.ai.assignedAgentId}
                  onAgent={(assignedAgentId) => setAi({ assignedAgentId })}
                  agentGroups={agentGroups}
                  canEdit={canEdit}
                >
                  {assignedPanel}
                </AiFilesBranch>
              ) : (
                assignedPanel
              ))}
            {tab === "noAnswer" && (
              <NoAnswerPanel
                value={routing.noAnswerMessage}
                onChange={(noAnswerMessage) => setRouting({ noAnswerMessage })}
              />
            )}
          </fieldset>
          {tab === "device" && (
            <fieldset disabled={!canEditDevice} className="min-w-0 space-y-2">
              <AnsweringDevicePanel
                name={`${name}-device`}
                value={device}
                onChange={onDeviceChange}
              />
              <p className="text-[11px] text-muted-foreground">
                Set once for the whole business, separately for each hours window.
                {!canEditDevice && " Only a tenant admin can change it."}
              </p>
            </fieldset>
          )}
        </div>
      )}
    </div>
  );
}

/** Assigned files with the AI answering: on or off, the agent, and who a
 *  transfer reaches. */
function AiFilesBranch({
  on,
  onToggle,
  agentId,
  onAgent,
  agentGroups,
  canEdit,
  children,
}: {
  on: boolean;
  onToggle: (on: boolean) => void;
  agentId: number | null;
  onAgent: (id: number | null) => void;
  agentGroups: AgentGroup[];
  canEdit: boolean;
  children: ReactNode;
}) {
  const title = "Callers whose file is assigned";
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4 rounded-lg border border-border px-4 py-3">
        <div className="flex items-start gap-2 min-w-0">
          <UserCheck className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
          <div>
            <div className="text-sm font-semibold">{title}</div>
            <p className="text-xs text-muted-foreground">{ASSIGNED_HINT}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-semibold">{on ? "ON" : "OFF"}</span>
          <Switch checked={on} onCheckedChange={onToggle} disabled={!canEdit} aria-label={title} />
        </div>
      </div>
      {on ? (
        <>
          <AgentSelect
            label="AI agent for assigned files"
            hint={AGENT_HINT}
            value={agentId}
            onChange={onAgent}
            groups={agentGroups}
          />
          {children}
        </>
      ) : (
        <p className="px-1 text-xs text-muted-foreground">Switched off for these files.</p>
      )}
    </div>
  );
}
