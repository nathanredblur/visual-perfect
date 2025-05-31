import React from "react";
import { addons, types } from "storybook/manager-api";
import { ADDON_ID, PANEL_ID, TOOL_ID } from "./constants";
import { Panel } from "./components/Panel";
import { Tool } from "./components/Tool";

addons.register(ADDON_ID, (api) => {
  addons.add(TOOL_ID, {
    type: types.TOOL,
    title: "Pixel Perfect",
    match: ({ viewMode }) => !!(viewMode && viewMode.match(/^(story)$/)),
    render: () => <Tool api={api} />,
  });

  addons.add(PANEL_ID, {
    type: types.PANEL,
    title: "Visual Perfect",
    match: ({ viewMode }) => viewMode === "story",
    render: ({ active }) => <Panel active={active || false} />,
  });
});
