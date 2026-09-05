const { AsyncLocalStorage } = require("async_hooks");
const { publicExperienceFor } = require("./publicExperienceProfiles");

const renovationAliases = new Set(["renovation", "home-renovation", "carpentry"]);
const industryContext = new AsyncLocalStorage();

function normalizeIndustryKey(value) {
  const selected = String(value || "clinic").trim().toLowerCase();
  return renovationAliases.has(selected) ? "renovation" : "clinic";
}

function clinicProfile() {
  const config = require("./clinicConfig");
  const { buildSystemPrompt } = require("./systemPrompt");
  const { buildFallbackReply } = require("./clinicFallback");
  const { buildConcernFallback } = require("./concernFallback");
  const { enforceBookingRules } = require("./bookingRules");
  const { enforceSafetyRules } = require("./safetyRules");
  const { concernGuidanceForPrompt, bookingRulesForPrompt } = require("./clinicKnowledge");

  return {
    key: "clinic",
    config,
    selector: {
      label: "Aesthetic Clinic",
      eyebrow: "APPOINTMENTS & TREATMENTS",
      description: "Treatment enquiries, pricing, appointment intent, multilingual replies and human takeover.",
      highlights: ["Treatment enquiries", "Appointment intent", "Patient handoff"],
      icon: "clinic",
    },
    labels: {
      customer: "Patient",
      service: "Treatment",
      location: "Branch",
      timing: "Timing",
      appointment: "Appointment",
      dashboard: "Clinic Dashboard",
      staff: "Clinic staff",
    },
    highIntentFields: ["bookingIntent"],
    buildSystemPrompt,
    buildFallbackReply,
    buildConcernFallback,
    enforceBookingRules,
    enforceSafetyRules,
    concernGuidanceForPrompt,
    bookingRulesForPrompt,
    salesCtaDefault: "Set up my clinic",
    acquisitionPresets: {
      "hifu-facebook": { key: "hifu-facebook", label: "HIFU Facebook Ad", source: "Meta Ads", campaign: "HIFU Jawline Demo Campaign", treatment: "HIFU Skin Lifting", channel: "facebook" },
      "pico-instagram": { key: "pico-instagram", label: "Pico Instagram Ad", source: "Meta Ads", campaign: "Pico Demo Campaign", treatment: "Pico Laser", channel: "instagram" },
      "organic-whatsapp": { key: "organic-whatsapp", label: "Organic WhatsApp", source: "Organic", campaign: null, treatment: null, channel: "whatsapp" },
      referral: { key: "referral", label: "Referral", source: "Referral", campaign: null, treatment: null, channel: "whatsapp" },
    },
    publicExperience: publicExperienceFor("clinic"),
  };
}

function renovationProfile() {
  const config = require("./renovationConfig");
  const { buildSystemPrompt } = require("./renovationSystemPrompt");
  const { buildFallbackReply } = require("./renovationFallback");

  return {
    key: "renovation",
    config,
    selector: {
      label: "Home Renovation & Carpentry",
      eyebrow: "QUOTATIONS & SITE MEASUREMENT",
      description: "Kitchen cabinets, wardrobes, renovation qualification, quotation intent and site-measurement handoff.",
      highlights: ["Cabinet enquiries", "Quotation intent", "Site measurement"],
      icon: "home",
    },
    labels: {
      customer: "Customer",
      service: "Project",
      location: "Area",
      timing: "Timeline",
      appointment: "Site measurement",
      dashboard: "Sales Dashboard",
      staff: "Renovation staff",
    },
    highIntentFields: ["quotationIntent", "siteMeasurementIntent", "humanRequest", "technicalHandoff"],
    buildSystemPrompt,
    buildFallbackReply,
    buildConcernFallback: () => null,
    enforceBookingRules: () => null,
    enforceSafetyRules: () => null,
    concernGuidanceForPrompt: () => [
      "- Qualify renovation leads gradually: project scope, property type/status, area, measurements/floor plan, budget and timeline.",
      "- Exact quotations require sufficient measurements/material details or staff follow-up.",
      "- Site measurement requests and site-specific technical questions should be handed to staff.",
    ].join("\n"),
    bookingRulesForPrompt: () => [
      "- Treat site-measurement and detailed-quotation requests as high intent.",
      "- A request to speak with staff is a handoff signal, but is not automatically a quotation request.",
      "- Never invent availability or claim a real site visit is booked.",
      "- Once staff can continue, recap known project details and append [[HANDOFF]].",
    ].join("\n"),
    salesCtaDefault: "Set up my renovation chatbot",
    acquisitionPresets: {
      "hifu-facebook": { key: "hifu-facebook", label: "Kitchen Cabinets Facebook Ad", source: "Meta Ads", campaign: "Kitchen Cabinets Demo Campaign", treatment: "Kitchen Cabinets", channel: "facebook" },
      "pico-instagram": { key: "pico-instagram", label: "Wardrobe Instagram Ad", source: "Meta Ads", campaign: "Built-in Wardrobe Demo Campaign", treatment: "Built-in Wardrobes", channel: "instagram" },
      "organic-whatsapp": { key: "organic-whatsapp", label: "Organic WhatsApp", source: "Organic", campaign: null, treatment: null, channel: "whatsapp" },
      referral: { key: "referral", label: "Referral", source: "Referral", campaign: null, treatment: null, channel: "whatsapp" },
    },
    publicExperience: publicExperienceFor("renovation"),
  };
}

