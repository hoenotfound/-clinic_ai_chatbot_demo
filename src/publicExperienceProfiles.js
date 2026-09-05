const profiles = {
  clinic: {
    title: "AI Clinic Receptionist Demo | DA Smarketing",
    metaDescription: "Try DA Smarketing's live AI clinic receptionist demo across WhatsApp, Instagram and Messenger, from first enquiry to lead qualification and human takeover.",
    badge: "LIVE AI RECEPTIONIST DEMO",
    hero: {
      headlinePrefix: "Turn every clinic enquiry into a ",
      headlineAccent: "qualified lead.",
      copy: "Try the same journey your customer would experience, then open the Clinic Dashboard to see how the AI turns the conversation into clear sales context for your team.",
      footnotes: ["Fictional sample clinic", "No real patient data"],
      shortBusinessName: "Nova Demo Clinic",
      assistantStatus: "AI receptionist online",
      messages: [
        "Hi, how much is HIFU?",
        "Our HIFU treatment starts from RM888. Are you looking at face lifting or jawline definition?",
        "Jawline. Can I come Saturday in KL?",
      ],
      intentLabel: "BOOKING INTENT DETECTED",
      leadSummary: "Hot lead · HIFU · KL · Saturday",
    },
    section: {
      title: "Try it as a patient. See what your clinic gets.",
      copy: "Start with a real enquiry, then switch to the Clinic Dashboard to see the lead details, intent signals and conversation context your team receives.",
    },
    view: {
      customerTab: "Patient View",
      dashboardTab: "Clinic Dashboard",
      dashboardHint: "See the same lead from staff side",
    },
    tour: {
      startStatus: "Start with a patient question",
      firstHint: "Try a price or treatment enquiry",
      intentTitle: "Show booking intent",
      intentHint: "Ask for a day or branch",
      dashboardTitle: "Open Clinic Dashboard",
      staffHint: "Continue as clinic staff",
      afterQuestion: "Now try “Can I come Saturday?”",
      intentDetected: "Booking intent detected — open Clinic Dashboard",
    },
    chat: {
      businessName: "Nova Demo Aesthetic Clinic",
      emptyText: "Start the conversation as if you were a patient messaging the clinic.",
      emptyBadge: "Interactive fictional sample clinic",
      privacy: "Demo only — please don’t enter real patient information or sensitive personal data.",
      suggestionHeading: "Use a sample enquiry",
    },
    suggestions: [
      { kind: "Price", label: "How much is HIFU?", message: "Hi, how much is HIFU?" },
      { kind: "Treatment", label: "I have pigmentation", message: "I have pigmentation and acne marks. What would you recommend?" },
      { kind: "Booking", label: "Can I come Saturday?", message: "I'm interested in HIFU. Can I come this Saturday in KL?" },
      { kind: "Handoff", label: "Speak to a human", message: "Can I speak to a human consultant?" },
    ],
    capture: {
      rows: [["Treatment", "HIFU"], ["Branch", "KL"], ["Timing", "Saturday"], ["Intent", "Booking"]],
      note: "Switch to Clinic Dashboard to see these signals update with the conversation.",
    },
    workflow: [
      ["Patient enquiry", "WhatsApp, Instagram or Messenger"],
      ["AI conversation", "Answers with your clinic knowledge and rules"],
      ["Qualified lead", "Treatment, branch, timing and booking intent"],
      ["Human takeover", "Staff continues with the same context"],
    ],
    capabilities: [
      ["Answer with your clinic knowledge.", "Treatments, prices, promotions and FAQs — using your clinic’s own rules.", ["Multilingual conversations", "Consistent clinic SOP"]],
      ["Know which enquiry needs attention.", "Turn each conversation into clear sales context and intent signals.", ["Temperature and booking intent", "Conversation summary"]],
      ["Let staff step in at the right moment.", "Take over when a conversation becomes sensitive, complex or high intent.", ["Takeover with full context", "Attention alerts"]],
    ],
    sales: {
      kicker: "AI AUTOMATION FOR YOUR CLINIC",
      headingPrefix: "Ready to build your ",
      headingAccent: "AI front desk",
      copy: "We’ll customise the AI around your treatments, pricing, branches, FAQs, lead rules and human handoff workflow.",
      trust: ["WhatsApp · Instagram · Messenger", "Clinic-specific knowledge", "Human handoff + lead tracking"],
      footer: "Talk directly with DA Smarketing about your clinic workflow.",
    },
    acquisitionHelper: "This source follows the live visitor into the Clinic Dashboard.",
  },

  renovation: {
    title: "AI Renovation Chatbot Demo | DA Smarketing",
    metaDescription: "Try DA Smarketing's live AI renovation and carpentry chatbot demo across WhatsApp, Instagram and Messenger, from first enquiry to project qualification and human takeover.",
    badge: "LIVE AI RENOVATION SALES DEMO",
    hero: {
      headlinePrefix: "Turn every renovation enquiry into a ",
      headlineAccent: "qualified project lead.",
      copy: "Try the same journey a renovation customer would experience, then open the Sales Dashboard to see how the AI turns the chat into project scope, budget, area, timeline and buying intent for your team.",
      footnotes: ["Fictional sample renovation company", "No real customer data"],
      shortBusinessName: "Oakline Demo Renovation",
      assistantStatus: "AI sales assistant online",
      messages: [
        "Hi, kitchen cabinet how much?",
        "Kitchen cabinets start from RM6,800 for a compact sample package. Is this for a condo or landed house?",
        "New condo in Puchong, around 12ft. Can your team measure Saturday?",
      ],
      intentLabel: "SITE MEASUREMENT INTENT",
      leadSummary: "Hot lead · Kitchen Cabinets · Puchong · Saturday",
    },
    section: {
      title: "Try it as a customer. See what your renovation team gets.",
      copy: "Start with a real renovation enquiry, then switch to the Sales Dashboard to see project scope, budget, area, timeline and handoff signals your team receives.",
    },
    view: {
      customerTab: "Customer View",
      dashboardTab: "Sales Dashboard",
      dashboardHint: "See the same project lead from your team side",
    },
    tour: {
      startStatus: "Start with a renovation question",
      firstHint: "Try a price or carpentry enquiry",
      intentTitle: "Show site-measurement intent",
      intentHint: "Ask for site measurement or a quotation",
      dashboardTitle: "Open Sales Dashboard",
      staffHint: "Continue as renovation staff",
      afterQuestion: "Now try asking for a site measurement",
      intentDetected: "High intent detected — open Sales Dashboard",
    },
    chat: {
      businessName: "Oakline Demo Renovation & Carpentry",
      emptyText: "Start the conversation as if you were a homeowner messaging a renovation company.",
      emptyBadge: "Interactive fictional renovation company",
      privacy: "Demo only — please don’t enter real customer information, addresses or sensitive personal data.",
      suggestionHeading: "Use a sample renovation enquiry",
    },
    suggestions: [
      { kind: "Price", label: "Kitchen cabinet price?", message: "Hi, kitchen cabinet how much?" },
      { kind: "Project", label: "I need kitchen + wardrobe", message: "New condo in Cheras. I need kitchen cabinet and wardrobe, budget around RM20k." },
      { kind: "Site visit", label: "Can you measure Saturday?", message: "I am in Puchong. Can your team come for site measurement this Saturday?" },
      { kind: "Handoff", label: "Speak to a designer", message: "Can I speak to a human designer?" },
    ],
    capture: {
      rows: [["Project", "Kitchen Cabinets"], ["Area", "Puchong"], ["Budget", "RM10k"], ["Intent", "Site measurement"]],
      note: "Switch to Sales Dashboard to see these project signals update with the conversation.",
    },
    workflow: [
      ["Customer enquiry", "WhatsApp, Instagram or Messenger"],
      ["AI sales conversation", "Answers with your services, price guides and qualification rules"],
      ["Qualified project lead", "Project, property, area, budget, timeline and intent"],
      ["Human takeover", "Designer or sales staff continues with the same context"],
    ],
    capabilities: [
      ["Answer with your renovation knowledge.", "Services, starting prices, materials, service areas and FAQs — using your business rules.", ["English, BM and Chinese", "Consistent renovation sales process"]],
      ["Qualify the project while chatting.", "Turn each enquiry into usable project context instead of leaving staff with a raw chat transcript.", ["Project scope, property and area", "Budget, timeline and intent"]],
      ["Hand high-intent enquiries to your team.", "Site measurements, detailed quotations and technical questions can move to staff with the known project context attached.", ["Site-measurement / quotation signals", "Human handoff with full context"]],
    ],
    sales: {
      kicker: "AI AUTOMATION FOR RENOVATION BUSINESSES",
      headingPrefix: "Ready to build your ",
      headingAccent: "AI sales assistant",
      copy: "We’ll customise the AI around your carpentry services, starting prices, service areas, qualification questions, quotation flow and human handoff process.",
      trust: ["WhatsApp · Instagram · Messenger", "Renovation-specific knowledge", "Project qualification + lead tracking"],
      footer: "Talk directly with DA Smarketing about your renovation sales workflow.",
    },
    acquisitionHelper: "This source follows the live visitor into the Sales Dashboard.",
  },
};

function publicExperienceFor(key) {
  return profiles[key] || profiles.clinic;
}

module.exports = { publicExperienceFor };
