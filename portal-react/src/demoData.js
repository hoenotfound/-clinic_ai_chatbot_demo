import * as clinic from "./clinicDemoData";
import * as renovation from "./renovationDemoData";
import { isRenovationDemo } from "./config/demoIndustry";

const active = isRenovationDemo ? renovation : clinic;

function renovationDisplayCopy(value) {
  if (!isRenovationDemo) return value;
  return String(value || "")
    .replace(/full[- ]home custom carpentry/gi, "full-home cabinets")
    .replace(/full[- ]home carpentry/gi, "full-home cabinets")
    .replace(/full[- ]house carpentry/gi, "full-house cabinets")
    .replace(/living[- ]room carpentry/gi, "living-room cabinets")
    .replace(/wet and dry kitchen carpentry/gi, "wet and dry kitchen cabinets")
    .replace(/full carpentry lead/gi, "full-home cabinet lead")
    .replace(/carpentry scope/gi, "cabinet scope")
    .replace(/全屋木工/g, "全屋定制")
    .replace(/客厅木工项目/g, "客厅柜项目")
    .replace(/木工项目/g, "柜子项目")
    .replace(/木工/g, "柜子");
}

function displayLead(lead) {
  if (!isRenovationDemo) return lead;
  return {
    ...lead,
    summary: renovationDisplayCopy(lead.summary),
    messages: (lead.messages || []).map((message) => {
      if (!Array.isArray(message) || message[0] === "user") return message;
      return [message[0], renovationDisplayCopy(message[1]), ...message.slice(2)];
    }),
  };
}

export const STAGES = active.STAGES;
export const SAMPLE_LEADS = active.SAMPLE_LEADS.map(displayLead);
export const ANALYTICS = active.ANALYTICS;
export const portalMessages = active.portalMessages;
