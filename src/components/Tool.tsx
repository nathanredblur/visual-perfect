import React, { memo, useCallback, useEffect } from "react";
import { useGlobals, type API } from "storybook/manager-api";
import { IconButton } from "storybook/internal/components";
import { ADDON_ID, TOOL_ID } from "../constants";
import { LightningIcon } from "@storybook/icons";

export const Tool = memo(function MyAddonSelector({ api }: { api: API }) {
  const [globals, updateGlobals, storyGlobals] = useGlobals();

  const isLocked = ADDON_ID in storyGlobals;
  const isActive = !!globals[ADDON_ID];

  const toggle = useCallback(() => {
    updateGlobals({
      [ADDON_ID]: !isActive,
    });
  }, [isActive]);

  useEffect(() => {
    api.setAddonShortcut(ADDON_ID, {
      label: "Toggle Measure [O]",
      defaultShortcut: ["O"],
      actionName: "outline",
      showInMenu: false,
      action: toggle,
    });
  }, [toggle, api]);

  return (
    <IconButton
      key={TOOL_ID}
      active={isActive}
      disabled={isLocked}
      title="Enable my addon"
      onClick={toggle}
    >
      <LightningIcon />
    </IconButton>
  );
});
