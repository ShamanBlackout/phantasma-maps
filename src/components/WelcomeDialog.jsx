export default function WelcomeDialog({
  handleReplayTutorial,
  setIsOnboardingVisible,
  setUserSkillLevel,
}) {
  return (
    <div
      className="onboarding-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-heading"
    >
      <div className="onboarding-card onboarding-card-minimal">
        <p className="onboarding-eyebrow">Phantasma Maps</p>
        <h3 id="welcome-heading" className="onboarding-title">
          Welcome to the wallet graph
        </h3>
        <p className="onboarding-intro">
          Explore token holders, spot concentration, and trace wallet
          relationships in a live interactive map.
        </p>
        <div className="skill-selection">
          <p className="skill-prompt">What's your experience level?</p>
          <button
            type="button"
            className="skill-button beginner-btn"
            onClick={() => {
              handleReplayTutorial();
            }}
          >
            <span className="skill-button-icon" aria-hidden="true">
              ◎
            </span>
            <span className="skill-button-label">I'm New Here</span>
            <span className="skill-description">Show me the basics</span>
          </button>
          <button
            type="button"
            className="skill-button poweruser-btn"
            onClick={() => {
              setUserSkillLevel("power-user");
              setIsOnboardingVisible(false);
            }}
          >
            <span className="skill-button-icon" aria-hidden="true">
              ↗
            </span>
            <span className="skill-button-label">I Know My Way Around</span>
            <span className="skill-description">Skip to the app</span>
          </button>
        </div>
      </div>
    </div>
  );
}
