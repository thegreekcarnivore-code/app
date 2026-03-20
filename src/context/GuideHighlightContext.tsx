import React, { createContext, useContext, useState, useCallback, useMemo } from "react";

interface GuideStep {
  navigate?: string;
  highlight: string;
  label: string;
}

interface GuideHighlightState {
  active: boolean;
  target: string | null;
  label: string | null;
  navigateTo: string | null;
  pendingSteps: GuideStep[];
  currentStep: number;
  totalSteps: number;
}

interface GuideHighlightContextType {
  state: GuideHighlightState;
  showHighlight: (opts: GuideStep | GuideStep[]) => void;
  dismissHighlight: () => void;
  advanceStep: () => void;
}

const GuideHighlightContext = createContext<GuideHighlightContextType | null>(null);

export const useGuideHighlight = () => {
  const ctx = useContext(GuideHighlightContext);
  if (!ctx) {
    // Return a no-op fallback so components don't crash outside the provider (e.g. during HMR)
    return {
      state: { active: false, target: null, label: null, navigateTo: null, pendingSteps: [], currentStep: 0, totalSteps: 0 },
      showHighlight: () => {},
      dismissHighlight: () => {},
      advanceStep: () => {},
    } as GuideHighlightContextType;
  }
  return ctx;
};

export const GuideHighlightProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<GuideHighlightState>({
    active: false,
    target: null,
    label: null,
    navigateTo: null,
    pendingSteps: [],
    currentStep: 0,
    totalSteps: 0,
  });

  const dismissHighlight = useCallback(() => {
    setState({ active: false, target: null, label: null, navigateTo: null, pendingSteps: [], currentStep: 0, totalSteps: 0 });
  }, []);

  const startStep = useCallback((step: GuideStep, remaining: GuideStep[], currentStep: number, totalSteps: number) => {
    setState({
      active: true,
      target: step.highlight,
      label: step.label,
      navigateTo: step.navigate || null,
      pendingSteps: remaining,
      currentStep,
      totalSteps,
    });
  }, []);

  const showHighlight = useCallback(
    (opts: GuideStep | GuideStep[]) => {
      const steps = Array.isArray(opts) ? opts : [opts];
      if (steps.length === 0) return;
      const [first, ...rest] = steps;
      startStep(first, rest, 1, steps.length);
    },
    [startStep]
  );

  const advanceStep = useCallback(() => {
    setState((prev) => {
      if (prev.pendingSteps.length > 0) {
        const [next, ...rest] = prev.pendingSteps;
        const nextStepNum = prev.currentStep + 1;
        setTimeout(() => startStep(next, rest, nextStepNum, prev.totalSteps), 100);
        return { ...prev, active: false, target: null, label: null, navigateTo: null };
      }
      return { active: false, target: null, label: null, navigateTo: null, pendingSteps: [], currentStep: 0, totalSteps: 0 };
    });
  }, [startStep]);

  const value = useMemo(() => ({ state, showHighlight, dismissHighlight, advanceStep }), [state, showHighlight, dismissHighlight, advanceStep]);

  return (
    <GuideHighlightContext.Provider value={value}>
      {children}
    </GuideHighlightContext.Provider>
  );
};
