import { withAppBase } from "../basePath";
import { industryProfile } from "./industryProfile";

const isRenovation = industryProfile.key === "renovation";

export const branding = {
  clientName: industryProfile.shortBusinessName,
  clientLogo: withAppBase(isRenovation ? "/dashboard/oakline-demo-logo.svg" : "/dashboard/nova-demo-logo.svg"),
  loginTagline: isRenovation ? "Interactive renovation AI sales demo" : "Interactive clinic AI sales demo",
  agencyName: isRenovation ? "AI Renovation Demo" : "AI Clinic Demo",
  agencyLogo: withAppBase(isRenovation ? "/dashboard/oakline-demo-logo.svg" : "/dashboard/nova-demo-logo.svg"),
};
