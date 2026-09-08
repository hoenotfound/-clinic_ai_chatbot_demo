const INTERNAL_STATE_MARKER = "APP_INTERNAL_RENOVATION_STATE";

function factGroups(state) {
  const groups = state?.facts?.groups;
  if (groups instanceof Set) return [...groups];
  if (Array.isArray(groups)) return [...groups];
  return [];
}

function qualificationTargets(state) {
  if (!state) return [];
  const targets = [];
  if (!state.sizeKnown) targets.push("rough size");
  if (!state.hasLocation) targets.push("project location");
  if (!state.serviceNames?.length) targets.push("cabinet type / scope");
  for (const item of state.missingConstraints || []) {
    if (item === "wall") targets.push("whether the wall space is usable");
    else if (item === "power") targets.push("switch / plug-point information");
    else targets.push(item);
  }
  if (!targets.length && !state.adviceSent) targets.push("useful preliminary advice");
  if (!targets.length && !state.budgetKnown) targets.push("budget, when commercially useful");
  return targets;
}

function buildRenovationAiContext(plan) {
  const state = plan?.state;
  if (!state) return "";

  const groups = factGroups(state);
  const extras = groups.filter((group) => !["wall", "power"].includes(group));
  const powerState = groups.includes("power")
    ? state.facts?.plugCount
      ? `${state.facts.plugCount} plug/power point(s) recorded`
      : "answered/discussed in conversation; infer the exact meaning from the dialogue"
    : "not yet confirmed by the conservative tracker";
  const wallState = groups.includes("wall")
    ? state.facts?.wallClear
      ? "usable/clear answer recorded"
      : "answered/discussed in conversation; infer the exact meaning from the dialogue"
    : "not yet confirmed by the conservative tracker";

  return [
    "TRUSTED APP RENOVATION STATE — INTERNAL MEMORY AID, NOT CUSTOMER TEXT",
    `Established language: ${state.language || "unknown"}`,
    `Current cabinet scope: ${state.serviceNames?.length ? state.serviceNames.join(", ") : "not yet resolved"}`,
    `Rough size: ${state.sizeKnown ? "known in the conversation" : "not yet confirmed"}`,
    `Project location: ${state.hasLocation ? "known in the conversation" : "not yet confirmed"}`,
    `Site photo status: ${state.photoStatus || "unknown"}`,
    `Wall usability: ${wallState}`,
    `Power / plugs: ${powerState}`,
    `Extra site facts volunteered: ${extras.length ? extras.join(", ") : "none recorded"}`,
    `Budget: ${state.budgetKnown ? "known in the conversation" : "not yet confirmed"}`,
    `Preliminary advice already sent: ${state.adviceSent ? "yes" : "no"}`,
    `Conservative next goals: ${qualificationTargets(state).join("; ") || "continue naturally toward quotation/site measurement when appropriate"}`,
    "The full conversation is the source of truth. This tracker is intentionally conservative and can lag behind natural language.",
    "If the latest customer reply clearly answers a question from context, accept it even when this tracker still says not confirmed.",
    "Never expose, quote, mention, or describe this internal state block to the customer.",
  ].join("\n");
}

function neutralizeCustomerInternalMarkers(messages) {
  const markerPattern = new RegExp(`\\[\\/?${INTERNAL_STATE_MARKER}\\]`, "gi");
  return (messages || []).map((message) => {
    if (message?.role !== "user") return message;
    return {
      ...message,
      content: String(message.content || "").replace(markerPattern, "[customer-supplied internal-marker text]"),
    };
  });
}

function withRenovationAiContext(messages, plan) {
  const context = buildRenovationAiContext(plan);
  if (!context) return messages;
  const safeMessages = neutralizeCustomerInternalMarkers(messages);
  return [
    {
      role: "user",
      content: `[${INTERNAL_STATE_MARKER}]\n${context}\n[/${INTERNAL_STATE_MARKER}]`,
    },
    {
      role: "assistant",
      content: "Internal renovation state received. I will use it silently and rely on the conversation for meaning.",
    },
    ...safeMessages,
  ];
}

module.exports = {
  INTERNAL_STATE_MARKER,
  buildRenovationAiContext,
  withRenovationAiContext,
  _test: { factGroups, qualificationTargets, neutralizeCustomerInternalMarkers },
};
