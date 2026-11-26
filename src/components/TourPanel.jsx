export default function TourPanel({
  currentOnboardingStep,
  isOnboardingFirstStep,
  isOnboardingLastStep,
  onboardingTutorialStepCount,
  onboardingTutorialStepIndex,
  setIsOnboardingVisible,
  setOnboardingTutorialStep,
}) {
  return (
    <div
      className="tour-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="tour-heading"
    >
      <p className="onboarding-eyebrow">
        Guided Tour · Step {onboardingTutorialStepIndex + 1} of{" "}
        {onboardingTutorialStepCount}
      </p>
      <h3 id="tour-heading" className="tour-panel-title">
        {currentOnboardingStep?.title || "Quick Start"}
      </h3>
      <p className="tour-panel-detail">
        {currentOnboardingStep?.detail || ""}
      </p>
      {currentOnboardingStep?.tip ? (
        <p className="onboarding-tip">{currentOnboardingStep.tip}</p>
      ) : null}
      <div
        className="onboarding-progress-bar tour-progress-bar"
        aria-hidden="true"
      >
        <span
          style={{
            width: `${((onboardingTutorialStepIndex + 1) / onboardingTutorialStepCount) * 100}%`,
          }}
        />
      </div>
      <div className="onboarding-tutorial-actions">
        <button
          type="button"
          className="onboarding-tutorial-btn"
          onClick={() =>
            setOnboardingTutorialStep((current) => Math.max(0, current - 1))
          }
          disabled={isOnboardingFirstStep}
        >
          Previous
        </button>
        <button
          type="button"
          className="onboarding-tutorial-btn"
          onClick={() => setIsOnboardingVisible(false)}
        >
          Skip
        </button>
        <button
          type="button"
          className="onboarding-tutorial-btn is-primary"
          onClick={() => {
            if (isOnboardingLastStep) {
              setIsOnboardingVisible(false);
              return;
            }
            setOnboardingTutorialStep((current) =>
              Math.min(onboardingTutorialStepCount - 1, current + 1),
            );
          }}
        >
          {isOnboardingLastStep ? "Finish" : "Next"}
        </button>
      </div>
    </div>
  );
}