const profileFactories = { clinic: clinicProfile, renovation: renovationProfile };
const profileCache = new Map();
const defaultIndustryKey = normalizeIndustryKey(process.env.DEMO_INDUSTRY || "clinic");

function getIndustryProfile(value) {
  const key = normalizeIndustryKey(value || industryContext.getStore() || defaultIndustryKey);
  if (!profileCache.has(key)) profileCache.set(key, profileFactories[key]());
  return profileCache.get(key);
}

function currentIndustryKey() {
  return getIndustryProfile().key;
}

function runWithIndustry(value, callback) {
  return industryContext.run(normalizeIndustryKey(value || defaultIndustryKey), callback);
}

function listIndustryProfiles() {
  return ["clinic", "renovation"].map((key) => {
    const profile = getIndustryProfile(key);
    return { key: profile.key, ...profile.selector };
  });
}

function delegate(name) {
  return (...args) => getIndustryProfile()[name](...args);
}

const configProxy = new Proxy({}, {
  get(_target, property) {
    return getIndustryProfile().config[property];
  },
  has(_target, property) {
    return property in getIndustryProfile().config;
  },
  ownKeys() {
    return Reflect.ownKeys(getIndustryProfile().config);
  },
  getOwnPropertyDescriptor(_target, property) {
    const descriptor = Object.getOwnPropertyDescriptor(getIndustryProfile().config, property);
    return descriptor ? { ...descriptor, configurable: true } : undefined;
  },
});

const exported = {
  config: configProxy,
  normalizeIndustryKey,
  getIndustryProfile,
  currentIndustryKey,
  runWithIndustry,
  listIndustryProfiles,
  buildSystemPrompt: delegate("buildSystemPrompt"),
  buildFallbackReply: delegate("buildFallbackReply"),
  buildConcernFallback: delegate("buildConcernFallback"),
  enforceBookingRules: delegate("enforceBookingRules"),
  enforceSafetyRules: delegate("enforceSafetyRules"),
  concernGuidanceForPrompt: delegate("concernGuidanceForPrompt"),
  bookingRulesForPrompt: delegate("bookingRulesForPrompt"),
};

for (const property of ["key", "selector", "labels", "highIntentFields", "salesCtaDefault", "acquisitionPresets", "publicExperience"]) {
  Object.defineProperty(exported, property, {
    enumerable: true,
    configurable: false,
    get() {
      return getIndustryProfile()[property];
    },
  });
}

// Preserve the deployment-level CTA behaviour for dedicated single-industry
// deployments. Runtime-selected sessions still get a profile-aware default in
// server publicConfig().
const configuredSalesCtaLabel = String(process.env.SALES_CTA_LABEL || "").trim();
if (defaultIndustryKey !== "clinic" && configuredSalesCtaLabel === "Set up my clinic") {
  process.env.SALES_CTA_LABEL = getIndustryProfile(defaultIndustryKey).salesCtaDefault;
}

module.exports = exported;
