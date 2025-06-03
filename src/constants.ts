export const ADDON_ID = "visual-perfect";
export const PANEL_ID = `${ADDON_ID}/panel`;
export const PARAM_KEY = "visualPerfectParams"; // For the visual regression panel

export const PIXEL_PERFECT_PANEL_ID = `${ADDON_ID}/pixel-perfect-panel`;
export const PIXEL_PERFECT_PARAM_KEY = "pixelPerfect"; // For the new Pixel Perfect overlay panel

export const DEFAULT_IMAGES_DIR = ".visual-perfect-baselines";

// Events - although direct fetch is used more now for the visual regression panel
export const EVENTS = {
  UPDATE_PIXEL_PERFECT_LAYERS: `${ADDON_ID}/updatePixelPerfectLayers`,
  UPDATE_LAYER_POSITION: `${ADDON_ID}/update_layer_position`,
  DECORATOR_READY: `${ADDON_ID}/decorator_ready`, // For when decorator is ready for initial load
  REQUEST_INITIAL_LAYERS: `${ADDON_ID}/request_initial_layers`, // Decorator requests layers for its current story
} as const;
