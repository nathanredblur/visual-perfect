import React from "react";
import { styled } from "storybook/theming";
import type { Theme } from "storybook/theming";
import {
  Placeholder,
  ScrollArea,
  IconButton,
} from "storybook/internal/components";
import { CloseIcon } from "@storybook/icons";
import type { PixelPerfectLayerState } from "../PixelPerfectPanelContent"; // Adjust path as needed

// Styled Components (moved from PixelPerfectPanelContent.tsx)
export const LayerList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px; // This might be adjusted or removed if ContentArea handles spacing
`;

// Simplified background color logic for LayerRow to avoid lighten/darken issues
const getLayerRowBackgroundColor = (
  isSelected: boolean,
  theme: Theme | undefined,
  type: "normal" | "hover",
) => {
  const isDark = theme?.base === "dark";
  if (isSelected) {
    if (type === "hover") return isDark ? "#4A5568" : "#EBF4FF"; // Darker selected hover / Lighter selected hover
    return isDark ? "#2D3748" : "#C3DAFE"; // Dark selected / Light selected
  }
  if (type === "hover") return isDark ? "#2A303C" : "#F7FAFC"; // Dark hover / Light hover
  return isDark ? "#1A202C" : "#FFFFFF"; // Dark normal / Light normal
};

export const LayerRow = styled.div<{ isSelected: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border: 1px solid ${({ theme }) => theme?.appBorderColor || "#ddd"};
  border-radius: 4px;
  background-color: ${({ isSelected, theme }) =>
    getLayerRowBackgroundColor(isSelected, theme, "normal")};
  cursor: pointer;
  &:hover {
    background-color: ${({ isSelected, theme }) =>
      getLayerRowBackgroundColor(isSelected, theme, "hover")};
  }
`;

export const LayerName = styled.span`
  flex-grow: 1;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const DeleteLayerButton = styled(IconButton)`
  padding: 4px;
  margin-left: auto;
`;

// ContentArea is kept in the main component for now as it wraps more than just the list

LayerList.displayName = "LayerList";
LayerRow.displayName = "LayerRow";
LayerName.displayName = "LayerName";
DeleteLayerButton.displayName = "DeleteLayerButton";

interface LayerListDisplayProps {
  rawLayersConfig: PixelPerfectLayerState[];
  selectedLayerId: string | null;
  onSelectLayer: (id: string) => void;
  onDeleteLayer: (id: string, event: React.SyntheticEvent) => void;
}

export const LayerListDisplay: React.FC<LayerListDisplayProps> = ({
  rawLayersConfig,
  selectedLayerId,
  onSelectLayer,
  onDeleteLayer,
}) => {
  if (rawLayersConfig.length === 0) {
    return (
      <Placeholder>
        No layers configured. Add via story parameters or click Upload Image.
      </Placeholder>
    );
  }

  return (
    <LayerList>
      {rawLayersConfig.map((layer) => {
        const canDelete = layer.id.startsWith("pp-layer-uploaded-");
        return (
          <LayerRow
            key={layer.id}
            isSelected={layer.id === selectedLayerId}
            onClick={() => onSelectLayer(layer.id)}
          >
            <LayerName title={layer.src}>{layer.name}</LayerName>
            {canDelete && (
              <DeleteLayerButton
                title="Delete Layer"
                onClick={(e) => onDeleteLayer(layer.id, e)}
              >
                <CloseIcon />
              </DeleteLayerButton>
            )}
          </LayerRow>
        );
      })}
    </LayerList>
  );
};
