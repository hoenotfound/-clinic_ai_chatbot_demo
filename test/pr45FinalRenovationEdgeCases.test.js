const test = require("node:test");
const assert = require("node:assert/strict");

const { updateRenovationLead } = require("../src/renovationLeadState");
const { buildFallbackReply } = require("../src/renovationFallback");
const { correctionTargetText, isGenuineRejection } = require("../src/renovationConversationIntent");

test("design-detail and appointment changes are not treated as full renovation rejection", () => {
  assert.equal(isGenuineRejection("I don't want handles, can do handleless kitchen cabinet?"), false);
  assert.equal(isGenuineRejection("I don't want glossy finish, I prefer matte"), false);
  assert.equal(isGenuineRejection("Cancel Saturday site measurement and reschedule"), false);
  assert.equal(isGenuineRejection("I'm not interested in glossy finish, I prefer matte"), false);
  assert.equal(isGenuineRejection("No thanks on handles, make it handleless"), false);
  assert.equal(isGenuineRejection("Never mind Saturday, Sunday works"), false);
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
      { role: "user", content: "I'm not interested in glossy finish, I prefer matte" },
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
      { role: "user", content: "Never mind Saturday, Sunday works" },
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

test("natural change, switch-from and short cancel wording replace the old service", () => {
  for (const correction of [
    "change kitchen cabinet to wardrobe",
    "switch from kitchen cabinet to wardrobe",
    "cancel kitchen cabinet, want wardrobe",
  ]) {
    const session = {
      messages: [
        { role: "user", content: "Kitchen cabinet in Puchong condo, budget RM15k" },
        { role: "assistant", content: "Noted." },
        { role: "user", content: correction },
      ],
      lead: { interests: [] },
    };

    updateRenovationLead(session);
    assert.deepEqual(session.lead.interests, ["Built-in Wardrobes"], correction);
    assert.equal(session.lead.reducedInterest, false, correction);
    assert.match(buildFallbackReply(session.messages), /wardrobe/i, correction);
  }
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

test("a renewed enquiry after a genuine decline starts with fresh project facts", () => {
  const session = {
    messages: [
      { role: "user", content: "Kitchen cabinet in Puchong condo, 12ft, budget RM15k, weekend" },
      { role: "assistant", content: "Noted." },
      { role: "user", content: "Not interested anymore" },
      { role: "assistant", content: "No problem, message us again if you need anything." },
      { role: "user", content: "I want wardrobe" },
    ],
    lead: {
      interests: ["Kitchen Cabinets"],
      preferredBranch: "Cheras / Kajang / Puchong",
      propertyType: "Condo / apartment",
      budget: "RM15,000",
      measurementsKnown: true,
      measurementsByService: { "Kitchen Cabinets": true },
      preferredTiming: "Weekend",
      timelineMentioned: true,
    },
  };

  updateRenovationLead(session);
  assert.deepEqual(session.lead.interests, ["Built-in Wardrobes"]);
  assert.equal(session.lead.reducedInterest, false);
  assert.equal(session.lead.preferredBranch, null);
  assert.equal(session.lead.propertyType, null);
  assert.equal(session.lead.budget, null);
  assert.equal(session.lead.measurementsKnown, false);
  assert.equal(session.lead.measurementsByService["Built-in Wardrobes"], false);
  assert.equal(session.lead.preferredTiming, null);
  assert.equal(session.lead.timelineMentioned, false);

  const reply = buildFallbackReply(session.messages);
  assert.match(reply, /condo|landed|commercial/i);
  assert.doesNotMatch(reply, /Puchong|RM15,000|12ft/i);
});

test("multi-scope measurement tracking asks for the still-unmeasured service", () => {
  const session = {
    messages: [
      { role: "user", content: "Kitchen cabinet in Puchong condo, budget RM18k" },
      { role: "assistant", content: "Noted." },
      { role: "user", content: "I don't want kitchen cabinet. I want a 9ft wardrobe and shoe cabinet." },
    ],
    lead: { interests: [] },
  };

  updateRenovationLead(session);
  assert.deepEqual(
    session.lead.interests.sort(),
    ["Built-in Wardrobes", "Shoe Cabinet & Entrance Storage"].sort()
  );
  assert.equal(session.lead.measurementsByService["Built-in Wardrobes"], true);
  assert.equal(session.lead.measurementsByService["Shoe Cabinet & Entrance Storage"], false);
  assert.equal(session.lead.measurementsKnown, false);

  const reply = buildFallbackReply(session.messages);
  assert.match(reply, /rough measurements.*Shoe Cabinet|floor plan.*Shoe Cabinet/i);

  session.messages.push({ role: "assistant", content: reply });
  session.messages.push({ role: "user", content: "shoe cabinet 4ft" });
  updateRenovationLead(session);
  assert.equal(session.lead.measurementsByService["Built-in Wardrobes"], true);
  assert.equal(session.lead.measurementsByService["Shoe Cabinet & Entrance Storage"], true);
  assert.equal(session.lead.measurementsKnown, true);
});

test("whole-enquiry decline wording wins even when the customer mentions a detail reason", () => {
  assert.equal(isGenuineRejection("I'm not interested anymore, the material is too expensive"), true);
  assert.equal(isGenuineRejection("I don't want to proceed anymore, the glossy finish is too expensive"), true);
  assert.equal(isGenuineRejection("I'm not interested in the material, show me another option"), false);

  const session = {
    messages: [
      { role: "user", content: "Kitchen cabinet in Puchong, budget RM12k" },
      { role: "assistant", content: "Do you have rough measurements?" },
      { role: "user", content: "I'm not interested anymore, the material is too expensive" },
    ],
    lead: { interests: [] },
  };
  updateRenovationLead(session);
  assert.equal(session.lead.reducedInterest, true);
  assert.equal(session.lead.score, 0);
});

test("changed-mind proceed wording renews a previously declined lead without repeating the service", () => {
  const session = {
    messages: [
      { role: "user", content: "Kitchen cabinet in Puchong condo, 12ft, budget RM15k" },
      { role: "assistant", content: "Noted." },
      { role: "user", content: "Not interested anymore" },
      { role: "assistant", content: "No problem, message us again if you need anything." },
      { role: "user", content: "Actually I changed my mind, let's proceed" },
    ],
    lead: {
      interests: ["Kitchen Cabinets"],
      preferredBranch: "Cheras / Kajang / Puchong",
      propertyType: "Condo / apartment",
      budget: "RM15,000",
      measurementsKnown: true,
      measurementsByService: { "Kitchen Cabinets": true },
    },
  };

  updateRenovationLead(session);
  assert.equal(session.lead.reducedInterest, false);
  assert.deepEqual(session.lead.interests, []);
  assert.equal(session.lead.preferredBranch, null);
  assert.equal(session.lead.propertyType, null);
  assert.equal(session.lead.budget, null);
  assert.equal(session.lead.measurementsKnown, false);
  assert.doesNotMatch(buildFallbackReply(session.messages), /leave the renovation enquiry here/i);
});

test("grouped measurements apply to every active service instead of only the nearest service", () => {
  for (const message of [
    "I want wardrobe and shoe cabinet, both 4ft",
    "Both wardrobe and shoe cabinet are 4ft",
  ]) {
    const session = {
      messages: [{ role: "user", content: message }],
      lead: { interests: [] },
    };

    updateRenovationLead(session);
    assert.deepEqual(
      session.lead.interests.sort(),
      ["Built-in Wardrobes", "Shoe Cabinet & Entrance Storage"].sort(),
      message
    );
    assert.equal(session.lead.measurementsByService["Built-in Wardrobes"], true, message);
    assert.equal(session.lead.measurementsByService["Shoe Cabinet & Entrance Storage"], true, message);
    assert.equal(session.lead.measurementsKnown, true, message);
  }
});