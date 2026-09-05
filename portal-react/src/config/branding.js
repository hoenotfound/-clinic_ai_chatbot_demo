import { withAppBase } from "../basePath";
import { isRenovationDemo } from "./demoIndustry";

export const branding = isRenovationDemo
  ? {
      clientName: "Oakline Demo Renovation",
      clientLogo: withAppBase("/dashboard/oakline-demo-logo.svg"),
      loginTagline: "Interactive renovation AI sales demo",
      agencyName: "AI Renovation Demo",
      agencyLogo: withAppBase("/dashboard/oakline-demo-logo.svg"),
    }
  : {
      clientName: "Nova Demo Clinic",
      clientLogo: withAppBase("/dashboard/nova-demo-logo.svg"),
      loginTagline: "Interactive clinic AI sales demo",
      agencyName: "AI Clinic Demo",
      agencyLogo: withAppBase("/dashboard/nova-demo-logo.svg"),
    };
