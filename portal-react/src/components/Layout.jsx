import Sidebar from "./Sidebar";

export default function Layout({ children }) {
  return (
    <div className="relative flex h-[100dvh] overflow-hidden md:h-screen">
      <Sidebar />
      <main className="h-[calc(100dvh-4.5rem)] min-w-0 flex-1 overflow-hidden md:h-screen">
        {children}
      </main>
    </div>
  );
}
