import React, { createContext, useContext, useState, useCallback, useMemo } from "react";

interface PageActions {
  hasSaved: boolean;
  hasHistory: boolean;
  featureKey: string | null;
  featureLabel: string | null;
  onOpenSaved?: () => void;
  onOpenHistory?: () => void;
}

interface PageActionsContextType {
  actions: PageActions;
  registerActions: (actions: Partial<PageActions>) => void;
  clearActions: () => void;
}

const defaultActions: PageActions = {
  hasSaved: false,
  hasHistory: false,
  featureKey: null,
  featureLabel: null,
};

const PageActionsContext = createContext<PageActionsContextType>({
  actions: defaultActions,
  registerActions: () => {},
  clearActions: () => {},
});

export const usePageActions = () => useContext(PageActionsContext);

export const PageActionsProvider = ({ children }: { children: React.ReactNode }) => {
  const [actions, setActions] = useState<PageActions>(defaultActions);

  const registerActions = useCallback((newActions: Partial<PageActions>) => {
    setActions((prev) => ({ ...prev, ...newActions }));
  }, []);

  const clearActions = useCallback(() => {
    setActions(defaultActions);
  }, []);

  const value = useMemo(() => ({ actions, registerActions, clearActions }), [actions, registerActions, clearActions]);

  return (
    <PageActionsContext.Provider value={value}>
      {children}
    </PageActionsContext.Provider>
  );
};
