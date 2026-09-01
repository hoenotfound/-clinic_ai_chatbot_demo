import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Layout from "./components/Layout";
import Inbox from "./pages/Inbox";
import Contacts from "./pages/Contacts";
import Pipeline from "./pages/Pipeline";
import Analytics from "./pages/Analytics";
import Tools from "./pages/Tools";
import Settings from "./pages/Settings";
import TeamAccess from "./pages/TeamAccess";
import { getDashboardBasePath } from "./basePath";

function Page({ children }) {
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <BrowserRouter basename={getDashboardBasePath()}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/inbox" replace />} />
          <Route path="/login" element={<Navigate to="/inbox" replace />} />
          <Route path="/inbox" element={<Page><Inbox /></Page>} />
          <Route path="/contacts" element={<Page><Contacts /></Page>} />
          <Route path="/pipeline" element={<Page><Pipeline /></Page>} />
          <Route path="/analytics" element={<Page><Analytics /></Page>} />
          <Route path="/tools" element={<Page><Tools /></Page>} />
          <Route path="/settings" element={<Page><Settings /></Page>} />
          <Route path="/settings/team" element={<Page><TeamAccess /></Page>} />
          <Route path="*" element={<Navigate to="/inbox" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
