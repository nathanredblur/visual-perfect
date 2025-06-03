import React from "react";
import { addons, types } from "storybook/manager-api";
import { AddonPanel } from "storybook/internal/components";
import { ADDON_ID, PANEL_ID, PIXEL_PERFECT_PANEL_ID } from "./constants";
import { PanelContent } from "./components/PanelContent";
import { PixelPerfectPanelContent } from "./components/PixelPerfectPanelContent";

addons.register(ADDON_ID, (api) => {
  addons.add(PANEL_ID, {
    type: types.PANEL,
    title: "Visual Perfect",
    match: ({ viewMode }) => viewMode === "story",
    render: ({ active }) => (
      <AddonPanel active={active || false}>
        <PanelContent active={active || false} />
      </AddonPanel>
    ),
  });

  addons.add(PIXEL_PERFECT_PANEL_ID, {
    type: types.PANEL,
    title: "Pixel Perfect Overlay",
    match: ({ viewMode }) => viewMode === "story",
    render: ({ active }) => (
      <AddonPanel active={active || false}>
        <PixelPerfectPanelContent active={active || false} />
      </AddonPanel>
    ),
  });
});
