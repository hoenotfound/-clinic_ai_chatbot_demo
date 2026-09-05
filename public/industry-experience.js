(() => {
  const RENOVATION_NAME = "Oakline Demo Renovation & Carpentry";

  const textReplacements = [
    ["LIVE AI RECEPTIONIST DEMO", "LIVE AI RENOVATION SALES DEMO"],
    ["Turn every clinic enquiry into a ", "Turn every renovation enquiry into a "],
    ["Try the same journey your customer would experience, then open the Clinic Dashboard to see how the AI turns the conversation into clear sales context for your team.", "Try the same journey a renovation customer would experience, then open the Sales Dashboard to see how the AI turns the chat into project scope, budget, area, timeline and buying intent for your team."],
    ["Fictional sample clinic", "Fictional sample renovation company"],
    ["No real patient data", "No real customer data"],
    ["Nova Demo Aesthetic Clinic", RENOVATION_NAME],
    ["Nova Demo Clinic", "Oakline Demo Renovation"],
    ["AI receptionist online", "AI sales assistant online"],
    ["Hi, how much is HIFU?", "Hi, kitchen cabinet how much?"],
    ["Our HIFU treatment starts from RM888. Are you looking at face lifting or jawline definition?", "Kitchen cabinets start from RM6,800 for a compact sample package. Is this for a condo or landed house?"],
    ["Jawline. Can I come Saturday in KL?", "New condo in Puchong, around 12ft. Can come measure Saturday?"],
    ["BOOKING INTENT DETECTED", "SITE MEASUREMENT INTENT"],
    ["Hot lead · HIFU · KL · Saturday", "Hot lead · Kitchen · Puchong · Saturday"],
    ["Try it as a patient. See what your clinic gets.", "Try it as a customer. See what your renovation team gets."],
    ["Start with a real enquiry, then switch to the Clinic Dashboard to see the lead details, intent signals and conversation context your team receives.", "Start with a real renovation enquiry, then switch to the Sales Dashboard to see the project details, budget signals and conversation context your team receives."],
    ["Patient View", "Customer View"],
    ["Clinic Dashboard", "Sales Dashboard"],
    ["See the same lead from staff side", "See the same lead from your team side"],
    ["Start with a patient question", "Start with a renovation question"],
    ["Try a price or treatment enquiry", "Try a price or carpentry enquiry"],
    ["Show booking intent", "Show site-measurement intent"],
    ["Ask for a day or branch", "Ask for site measurement or quotation"],
    ["Open Clinic Dashboard", "Open Sales Dashboard"],
    ["Continue as clinic staff", "Continue as renovation staff"],
    ["Start the conversation as if you were a patient messaging the clinic.", "Start the conversation as if you were a homeowner messaging a renovation company."],
    ["Interactive fictional sample clinic", "Interactive fictional renovation company"],
    ["Demo only — please don’t enter real patient information or sensitive personal data.", "Demo only — please don’t enter real customer information, addresses or sensitive personal data."],
    ["Use a sample enquiry", "Use a sample renovation enquiry"],
    ["How much is HIFU?", "Kitchen cabinet price?"],
    ["I have pigmentation", "I need a wardrobe"],
    ["Can I come Saturday?", "Can you measure Saturday?"],
    ["Speak to a human", "Speak to a designer"],
    ["Treatment", "Project"],
    ["Branch", "Area"],
    ["Timing", "Timeline"],
    ["Booking", "Site visit"],
    ["HIFU", "Kitchen Cabinets"],
    ["KL", "Puchong"],
    ["Switch to Clinic Dashboard to see these signals update with the conversation.", "Switch to Sales Dashboard to see these project signals update with the conversation."],
    ["Patient enquiry", "Customer enquiry"],
    ["Answers with your clinic knowledge and rules", "Answers with your renovation services, pricing rules and sales process"],
    ["Clinic staff", "Renovation staff"],
    ["clinic staff", "renovation staff"],
    ["patient", "customer"],
    ["Patient", "Customer"],
    ["clinic", "renovation company"],
    ["Clinic", "Renovation Company"],
    ["Booking intent detected", "Site-measurement intent detected"],
  ];

  function replaceText(value) {
    let next = String(value || "");
    for (const [from, to] of textReplacements) next = next.split(from).join(to);
    return next;
  }

  function adaptText(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const next = replaceText(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
    }
    root.querySelectorAll?.("[aria-label], [title], input[placeholder], textarea[placeholder]").forEach((element) => {
      for (const attr of ["aria-label", "title", "placeholder"]) {
        const value = element.getAttribute(attr);
        if (!value) continue;
        const next = replaceText(value);
        if (next !== value) element.setAttribute(attr, next);
      }
    });
  }

  function configureSuggestions() {
    const chips = [...document.querySelectorAll(".suggestion-chip")];
    const suggestions = [
      { message: "Hi, kitchen cabinet how much?", label: "Kitchen cabinet price?", kind: "Price" },
      { message: "New condo in Cheras. I need kitchen cabinet and wardrobe, budget around RM20k.", label: "I need kitchen + wardrobe", kind: "Project" },
      { message: "I am in Puchong. Can your team come for site measurement this Saturday?", label: "Can you measure Saturday?", kind: "Site visit" },
      { message: "Can I speak to a human designer?", label: "Speak to a designer", kind: "Handoff" },
    ];
    chips.forEach((chip, index) => {
      const item = suggestions[index];
      if (!item) return;
      chip.dataset.message = item.message;
      const kind = chip.querySelector("span");
      const strong = chip.querySelector("strong");
      if (kind) kind.textContent = item.kind;
      if (strong) strong.textContent = item.label;
    });
  }

  function configureCapturePreview() {
    const values = document.querySelectorAll(".capture-preview-grid span");
    const rows = [
      ["Project", "Kitchen Cabinets"],
      ["Area", "Puchong"],
      ["Budget", "RM10k"],
      ["Intent", "Site measurement"],
    ];
    values.forEach((element, index) => {
      const row = rows[index];
      if (!row) return;
      const small = element.querySelector("small");
      const strong = element.querySelector("strong");
      if (small) small.textContent = row[0];
      if (strong) strong.textContent = row[1];
    });
  }

  function configureBranding() {
    document.title = "AI Renovation Chatbot Demo | DA Smarketing";
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = "Try DA Smarketing's live AI renovation and carpentry chatbot demo across WhatsApp, Instagram and Messenger, from first enquiry to quotation qualification and human takeover.";
    document.querySelectorAll(".clinic-avatar, .empty-logo, .hero-product-avatar").forEach((element) => { element.textContent = "O"; });
    configureSuggestions();
    configureCapturePreview();
    adaptText(document.body);
  }

  async function init() {
    try {
      const response = await fetch("/api/demo/config", { headers: { Accept: "application/json" } });
      if (!response.ok) return;
      const config = await response.json();
      if (!/Oakline Demo Renovation/i.test(String(config.clinicName || ""))) return;
      document.documentElement.dataset.demoIndustry = "renovation";
      configureBranding();
      const observer = new MutationObserver(() => {
        adaptText(document.body);
        configureSuggestions();
        configureCapturePreview();
      });
      observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["aria-label", "title", "placeholder"] });
    } catch {}
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
