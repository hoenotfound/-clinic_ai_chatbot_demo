import { createContext, useContext, useEffect, useMemo } from "react";

const AuthContext = createContext(null);
const permissions = {
  view_assigned_leads: true,
  view_all_leads: true,
  reply_to_assigned_leads: true,
  manage_assigned_leads: true,
  view_analytics: true,
  manage_tools: true,
  manage_settings: true,
  manage_users: true,
};
const user = { username: "demo", displayName: "Demo Admin", role: "admin", permissions };

export function AuthProvider({ children }) {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.canReplyLeads = "true";
    root.dataset.canManageLeads = "true";
    return () => {
      delete root.dataset.canReplyLeads;
      delete root.dataset.canManageLeads;
    };
  }, []);

  const value = useMemo(() => ({
    user,
    username: user.username,
    permissions,
    can: (capability) => permissions[capability] === true,
    login: async () => true,
    logout: async () => {},
    refreshUser: async () => user,
    error: null,
    loading: false,
  }), []);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
