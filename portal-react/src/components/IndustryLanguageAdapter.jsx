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

const OPTION_REPLACEMENTS = new Map([
  ["HIFU Skin Lifting", ["Kitchen Cabinets", "Kitchen Cabinets"]],
  ["Pico Laser", ["Built-in Wardrobes", "Built-in Wardrobes"]],
  ["Skin Booster", ["Full-Home Custom Carpentry", "Full-Home Carpentry"]],
  ["Botulinum Toxin", ["TV Console & Living Room Carpentry", "Living Room Carpentry"]],
  ["Mira", ["Amir", "Amir"]],
  ["Sarah", ["Mei", "Mei"]],
]);

function replaceText(value) {
  let next = value;
  for (const [from, to] of TEXT_REPLACEMENTS) next = next.split(from).join(to);
  return next;
}

function adaptControls(root) {
  root.querySelectorAll?.("select option").forEach((option) => {
    const replacement = OPTION_REPLACEMENTS.get(option.value);
    if (!replacement) return;
    const [value, label] = replacement;
    if (option.value !== value) option.value = value;
    if (option.textContent !== label) option.textContent = label;
  });
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
  adaptControls(root);
}

export default function IndustryLanguageAdapter() {
  useEffect(() => {
    if (!isRenovationDemo) return undefined;
    const root = document.getElementById("root");
    if (!root) return undefined;
    adaptNode(root);
    let queued = false;
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        adaptNode(root);
      });
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["placeholder", "aria-label", "title", "value"] });
    return () => observer.disconnect();
  }, []);

  return null;
}
