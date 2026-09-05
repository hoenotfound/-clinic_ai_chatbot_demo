import { useEffect } from "react";
import { isRenovationDemo } from "../config/demoIndustry";

const TEXT_REPLACEMENTS = [
  ["Demo Patient", "Demo Customer"],
  ["Patient requested staff assistance.", "Customer requested staff assistance."],
  ["Send a message from Patient View.", "Send a message from Customer View."],
  ["Take over to reply as clinic staff.", "Take over to reply as renovation staff."],
  ["Clinic staff", "Renovation staff"],
  ["clinic staff", "renovation staff"],
  ["Treatment not selected", "Project not selected"],
  ["Treatment", "Project"],
  ["Treatments", "Projects"],
  ["treatments", "projects"],
  ["Branch", "Area"],
  ["All branches", "All areas"],
  ["Appointment Requested", "Site Measurement Requested"],
  ["Appointment Confirmed", "Site Measurement Confirmed"],
  ["Appointments", "Site Measurements"],
  ["Appointment rate", "Measurement rate"],
  ["First appointment stage entered", "First site-measurement stage entered"],
  ["Clinic Visits", "Quotations / Design"],
  ["First visit stage entered", "Quotation / design stage entered"],
  ["Lead → appointment", "Lead → measurement"],
  ["Appointment → visit", "Measurement → quotation"],
  ["Visit → won", "Quotation → won"],
  ["Demo Clinic Campaign", "Demo Renovation Campaign"],
  ["AI receptionist", "AI sales assistant"],
  ["Reply to patient…", "Reply to customer…"],
];

function replaceText(value) {
  let next = value;
  for (const [from, to] of TEXT_REPLACEMENTS) next = next.split(from).join(to);
  return next;
}

function adaptNode(root) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const next = replaceText(node.nodeValue || "");
    if (next !== node.nodeValue) node.nodeValue = next;
  }

  root.querySelectorAll?.("input[placeholder], textarea[placeholder], [aria-label], [title]").forEach((element) => {
    for (const attribute of ["placeholder", "aria-label", "title"]) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      const next = replaceText(value);
      if (next !== value) element.setAttribute(attribute, next);
    }
  });
}

export default function IndustryLanguageAdapter() {
  useEffect(() => {
    if (!isRenovationDemo) return undefined;
    const root = document.getElementById("root");
    if (!root) return undefined;
    adaptNode(root);
    const observer = new MutationObserver(() => adaptNode(root));
    observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["placeholder", "aria-label", "title"] });
    return () => observer.disconnect();
  }, []);

  return null;
}
