import { useEffect, useState } from "react";
import { industryProfile } from "../config/industryProfile";

const FALLBACK = industryProfile.acquisitionPresets["organic-whatsapp"];

function readAcquisition() {
  try {
    const raw = sessionStorage.getItem("clinicDemoAcquisition");
    if (!raw) return FALLBACK;
    return { ...FALLBACK, ...JSON.parse(raw) };
  } catch {
    return FALLBACK;
  }
}

export default function LiveAcquisitionBar() {
  const [acquisition, setAcquisition] = useState(readAcquisition);

  useEffect(() => {
    const refresh = () => setAcquisition(readAcquisition());
    const timer = setInterval(refresh, 800);
    window.addEventListener("focus", refresh);
    window.addEventListener("message", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("message", refresh);
    };
  }, []);

  return (
    <div className="shrink-0 border-b border-[var(--color-border)] bg-white px-3 py-2 sm:px-5">
      <div className="flex min-w-0 items-center gap-2 overflow-x-auto text-[10px] sm:text-[11px]">
        <span className="shrink-0 rounded-full bg-[var(--color-primary-light)] px-2.5 py-1 font-bold uppercase tracking-wide text-[var(--color-primary)]">Live visitor</span>
        <span className="shrink-0 text-[var(--color-text-muted)]">Source</span>
        <strong className="shrink-0">{acquisition.source}</strong>
        {acquisition.campaign && <><span className="text-[var(--color-border)]">•</span><span className="shrink-0 text-[var(--color-text-muted)]">Campaign</span><strong className="shrink-0">{acquisition.campaign}</strong></>}
        {acquisition.treatment && <><span className="text-[var(--color-border)]">•</span><span className="shrink-0 text-[var(--color-text-muted)]">Ad {industryProfile.terms.service.toLowerCase()}</span><strong className="shrink-0">{acquisition.treatment}</strong></>}
      </div>
    </div>
  );
}
