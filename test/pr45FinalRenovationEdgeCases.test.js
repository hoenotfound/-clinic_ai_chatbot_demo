const test = require("node:test");
const assert = require("node:assert/strict");

const { updateRenovationLead } = require("../src/renovationLeadState");
const { buildFallbackReply } = require("../src/renovationFallback");
const { correctionTargetText, isGenuineRejection } = require("../src/renovationConversationIntent");

test("design-detail and appointment changes are not treated as full renovation rejection", () => {
  assert.equal(isGenuineRejection("I don't want handles, can do handleless kitchen cabinet?"), false);
  assert.equal(isGenuineRejection("I don't want glossy finish, I prefer matte"), false);
  assert.equal(isGenuineRejection("Cancel Saturday site measurement and reschedule"), false);
  assert.equal(isGenuineRejection("Not interested anymore, no thanks"), true);

  const detailSession = {
    messages: [
      { role: "user", content: "I want kitchen cabinets" },
      { role: "assistant", content: "Is this for a condo or landed home?" },
      { role: "user", content: "I don't want handles, can do handleless kitchen cabinet?" },
    ],
    lead: { interests: [] },
  };
  updateRenovationLead(detailSession);
  assert.equal(detailSession.lead.reducedInterest, false);
  assert.ok(detailSession.lead.interests.includes("Kitchen Cabinets"));

  const detailReply = buildFallbackReply(detailSession.messages);
  assert.doesNotMatch(detailReply, /leave the renovation enquiry here/i);
  assert.match(detailReply, /Kitchen Cabinets|kitchen cabinet/i);

  const finishSession = {
    messages: [
      { role: "user", content: "I want kitchen cabinets" },
      { role: "assistant", content: "Do you have rough measurements?" },
      { role: "user", content: "I don't want glossy finish, I prefer matte" },
    ],
    lead: { interests: [] },
  };
  updateRenovationLead(finishSession);
  assert.equal(finishSession.lead.reducedInterest, false);
  assert.ok(finishSession.lead.interests.includes("Kitchen Cabinets"));
  assert.doesNotMatch(buildFallbackReply(finishSession.messages), /leave the renovation enquiry here/i);

  const rescheduleSession = {
    messages: [
      { role: "user", content: "I want a site measurement for kitchen cabinets" },
      { role: "assistant", content: "The team can follow up on the measurement arrangement." },
      { role: "user", content: "Cancel Saturday site measurement and reschedule" },
    ],
    lead: { interests: [] },
  };
  updateRenovationLead(rescheduleSession);
  assert.equal(rescheduleSession.lead.reducedInterest, false);
  assert.doesNotMatch(buildFallbackReply(rescheduleSession.messages), /leave the renovation enquiry here/i);
});

test("one correction message can replace an old scope with multiple new configured scopes", () => {
  const session = {
    messages: [
      { role: "user", content: "Kitchen cabinet in Puchong condo, budget RM18k" },
      { role: "assistant", content: "Noted." },
      { role: "user", content: "I don't want kitchen cabinet. I want wardrobe and shoe cabinet." },
    ],
    lead: { interests: [] },
  };

  updateRenovationLead(session);

  assert.equal(session.lead.reducedInterest, false);
  assert.deepEqual(
    session.lead.interests.sort(),
    ["Built-in Wardrobes", "Shoe Cabinet & Entrance Storage"].sort()
  );
  assert.equal(session.lead.interests.includes("Kitchen Cabinets"), false);
  assert.equal(session.lead.preferredBranch, "Cheras / Kajang / Puchong");
  assert.equal(session.lead.propertyType, "Condo / apartment");
  assert.equal(session.lead.budget, "RM18,000");

  assert.equal(correctionTargetText(session.messages.at(-1).content), "wardrobe and shoe cabinet");
  const reply = buildFallbackReply(session.messages);
  assert.match(reply, /wardrobe/i);
  assert.match(reply, /shoe/i);
  assert.doesNotMatch(reply, /Kitchen Cabinets as the project/i);
  assert.doesNotMatch(reply, /leave the renovation enquiry here/i);
});

test("measurements in the rejected part of a correction do not leak into the replacement scope", () => {
  const session = {
    messages: [
      { role: "user", content: "Kitchen cabinet for my Puchong condo, budget RM15k" },
      { role: "assistant", content: "Do you have rough measurements?" },
      { role: "user", content: "I don't want the 12ft kitchen cabinet anymore, I want wardrobe" },
    ],
    lead: { interests: [] },
  };

  updateRenovationLead(session);
  assert.deepEqual(session.lead.interests, ["Built-in Wardrobes"]);
  assert.equal(session.lead.measurementsKnown, false);
  assert.equal(session.lead.budget, "RM15,000");
  assert.equal(session.lead.preferredBranch, "Cheras / Kajang / Puchong");

  const reply = buildFallbackReply(session.messages);
  assert.match(reply, /wardrobe/i);
  assert.match(reply, /rough measurements|floor plan/i);

  const targetMeasurementSession = {
    messages: [
      { role: "user", content: "Kitchen cabinet in Puchong condo, budget RM15k" },
      { role: "assistant", content: "Noted." },
      { role: "user", content: "I don't want the 12ft kitchen cabinet, I want a 9ft wardrobe" },
    ],
    lead: { interests: [] },
  };
  updateRenovationLead(targetMeasurementSession);
  assert.deepEqual(targetMeasurementSession.lead.interests, ["Built-in Wardrobes"]);
  assert.equal(targetMeasurementSession.lead.measurementsKnown, true);
});
