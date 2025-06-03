import React from "react";
import { styled } from "storybook/theming";
import { IconButton, Form, Button } from "storybook/internal/components";
import {
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  RefreshIcon,
} from "@storybook/icons";
import type { PixelPerfectLayerState } from "../PixelPerfectPanelContent";

// --- Styled Components (moved from PixelPerfectPanelContent.tsx) ---
export const SelectedLayerControlsWrapper = styled.div`
  padding: 10px;
  border: 1px solid ${({ theme }) => theme.appBorderColor || "#ccc"};
  border-radius: 4px;
  margin-bottom: 10px;
  background-color: ${({ theme }) => theme.background.content};
`;

export const MainControlTitle = styled.h4`
  // Changed from ControlSectionTitle base to direct h4
  margin-top: 0;
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: bold;
  color: ${({ theme }) => theme.color.defaultText};
`;

export const ControlSection = styled.div`
  margin-bottom: 15px;
  padding: 0;
  &:last-child {
    margin-bottom: 0;
  }
`;

export const ControlSectionTitle = styled.h4`
  margin-top: 0;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: bold;
  color: ${({ theme }) => theme.color.defaultText};
  text-transform: uppercase;
`;

export const FormGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;

  label {
    font-size: 12px;
    flex-shrink: 0;
    color: ${({ theme }) => theme.color.defaultText};
    width: 40px;
    text-align: right;
    padding-right: 5px;
  }

  input[type="number"],
  .sb-input-component {
    flex-grow: 1;
  }

  input[type="range"] {
    flex-grow: 1;
  }

  .value-display {
    font-size: 12px;
    width: 45px;
    text-align: right;
    flex-shrink: 0;
    color: ${({ theme }) => theme.color.defaultText};
  }
`;

export const PositionInputs = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-grow: 1;
`;

export const PositionControlsWrapper = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 15px;
  margin-top: 8px;
`;

export const ArrowButtonsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 4px;
  width: 100px;
  height: 100px;
  flex-shrink: 0;
`;

export const OriginHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

export const ResetButton = styled(Button)`
  background: none !important;
  border: none !important;
  padding: 0 !important;
  color: ${({ theme }) => theme.color.secondary} !important;
  text-decoration: none;
  box-shadow: none !important;
  font-size: 12px;

  &:hover {
    text-decoration: underline;
    background: none !important;
  }
`;

SelectedLayerControlsWrapper.displayName = "SelectedLayerControlsWrapper";
MainControlTitle.displayName = "MainControlTitle";
ControlSection.displayName = "ControlSection";
ControlSectionTitle.displayName = "ControlSectionTitle";
FormGroup.displayName = "FormGroup";
PositionInputs.displayName = "PositionInputs";
PositionControlsWrapper.displayName = "PositionControlsWrapper";
ArrowButtonsGrid.displayName = "ArrowButtonsGrid";
OriginHeader.displayName = "OriginHeader";
ResetButton.displayName = "ResetButton";

// --- Component Props Interface ---
interface SelectedLayerDetailControlsProps {
  selectedLayer: PixelPerfectLayerState; // Renamed from selectedLayerRawDetails for clarity
  onOpacityChange: (newOpacity: number) => void;
  onPositionChange: (axis: "x" | "y", value: string | number) => void;
  onZoomChange: (value: string | number) => void;
  onPositionAdjust: (axis: "x" | "y", amount: number) => void;
  onCenterPosition: () => void;
  onResetOrigin: () => void;
}

// --- Component ---
export const SelectedLayerDetailControls: React.FC<
  SelectedLayerDetailControlsProps
