import { withAppBase } from "../basePath";
import { industryProfile } from "./industryProfile";

const isRenovation = industryProfile.key === "renovation";
const isTcm = industryProfile.key === "tcm";

const logoPath = isRenovation
  ? "/dashboard/oakline-demo-logo.svg"
  : isTcm
    ? "/dashboard/harmony-tcm-demo-logo.svg"
    : "/dashboard/nova-demo-logo.svg";

export const branding = {
  clientName: industryProfile.shortBusinessName,
  clientLogo: withAppBase(logoPath),
  loginTagline: isRenovation
    ? "Interactive renovation AI sales demo"
    : isTcm
      ? "Interactive TCM AI receptionist demo"
      : "Interactive clinic AI sales demo",
  agencyName: isRenovation ? "AI Renovation Demo" : isTcm ? "AI TCM Demo" : "AI Clinic Demo",
  agencyLogo: withAppBase(logoPath),
};
