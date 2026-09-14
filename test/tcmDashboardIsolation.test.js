const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function source(file) {
  return fs.readFileSync(path.join(__dirname, "..", file), "utf8");
}

test("TCM pipeline uses TCM campaign and service-derived live value", () => {
  const pipeline = source("portal-react/src/pages/Pipeline.jsx");
  assert.match(pipeline, /isTcmDemo \? "Demo TCM Campaign"/);
  assert.match(pipeline, /isTcmDemo \? Number\(lead\.estimatedValue\) \|\| 0/);
  assert.match(pipeline, /lead\.concern/);
});

test("TCM concern is carried into inbox and lead details", () => {
  const inbox = source("portal-react/src/pages/Inbox.jsx");
  const pipeline = source("portal-react/src/pages/Pipeline.jsx");
  assert.match(inbox, /concern: live\.lead\?\.concern \|\| null/);
  assert.match(inbox, /\["Concern", contact\.lead\.concern\]/);
  assert.match(pipeline, /\["Concern", lead\.concern\]/);
});

test("shared lead card uses active industry terminology", () => {
  const card = source("portal-react/src/components/pipeline/LeadCard.jsx");
  assert.match(card, /industryProfile\.terms\.service/);
  assert.match(card, /industryProfile\.terms\.location/);
  assert.match(card, /industryProfile\.terms\.appointment\.toLowerCase\(\)/);
  assert.doesNotMatch(card, />Treatment<\/LiveField>/);
  assert.doesNotMatch(card, /and appointment messages\./);
});

test("TCM configuration uses neutral greeting and TCM dashboard handoff wording", () => {
  const config = require("../src/tcmConfig");
  assert.equal(config.introMessage, "Jia · Harmony Demo TCM Centre 😊");
  assert.match(config.escalation.handoffNote, /TCM Dashboard/);
  assert.doesNotMatch(config.escalation.handoffNote, /Clinic Dashboard/);
  const herbal = config.services.find((service) => service.name === "Chinese Herbal Medicine Consultation");
  assert.equal(herbal.priceRange, "From RM 50");
  assert.match(herbal.pricingNote, /practitioner/i);
});
