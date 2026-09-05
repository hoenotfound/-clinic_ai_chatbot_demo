const selectedIndustry = String(process.env.DEMO_INDUSTRY || "clinic").trim().toLowerCase();

if (selectedIndustry === "renovation" || selectedIndustry === "home-renovation" || selectedIndustry === "carpentry") {
  const clinicConfig = require("./clinicConfig");
  const renovationConfig = require("./renovationConfig");
  const renovationPrompt = require("./renovationSystemPrompt");
  const renovationFallback = require("./renovationFallback");

  // Keep the existing clinic implementation as the default. For an explicitly
  // selected renovation deployment, reuse the same stable demo server/session
  // stack while swapping only the business knowledge and conversation rules.
  for (const key of Object.keys(clinicConfig)) delete clinicConfig[key];
  Object.assign(clinicConfig, renovationConfig);

  const systemPromptModule = require("./systemPrompt");
  systemPromptModule.buildSystemPrompt = renovationPrompt.buildSystemPrompt;

  const clinicFallbackModule = require("./clinicFallback");
  clinicFallbackModule.buildFallbackReply = renovationFallback.buildFallbackReply;

  // These clinic-specific deterministic layers are intentionally bypassed for
  // renovation mode. The renovation prompt/fallback owns quotation, site-visit
  // and technical handoff behaviour instead.
  const safetyRulesModule = require("./safetyRules");
  safetyRulesModule.enforceSafetyRules = () => null;

  const bookingRulesModule = require("./bookingRules");
  bookingRulesModule.enforceBookingRules = () => null;

  const concernFallbackModule = require("./concernFallback");
  concernFallbackModule.buildConcernFallback = () => null;

  const clinicKnowledgeModule = require("./clinicKnowledge");
  clinicKnowledgeModule.concernGuidanceForPrompt = () => [
    "- Qualify renovation leads gradually: project scope, property type, area, measurements/floor plan, budget and timeline.",
    "- Exact quotations require sufficient measurements/material details or staff follow-up.",
    "- Site measurement requests and site-specific technical questions should be handed to staff.",
  ].join("\n");
  clinicKnowledgeModule.bookingRulesForPrompt = () => [
    "- Treat site-measurement and detailed-quotation requests as high intent.",
    "- Never invent availability or claim a real site visit is booked.",
    "- Once staff can continue, recap known project details and append [[HANDOFF]].",
  ].join("\n");

  if (!process.env.SALES_CTA_LABEL || process.env.SALES_CTA_LABEL === "Set up my clinic") {
    process.env.SALES_CTA_LABEL = "Set up my renovation chatbot";
  }
}
