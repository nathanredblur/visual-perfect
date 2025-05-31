export const ADDON_ID = "visual-perfect";
export const TOOL_ID = `${ADDON_ID}/tool`;
export const PANEL_ID = `${ADDON_ID}/panel`;
export const TAB_ID = `${ADDON_ID}/tab`;

// Event names for communication between manager and preview
export const EVENTS = {
  // Events initiated from the Manager (Panel UI)
  REQUEST_VISUAL_TEST: `${ADDON_ID}/requestVisualTest`, // User clicks "Run Test" or "Redo"
  REQUEST_ACCEPT_NEW_BASELINE: `${ADDON_ID}/requestAcceptNewBaseline`, // User clicks "Accept"

  // Events initiated from the Preview (story's environment)
  VISUAL_TEST_RESULT: `${ADDON_ID}/visualTestResult`, // Preview sends comparison outcome
  NEW_BASELINE_CREATED: `${ADDON_ID}/newBaselineCreated`, // Preview confirms new baseline saved
  BASELINE_ACCEPTED: `${ADDON_ID}/baselineAccepted`, // Preview confirms existing baseline updated
  ERROR_OCCURRED: `${ADDON_ID}/errorOccurred`, // For reporting errors from preview
};

// Key for Storybook parameters if we need to configure behavior per story/component
export const PARAM_KEY = "visualPerfectParams";

// Default directory for storing baseline images (relative to project root)
// This might be configurable by the user later
export const DEFAULT_IMAGES_DIR = ".visual-perfect-baselines";
