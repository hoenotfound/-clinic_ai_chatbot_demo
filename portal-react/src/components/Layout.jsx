import Sidebar from "./Sidebar";
import LiveAcquisitionBar from "./LiveAcquisitionBar";
import IndustryLanguageAdapter from "./IndustryLanguageAdapter";

export default function Layout({ children }) {
  return (
    <div className="relative flex h-[100dvh] overflow-hidden md:h-screen">
      <IndustryLanguageAdapter />
      <Sidebar />
      <main className="flex h-[calc(100dvh-4.5rem)] min-w-0 flex-1 flex-col overflow-hidden md:h-screen">
        <LiveAcquisitionBar />
        <div className="h-full min-h-0 flex-1 overflow-hidden">
          {children}
        </div>
      </main>
    </div>
  );
}
