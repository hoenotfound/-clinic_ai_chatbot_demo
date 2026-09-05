const normalized = String(typeof __DEMO_INDUSTRY__ !== "undefined" ? __DEMO_INDUSTRY__ : "clinic")
  .trim()
  .toLowerCase();

export const demoIndustry = ["renovation", "home-renovation", "carpentry"].includes(normalized)
  ? "renovation"
  : "clinic";

export const isRenovationDemo = demoIndustry === "renovation";

export const demoTerms = isRenovationDemo
  ? {
      customer: "Customer",
      customerLower: "customer",
      business: "Oakline Demo Renovation",
      staff: "Renovation staff",
      service: "Project",
      servicePlural: "Projects",
      location: "Area",
      timing: "Timeline",
      appointment: "Site measurement",
    }
  : {
      customer: "Patient",
      customerLower: "patient",
      business: "Nova Demo Clinic",
      staff: "Clinic staff",
      service: "Treatment",
      servicePlural: "Treatments",
      location: "Branch",
      timing: "Timing",
      appointment: "Appointment",
    };
