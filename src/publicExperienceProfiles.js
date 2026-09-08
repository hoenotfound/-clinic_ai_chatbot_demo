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
    metaDescription: "Try DA Smarketing's live AI renovation chatbot demo across WhatsApp, Instagram and Messenger, from site details and cabinet requirements to project qualification and human takeover.",
    badge: "LIVE AI RENOVATION SALES DEMO",
    hero: {
      headlinePrefix: "Turn every renovation enquiry into a ",
      headlineAccent: "qualified project lead.",
      copy: "Try the same journey a renovation customer would experience, then open the Sales Dashboard to see how the AI turns site details, cabinet requirements, budget and intent into useful sales context for your team.",
      footnotes: ["Fictional sample renovation company", "No real customer data"],
      shortBusinessName: "Oakline Demo Renovation",
      assistantStatus: "AI sales assistant online",
      messages: [
        "Hi, I want to ask about cabinets.",
        "☀️Pls let us know :  Site photo · Rough size · Location  Thanks 👍",
        "Site photo available · Rough size 12ft · Puchong",
      ],
      intentLabel: "PROJECT DETAILS CAPTURED",
      leadSummary: "Kitchen Cabinets · 12ft · Puchong",
    },
    section: {
      title: "Try it as a customer. See what your renovation team gets.",
      copy: "Start with the site details a real cabinet enquiry needs, then switch to the Sales Dashboard to see project scope, area, budget, site-measurement intent and handoff signals your team receives.",
    },
    view: {
      customerTab: "Customer View",
      dashboardTab: "Sales Dashboard",
      dashboardHint: "See the same project lead from your team side",
    },
    tour: {
      startStatus: "Start a renovation enquiry",
      firstHint: "Send Hi to begin with site details",
      intentTitle: "Build the project context",
      intentHint: "Add size, location, cabinet type and site conditions",
      dashboardTitle: "Open Sales Dashboard",
      staffHint: "Continue as renovation staff",
      afterQuestion: "Now share the rough size and location",
      intentDetected: "Project context captured — open Sales Dashboard",
    },
    chat: {
      businessName: "Oakline Demo Renovation",
      emptyText: "Start the conversation as if you were a homeowner asking about cabinets or renovation work.",
      emptyBadge: "Interactive fictional renovation company",
      privacy: "Demo only — please don’t enter real customer information, addresses or sensitive personal data.",
      suggestionHeading: "Start a sample enquiry",
    },
    suggestions: [
      { kind: "Start", label: "Start renovation enquiry", message: "Hi, I want to ask about cabinets." },
      { kind: "Chinese", label: "中文咨询", message: "你好，我想问一下做柜子。" },
      { kind: "BM", label: "Tanya pasal cabinet", message: "Hi, saya nak tanya pasal cabinet." },
      { kind: "Handoff", label: "Speak to a designer", message: "Can I speak to a human designer?" },
    ],
    capture: {
      rows: [["Project", "Kitchen Cabinets"], ["Area", "Puchong"], ["Size", "12ft"], ["Intent", "Site measurement"]],
      note: "Switch to Sales Dashboard to see these project signals update with the conversation.",
    },
    workflow: [
      ["Site details", "Site photo if available, rough size and location"],
      ["Cabinet requirement", "Kitchen, wardrobe, TV, shoe or another cabinet type"],
      ["Practical guidance", "Wall space, switches/plugs, plumbing, obstructions and material direction"],
      ["Human takeover", "Designer or sales staff continues with the same context"],
    ],
    capabilities: [
      ["Start from useful site information.", "Collect rough size and location first, with a site photo when available, before asking the customer to repeat unnecessary details.", ["English, BM and Chinese", "Site-first qualification"]],
      ["Understand what can affect the cabinet layout.", "Build context around the actual cabinet type and practical site constraints before moving toward a quotation.", ["Wall space and obstructions", "Switches, plugs and water points"]],
      ["Hand high-intent enquiries to your team.", "Site measurements, detailed quotations and technical questions can move to staff with the known project context attached.", ["Site-measurement / quotation signals", "Human handoff with full context"]],
    ],
    sales: {
      kicker: "AI AUTOMATION FOR RENOVATION BUSINESSES",
      headingPrefix: "Ready to build your ",
      headingAccent: "AI sales assistant",
      copy: "We’ll customise the AI around your cabinet services, starting prices, service areas, site-detail questions, quotation flow and human handoff process.",
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
