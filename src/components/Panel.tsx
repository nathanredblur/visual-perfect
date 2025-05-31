import React from "react";
import { AddonPanel } from "storybook/internal/components";
import { PanelContent } from "./PanelContent";

interface PanelProps {
  active: boolean;
}

export const Panel: React.FC<PanelProps> = (props) => {
  const { active } = props;

  if (!active) {
    return null;
  }

  return (
    <AddonPanel {...props}>
      <PanelContent active={active} />
    </AddonPanel>
  );
};