> = ({
  selectedLayer,
  onOpacityChange,
  onPositionChange,
  onZoomChange,
  onPositionAdjust,
  onCenterPosition,
  onResetOrigin,
}) => {
  // If no layer is selected, perhaps render nothing or a placeholder (handled by parent for now)
  if (!selectedLayer) return null;

  return (
    <SelectedLayerControlsWrapper>
      <MainControlTitle>Selected Layer</MainControlTitle>
      <ControlSection>
        <OriginHeader>
          <ControlSectionTitle>Origin</ControlSectionTitle>
          <ResetButton
            size="small"
            onClick={onResetOrigin}
            disabled={!selectedLayer}
          >
            RESET
          </ResetButton>
        </OriginHeader>
        <PositionControlsWrapper>
          <ArrowButtonsGrid>
            <div style={{ gridColumn: 1, gridRow: 1 }} />
            <IconButton
              style={{ gridColumn: 2, gridRow: 1 }}
              title="Move Up"
              onClick={() => onPositionAdjust("y", -1)}
              disabled={!selectedLayer}
            >
              <ChevronUpIcon />
            </IconButton>
            <div style={{ gridColumn: 3, gridRow: 1 }} />

            <IconButton
              style={{ gridColumn: 1, gridRow: 2 }}
              title="Move Left"
              onClick={() => onPositionAdjust("x", -1)}
              disabled={!selectedLayer}
            >
              <ChevronLeftIcon />
            </IconButton>
            <IconButton
              style={{ gridColumn: 2, gridRow: 2 }}
              title="Center"
              onClick={onCenterPosition}
              disabled={!selectedLayer}
            >
              <RefreshIcon />
            </IconButton>
            <IconButton
              style={{ gridColumn: 3, gridRow: 2 }}
              title="Move Right"
              onClick={() => onPositionAdjust("x", 1)}
              disabled={!selectedLayer}
            >
              <ChevronRightIcon />
            </IconButton>

            <div style={{ gridColumn: 1, gridRow: 3 }} />
            <IconButton
              style={{ gridColumn: 2, gridRow: 3 }}
              title="Move Down"
              onClick={() => onPositionAdjust("y", 1)}
              disabled={!selectedLayer}
            >
              <ChevronDownIcon />
            </IconButton>
            <div style={{ gridColumn: 3, gridRow: 3 }} />
          </ArrowButtonsGrid>
          <PositionInputs>
            <FormGroup>
              <label htmlFor={`pp-pos-x-${selectedLayer.id}`}>X</label>
              <Form.Input
                id={`pp-pos-x-${selectedLayer.id}`}
                type="number"
                value={selectedLayer.position.x}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onPositionChange("x", e.target.value)
                }
                disabled={!selectedLayer}
                aria-label="X Position"
              />
            </FormGroup>
            <FormGroup>
              <label htmlFor={`pp-pos-y-${selectedLayer.id}`}>Y</label>
              <Form.Input
                id={`pp-pos-y-${selectedLayer.id}`}
                type="number"
                value={selectedLayer.position.y}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onPositionChange("y", e.target.value)
                }
                disabled={!selectedLayer}
                aria-label="Y Position"
              />
            </FormGroup>
            <FormGroup>
              <label htmlFor={`pp-zoom-${selectedLayer.id}`}>Zoom</label>
              <Form.Input
                id={`pp-zoom-${selectedLayer.id}`}
                type="number"
                value={selectedLayer.zoom}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onZoomChange(e.target.value)
                }
                disabled={!selectedLayer}
                step="0.1"
                min="0.1"
                aria-label="Zoom Factor"
              />
            </FormGroup>
          </PositionInputs>
        </PositionControlsWrapper>
      </ControlSection>

      <ControlSection>
        <ControlSectionTitle>Opacity</ControlSectionTitle>
        <FormGroup>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={selectedLayer.opacity}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onOpacityChange(parseFloat(e.target.value))
            }
            disabled={!selectedLayer}
            aria-label="Opacity"
          />
          <span className="value-display">
            {`${Math.round(selectedLayer.opacity * 100)}%`}
          </span>
        </FormGroup>
      </ControlSection>
    </SelectedLayerControlsWrapper>
  );
};
