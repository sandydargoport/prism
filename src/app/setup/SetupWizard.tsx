'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { WelcomeStep } from './steps/WelcomeStep';
import { FamilyStep } from './steps/FamilyStep';
import { HouseholdStep } from './steps/HouseholdStep';
import { CompleteStep } from './steps/CompleteStep';

export type StepId = 'welcome' | 'family' | 'household' | 'complete';

const STEPS: { id: StepId; label: string }[] = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'family', label: 'Family' },
  { id: 'household', label: 'Household' },
  { id: 'complete', label: 'Done' },
];

const CONTENT_STEPS = STEPS.filter((s) => s.id !== 'welcome' && s.id !== 'complete');

export function SetupWizard() {
  const [currentStep, setCurrentStep] = useState<StepId>('welcome');

  const stepIndex = STEPS.findIndex((s) => s.id === currentStep);
  const contentIndex = CONTENT_STEPS.findIndex((s) => s.id === currentStep);

  const goNext = () => {
    const next = STEPS[stepIndex + 1];
    if (next) setCurrentStep(next.id);
  };

  const goBack = () => {
    const prev = STEPS[stepIndex - 1];
    if (prev) setCurrentStep(prev.id);
  };

  const goTo = (id: StepId) => setCurrentStep(id);

  const showProgress = currentStep !== 'welcome' && currentStep !== 'complete';

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Progress bar */}
      {showProgress && (
        <div className="w-full max-w-lg mb-6">
          <div className="flex justify-between mb-2">
            {CONTENT_STEPS.map((step, i) => (
              <div
                key={step.id}
                className={cn(
                  'text-xs font-medium transition-colors',
                  i <= contentIndex ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {step.label}
              </div>
            ))}
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${((contentIndex + 1) / CONTENT_STEPS.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Step content */}
      <div className="w-full max-w-lg">
        {currentStep === 'welcome' && <WelcomeStep onNext={goNext} />}
        {currentStep === 'family' && <FamilyStep onNext={goNext} onBack={goBack} />}
        {currentStep === 'household' && <HouseholdStep onNext={goNext} onBack={goBack} />}
        {currentStep === 'complete' && <CompleteStep />}
      </div>

      {/* Step counter */}
      {showProgress && (
        <p className="mt-4 text-xs text-muted-foreground">
          Step {contentIndex + 1} of {CONTENT_STEPS.length}
        </p>
      )}
    </div>
  );
}
