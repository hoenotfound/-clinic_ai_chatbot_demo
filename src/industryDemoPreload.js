const selectedIndustry = String(process.env.DEMO_INDUSTRY || "clinic").trim().toLowerCase();
const isRenovation = ["renovation", "home-renovation", "carpentry"].includes(selectedIndustry);

// Transitional compatibility only.
//
// AI behaviour and lead/session behaviour are now selected directly through
// src/industryProfile.js. This preload no longer monkey-patches prompts, rules,
// fallbacks or demoState. It only keeps the legacy server/public shell, which
// still imports clinicConfig directly, pointed at the active renovation business
// until that static shell is converted to the same explicit profile API.
if (isRenovation) {
  const clinicConfig = require("./clinicConfig");
  const renovationConfig = require("./renovationConfig");
  for (const key of Object.keys(clinicConfig)) delete clinicConfig[key];
  Object.assign(clinicConfig, renovationConfig);

  if (!process.env.SALES_CTA_LABEL || process.env.SALES_CTA_LABEL === "Set up my clinic") {
    process.env.SALES_CTA_LABEL = "Set up my renovation chatbot";
  }
}
