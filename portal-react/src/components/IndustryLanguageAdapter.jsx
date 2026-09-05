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
  ["Treatments", "Projects"],
  ["treatments", "projects"],
  ["Treatment", "Project"],
  ["All branches", "All areas"],
  ["Branch", "Area"],
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
  ["Kuala Lumpur", "KL / Cheras / Kajang"],
  ["Petaling Jaya", "PJ / Subang / Puchong / Shah Alam"],
];

const OPTION_REPLACEMENTS = new Map([
  ["HIFU Skin Lifting", ["Kitchen Cabinets", "Kitchen Cabinets"]],
  ["Pico Laser", ["Built-in Wardrobes", "Built-in Wardrobes"]],
  ["Skin Booster", ["Full-Home Custom Carpentry", "Full-Home Carpentry"]],
  ["Botulinum Toxin", ["TV Console & Living Room Carpentry", "Living Room Carpentry"]],
  ["Mira", ["Amir", "Amir"]],
  ["Sarah", ["Mei", "Mei"]],
]);

const ANALYTICS_SELECT_OPTIONS = {
  Area: [
    ["all", "All areas"],
    ["Kuala Lumpur", "KL / Cheras / Kajang"],
    ["Petaling Jaya", "PJ / Subang / Puchong / Shah Alam"],
  ],
  Campaign: [
    ["all", "All campaigns"],
    ["Demo", "Demo Renovation Campaign"],
  ],
  Project: [
    ["all", "All projects"],
    ["Kitchen Cabinets", "Kitchen Cabinets"],
    ["Built-in Wardrobes", "Built-in Wardrobes"],
    ["TV Console & Living Room Carpentry", "Living Room Carpentry"],
    ["Shoe Cabinet & Entrance Storage", "Shoe / Entrance Storage"],
    ["Study, Display & Storage Cabinets", "Study / Display / Storage"],
    ["Full-Home Custom Carpentry", "Full-Home Carpentry"],
  ],
  Owner: [
    ["all", "All owners"],
    ["Amir", "Amir"],
    ["Mei", "Mei"],
    ["Aina", "Aina"],
    ["Unassigned", "Unassigned"],
  ],
};

function replaceText(value) {
  let next = value;
  for (const [from, to] of TEXT_REPLACEMENTS) next = next.split(from).join(to);
  return next;
}

function shouldPreserveTextNode(node) {
  const parent = node?.parentElement;
  if (!parent) return false;
  if (parent.closest('[data-preserve-industry-copy="true"]')) return true;
  if (parent.matches("p.whitespace-pre-wrap")) return true;
  const inboxConversationButton = parent.closest('aside[aria-label="Conversation inbox"] button');
  if (inboxConversationButton && parent.tagName === "P" && parent.classList.contains("truncate")) return true;
  return false;
}

function analyticsFilterLabel(select) {
  const label = select.closest("label");
  if (!label) return "";
  const heading = label.querySelector("span");
  return String(heading?.textContent || "").trim();
}

function syncSelectOptions(select, options) {
  if (select.dataset.industryFilterListener !== "true") {
    select.addEventListener("change", () => {
      select.dataset.industrySelectedValue = select.value;
    }, true);
    select.dataset.industryFilterListener = "true";
  }

  const selected = select.dataset.industrySelectedValue || select.value || "all";
  const signature = JSON.stringify(options);
  if (select.dataset.industryOptions !== signature) {
    const nodes = options.map(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      return option;
    });
    select.replaceChildren(...nodes);
    select.dataset.industryOptions = signature;
  }

  const validValue = options.some(([value]) => value === selected) ? selected : "all";
  select.value = validValue;
  select.dataset.industrySelectedValue = validValue;
}

function adaptControls(root) {
  root.querySelectorAll?.("select").forEach((select) => {
    const label = analyticsFilterLabel(select);
    const configuredOptions = ANALYTICS_SELECT_OPTIONS[label];
    if (configuredOptions) {
      syncSelectOptions(select, configuredOptions);
      return;
    }

    select.querySelectorAll("option").forEach((option) => {
      const replacement = OPTION_REPLACEMENTS.get(option.value);
      if (!replacement) return;
      const [value, optionLabel] = replacement;
      if (option.value !== value) option.value = value;
      if (option.textContent !== optionLabel) option.textContent = optionLabel;
    });
  });
}

function adaptNode(root) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    if (shouldPreserveTextNode(node)) continue;
    const next = replaceText(node.nodeValue || "");
    if (next !== node.nodeValue) node.nodeValue = next;
  }

  root.querySelectorAll?.("input[placeholder], textarea[placeholder], [aria-label], [title]").forEach((element) => {
    if (element.closest('[data-preserve-industry-copy="true"]')) return;
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