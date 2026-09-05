import * as clinic from "./clinicDemoData";
import * as renovation from "./renovationDemoData";
import { isRenovationDemo } from "./config/demoIndustry";

const active = isRenovationDemo ? renovation : clinic;

export const STAGES = active.STAGES;
export const SAMPLE_LEADS = active.SAMPLE_LEADS;
export const ANALYTICS = active.ANALYTICS;
export const portalMessages = active.portalMessages;
