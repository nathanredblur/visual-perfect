import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  useParameter,
  useStorybookApi,
  useChannel,
} from "storybook/manager-api";
import { styled } from "storybook/theming";
import type { Theme } from "storybook/theming";
import {
  Placeholder,
  ScrollArea,
  IconButton,
  Form,
  Button,
} from "storybook/internal/components";
import {
  EyeIcon,
  EyeCloseIcon,
  LockIcon,
  UnlockIcon,
  ContrastIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  RefreshIcon,
  UploadIcon,
  CloseIcon,
} from "@storybook/icons";
import { PIXEL_PERFECT_PARAM_KEY, ADDON_ID, EVENTS } from "../constants";

// --- Configuration Interfaces (from story parameters) ---
interface PixelPerfectLayerConfigObject {
  src: string;
  opacity?: number;
  position?: { x: number; y: number };
  zoom?: number;
  invertColors?: boolean;
}
type PixelPerfectLayerConfig = string | PixelPerfectLayerConfigObject;

interface PixelPerfectParams {
  layers?: PixelPerfectLayerConfig[];
  opacity?: number; // Global/default opacity
  position?: { x: number; y: number }; // Global/default position
  zoom?: number; // Global/default zoom
}

// --- State Interface (for panel internal state & communication with preview) ---
interface PixelPerfectLayerState {
  id: string; // Generated unique ID for UI management
  name: string; // Generated name (e.g., from src or index)
  src: string;
  opacity: number;
  position: { x: number; y: number };
  zoom: number;
  visible: boolean; // UI-controlled, true by default
  locked: boolean; // UI-controlled, false by default
  invertColors: boolean; // Defaults to false
  // 'source' can be re-introduced if needed to distinguish story-defined vs. uploaded for deletion rules
}

// --- Styled Components (similar to PanelContent for consistency) ---
const PanelWrapper = styled.div`
  padding: 10px;
  font-family: sans-serif;
  color: #333;
  background-color: ${({ theme }) => theme.background.content};
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
`;

const ControlsHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  flex-shrink: 0;
  border-bottom: 1px solid ${({ theme }) => theme.appBorderColor || "#ddd"};
  padding-bottom: 10px;
`;

const IconGroup = styled.div`
  display: inline-flex;
  align-items: center;
  border-radius: ${({ theme }) => theme.appBorderRadius || 4}px;
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.appBorderColor || "#ddd"};
`;

const StyledIconButtonInGroup = styled(IconButton)<{ isActive?: boolean }>`
  border-radius: 0;
  padding: 6px;
  border-left: 1px solid ${({ theme }) => theme.appBorderColor || "#ddd"};
  margin-left: -1px;

  &:first-of-type {
    border-left: none;
    margin-left: 0;
  }

  ${({ isActive, theme }) =>
    isActive &&
    `
    background-color: ${theme.color.secondary};
    color: ${theme.color.lightest};
    svg {
      fill: ${theme.color.lightest};
    }
  `}

  ${({ isActive, theme }) =>
    !isActive &&
    `
    background-color: ${theme.background.content};
    &:hover {
      background-color: ${theme.background.hoverable};
    }
  `}
`;

const UploadButtonStyled = styled(Button)`
  padding-top: 6px; // Align text better with icon
  padding-bottom: 6px;
  line-height: 1; // Ensure text and icon align well
  svg {
    margin-right: 6px;
  }
`;

const LayerList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
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

const LayerRow = styled.div<{ isSelected: boolean }>`
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

const LayerName = styled.span`
  flex-grow: 1;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const DeleteLayerButton = styled(IconButton)`
  padding: 4px; // Smaller padding for a compact icon button
  margin-left: auto; // Push to the right
`;

const ContentArea = styled(ScrollArea)`
  flex-grow: 1;
  margin-top: 10px;
  padding: 0 5px 0 0; // Adjust padding for scrollbar
  background-color: transparent; // Make it transparent to inherit PanelWrapper's theme-aware bg
  border-radius: 4px;
`;

// New styled components for controls
const SelectedLayerControlsWrapper = styled.div`
  padding: 10px;
  border: 1px solid ${({ theme }) => theme.appBorderColor || "#ccc"};
  border-radius: 4px;
  margin-bottom: 10px;
  background-color: ${({ theme }) => theme.background.content};
`;

const ControlSection = styled.div`
  margin-bottom: 15px; // Increased margin between Origin/Opacity sections
  padding: 0;
  &:last-child {
    margin-bottom: 0;
  }
`;

const ControlSectionTitle = styled.h4`
  margin-top: 0;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: bold;
  color: ${({ theme }) => theme.color.defaultText};
  text-transform: uppercase;
`;

const MainControlTitle = styled(ControlSectionTitle)`
  text-transform: none;
  font-size: 14px; // Larger for "Selected Layer"
  margin-bottom: 12px;
`;

const FormGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;

  label {
    font-size: 12px;
    flex-shrink: 0;
    color: ${({ theme }) => theme.color.defaultText};
    width: 40px; // Adjusted for labels like "Zoom"
    text-align: right;
    padding-right: 5px;
  }

  input[type="number"],
  .sb-input-component {
    // For Form.Input wrapper
    flex-grow: 1;
    // Storybook Form.Input might control its own width, or we can set it here if needed
  }

  input[type="range"] {
    flex-grow: 1;
  }

  .value-display {
    font-size: 12px;
    width: 45px; // Room for "100%"
    text-align: right;
    flex-shrink: 0;
    color: ${({ theme }) => theme.color.defaultText};
  }
`;

const PositionInputs = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-grow: 1; // Allow it to take space next to arrow pad
`;

// New styled components for position controls
const PositionControlsWrapper = styled.div`
  display: flex;
  align-items: flex-start; // Align arrow pad and inputs to top
  gap: 15px; // Increased gap between arrow buttons block and input fields block
  margin-top: 8px;
`;

const ArrowButtonsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 4px;
  width: 100px; // Fixed width
  height: 100px; // Fixed height
  flex-shrink: 0;
`;

const OriginHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const ResetButton = styled(Button)`
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

PanelWrapper.displayName = "PanelWrapper";
ControlsHeader.displayName = "ControlsHeader";
IconGroup.displayName = "IconGroup";
StyledIconButtonInGroup.displayName = "StyledIconButtonInGroup";
UploadButtonStyled.displayName = "UploadButtonStyled";
LayerList.displayName = "LayerList";
LayerRow.displayName = "LayerRow";
LayerName.displayName = "LayerName";
DeleteLayerButton.displayName = "DeleteLayerButton";
ContentArea.displayName = "ContentArea";
SelectedLayerControlsWrapper.displayName = "SelectedLayerControlsWrapper";
ControlSection.displayName = "ControlSection";
ControlSectionTitle.displayName = "ControlSectionTitle";
MainControlTitle.displayName = "MainControlTitle";
FormGroup.displayName = "FormGroup";
PositionInputs.displayName = "PositionInputs";
PositionControlsWrapper.displayName = "PositionControlsWrapper";
ArrowButtonsGrid.displayName = "ArrowButtonsGrid";
OriginHeader.displayName = "OriginHeader";
ResetButton.displayName = "ResetButton";

interface PixelPerfectPanelContentProps {
  active: boolean;
}

export const PixelPerfectPanelContent: React.FC<
  PixelPerfectPanelContentProps
> = ({ active }) => {
  const storyParams = useParameter<PixelPerfectParams | undefined>(
    PIXEL_PERFECT_PARAM_KEY,
    undefined,
  );
  const api = useStorybookApi();
  const emit = useChannel({});
  const storyData = api.getCurrentStoryData();
  const currentStoryId = storyData?.id;

  const [rawLayersConfig, setRawLayersConfig] = useState<
    PixelPerfectLayerState[]
  >([]);
  const [areAllLayersVisible, setAreAllLayersVisible] =
    useState<boolean>(false);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (active && currentStoryId) {
      const newRawLayers: PixelPerfectLayerState[] = [];
      const defaultOpacity = storyParams?.opacity ?? 1;
      const defaultPosition = storyParams?.position ?? { x: 0, y: 0 };
      const defaultZoom = storyParams?.zoom ?? 1;

      let autoSelectedId: string | null = null;

      if (storyParams?.layers && Array.isArray(storyParams.layers)) {
        storyParams.layers.forEach((layerConfig, index) => {
          let baseSrc: string;
          let layerSpecificOpacity: number | undefined;
          let layerSpecificPosition: { x: number; y: number } | undefined;
          let layerSpecificZoom: number | undefined;
          let layerSpecificInvertColors: boolean | undefined;

          if (typeof layerConfig === "string") {
            baseSrc = layerConfig;
          } else {
            baseSrc = layerConfig.src;
            layerSpecificOpacity = layerConfig.opacity;
            layerSpecificPosition = layerConfig.position;
            layerSpecificZoom = layerConfig.zoom;
            layerSpecificInvertColors = layerConfig.invertColors;
          }

          let name = `Layer ${index + 1}`;
          try {
            const url = new URL(baseSrc);
            const pathnameParts = url.pathname.split("/");
            const fileName = pathnameParts[pathnameParts.length - 1];
            if (fileName) name = decodeURIComponent(fileName);
          } catch (e) {
            /* Not a valid URL, or relative path, keep default name */
          }

          const layerId = `pp-layer-${currentStoryId}-${index}`;
          if (index === 0) autoSelectedId = layerId; // Tentatively select the first

          newRawLayers.push({
            id: layerId,
            name,
            src: baseSrc,
            opacity: layerSpecificOpacity ?? defaultOpacity,
            position: layerSpecificPosition ?? defaultPosition,
            zoom: layerSpecificZoom ?? defaultZoom,
            visible: false,
            locked: false,
            invertColors: layerSpecificInvertColors ?? false,
          });
        });
      }
      setRawLayersConfig(newRawLayers);

      // Update selection: if current selectedId is not in newRawLayers, or none is selected, pick first.
      const currentSelectionStillValid = newRawLayers.some(
        (l) => l.id === selectedLayerId,
      );
      if (!currentSelectionStillValid && newRawLayers.length > 0) {
        setSelectedLayerId(newRawLayers[0]?.id || null);
      }
    } else if (!active) {
      setRawLayersConfig([]);
      setSelectedLayerId(null);
    }
  }, [active, currentStoryId, storyParams]);

  const processedLayers = useMemo(() => {
    return rawLayersConfig.map((layer) => ({
      ...layer,
      visible: areAllLayersVisible && layer.id === selectedLayerId,
    }));
  }, [rawLayersConfig, areAllLayersVisible, selectedLayerId]);

  useEffect(() => {
    if (active) {
      console.log(
        `[${ADDON_ID}-PixelPerfect] Emitting updated processedLayers (via useChannel):`,
        processedLayers,
      );
      emit(EVENTS.UPDATE_PIXEL_PERFECT_LAYERS, { layers: processedLayers });
    }
  }, [processedLayers, active, emit]);

  const handleToggleAllLayersVisibility = useCallback(() => {
    setAreAllLayersVisible((prev) => !prev);
  }, []);

  const handleSelectLayer = useCallback(
    (layerId: string) => {
      setSelectedLayerId(layerId);
      if (
        !areAllLayersVisible &&
        rawLayersConfig.find((l) => l.id === layerId)
      ) {
        setAreAllLayersVisible(true);
      }
    },
    [areAllLayersVisible, rawLayersConfig],
  );

  const handleLayerDelete = useCallback(
    (layerIdToDelete: string, event: React.SyntheticEvent) => {
      event.stopPropagation();
      setRawLayersConfig((prev) =>
        prev.filter((l) => l.id !== layerIdToDelete),
      );
      if (selectedLayerId === layerIdToDelete) {
        const remainingLayers = rawLayersConfig.filter(
          (l) => l.id !== layerIdToDelete,
        );
        setSelectedLayerId(remainingLayers?.[0]?.id || null);
      }
    },
    [rawLayersConfig, selectedLayerId],
  );

  // --- Callbacks for selected layer controls ---
  const handleToggleLock = useCallback(() => {
    if (!selectedLayerId) return;
    setRawLayersConfig((prev) =>
      prev.map((l) =>
        l.id === selectedLayerId ? { ...l, locked: !l.locked } : l,
      ),
    );
  }, [selectedLayerId]);

  const handleToggleInvertColors = useCallback(() => {
    if (!selectedLayerId) return;
    setRawLayersConfig((prev) =>
      prev.map((l) =>
        l.id === selectedLayerId ? { ...l, invertColors: !l.invertColors } : l,
      ),
    );
  }, [selectedLayerId]);

  // --- New handlers for selected layer properties ---
  const handleOpacityChange = useCallback(
    (newOpacity: number) => {
      if (!selectedLayerId) return;
      setRawLayersConfig((prev) =>
        prev.map((l) =>
          l.id === selectedLayerId ? { ...l, opacity: newOpacity } : l,
        ),
      );
    },
    [selectedLayerId],
  );

  const handlePositionChange = useCallback(
    (axis: "x" | "y", value: string | number) => {
      if (!selectedLayerId) return;
      const numericValue =
        typeof value === "string" ? parseFloat(value) : value;
      if (isNaN(numericValue)) return;
      setRawLayersConfig((prev) =>
        prev.map((l) =>
          l.id === selectedLayerId
            ? { ...l, position: { ...l.position, [axis]: numericValue } }
            : l,
        ),
      );
    },
    [selectedLayerId],
  );

  const handleZoomChange = useCallback(
    (value: string | number) => {
      if (!selectedLayerId) return;
      const numericValue =
        typeof value === "string" ? parseFloat(value) : value;
      if (isNaN(numericValue) || numericValue <= 0) return;
      setRawLayersConfig((prev) =>
        prev.map((l) =>
          l.id === selectedLayerId ? { ...l, zoom: numericValue } : l,
        ),
      );
    },
    [selectedLayerId],
  );

  // New handler for position adjustment buttons
  const handlePositionAdjust = useCallback(
    (axis: "x" | "y", amount: number) => {
      if (!selectedLayerId) return;
      const currentLayer = rawLayersConfig.find(
        (l) => l.id === selectedLayerId,
      );
      if (currentLayer) {
        const currentValue = currentLayer.position[axis];
        handlePositionChange(axis, currentValue + amount);
      }
    },
    [selectedLayerId, rawLayersConfig, handlePositionChange],
  );

  const handleCenterPosition = useCallback(() => {
    if (!selectedLayerId) return;
    setRawLayersConfig((prev) =>
      prev.map((l) =>
        l.id === selectedLayerId ? { ...l, position: { x: 0, y: 0 } } : l,
      ),
    );
  }, [selectedLayerId]);

  const handleResetOrigin = useCallback(() => {
    if (!selectedLayerId) return;
    // For now, resets to 0,0 and zoom 1.
    // A more sophisticated reset would use initial params.
    handlePositionChange("x", 0);
    handlePositionChange("y", 0);
    handleZoomChange(1);
  }, [selectedLayerId, handlePositionChange, handleZoomChange]);

  const handleUploadImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelected = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!event || !event.currentTarget) {
        console.log("Event or event.currentTarget is null.");
        return;
      }
      const currentTarget = event.currentTarget;
      if (currentTarget.files && currentTarget.files.length > 0) {
        const file = currentTarget.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            if (e.target && typeof e.target.result === "string") {
              const newLayerSrc = e.target.result;
              const newLayerId = `pp-layer-uploaded-${Date.now()}`;
              const newLayer: PixelPerfectLayerState = {
                id: newLayerId,
                name: file.name,
                src: newLayerSrc,
                opacity: 1,
                position: { x: 0, y: 0 },
                zoom: 1,
                visible: false,
                locked: false,
                invertColors: false,
              };
              setRawLayersConfig((prev) => [...prev, newLayer]);
              setSelectedLayerId(newLayerId);
              if (!areAllLayersVisible) {
                setAreAllLayersVisible(true);
              }
            } else {
              console.error(
                "File reader did not produce a valid string result.",
              );
            }
          };
          reader.onerror = (error) => {
            console.error("Error reading file:", error);
          };
          reader.readAsDataURL(file);
          currentTarget.value = ""; // Reset file input value using the captured currentTarget
        } else {
          console.log(
            "File selected was undefined, although files array was not empty.",
          );
        }
      } else {
        console.log("No file selected or event.target/files is null.");
      }
    },
    [areAllLayersVisible],
  );

  if (!active) {
    return null;
  }

  const selectedLayerRawDetails = rawLayersConfig.find(
    (layer) => layer.id === selectedLayerId,
  );

  const getLockTitle = () => {
    if (!selectedLayerRawDetails) return "Lock Layer (No layer selected)";
    return selectedLayerRawDetails.locked ? "Unlock Layer" : "Lock Layer";
  };

  const getInvertTitle = () => {
    if (!selectedLayerRawDetails) return "Invert Colors (No layer selected)";
    return selectedLayerRawDetails.invertColors
      ? "Normal Colors"
      : "Invert Colors";
  };

  const isSelectedLayerLocked = selectedLayerRawDetails
    ? selectedLayerRawDetails.locked
    : false;

  const isSelectedLayerInverted = selectedLayerRawDetails
    ? selectedLayerRawDetails.invertColors
    : false;

  return (
    <PanelWrapper>
      <input
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        ref={fileInputRef}
        onChange={handleFileSelected}
      />
      <ControlsHeader>
        <IconGroup>
          <StyledIconButtonInGroup
            title={
              areAllLayersVisible ? "Hide Active Layer" : "Show Active Layer"
            }
            onClick={handleToggleAllLayersVisibility}
            isActive={areAllLayersVisible}
          >
            {areAllLayersVisible ? <EyeIcon /> : <EyeCloseIcon />}
          </StyledIconButtonInGroup>
          <StyledIconButtonInGroup
            title={getLockTitle()}
            onClick={handleToggleLock}
            disabled={!selectedLayerId}
            isActive={isSelectedLayerLocked}
          >
            {(() => {
              if (isSelectedLayerLocked) return <UnlockIcon />;
              return <LockIcon />;
            })()}
          </StyledIconButtonInGroup>
          <StyledIconButtonInGroup
            title={getInvertTitle()}
            onClick={handleToggleInvertColors}
            disabled={!selectedLayerId}
            isActive={isSelectedLayerInverted}
          >
            {(() => {
              if (isSelectedLayerInverted) return <ContrastIcon />;
              return (
                <ContrastIcon
                  style={{ filter: "grayscale(100%) opacity(0.7)" }}
                />
              );
            })()}
          </StyledIconButtonInGroup>
        </IconGroup>
        <UploadButtonStyled
          size="small"
          onClick={handleUploadImage}
          variant="outline"
        >
          <UploadIcon />
          Upload Image
        </UploadButtonStyled>
      </ControlsHeader>

      {selectedLayerId && selectedLayerRawDetails && (
        <SelectedLayerControlsWrapper>
          <MainControlTitle>Selected Layer</MainControlTitle>
          <ControlSection>
            <OriginHeader>
              <ControlSectionTitle>Origin</ControlSectionTitle>
              <ResetButton
                size="small"
                onClick={handleResetOrigin}
                disabled={!selectedLayerRawDetails}
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
                  onClick={() => handlePositionAdjust("y", -1)}
                  disabled={!selectedLayerRawDetails}
                >
                  <ChevronUpIcon />
                </IconButton>
                <div style={{ gridColumn: 3, gridRow: 1 }} />
                <IconButton
                  style={{ gridColumn: 1, gridRow: 2 }}
                  title="Move Left"
                  onClick={() => handlePositionAdjust("x", -1)}
                  disabled={!selectedLayerRawDetails}
                >
                  <ChevronLeftIcon />
                </IconButton>
                <IconButton
                  style={{ gridColumn: 2, gridRow: 2 }}
                  title="Center"
                  onClick={handleCenterPosition}
                  disabled={!selectedLayerRawDetails}
                >
                  <RefreshIcon />
                </IconButton>
                <IconButton
                  style={{ gridColumn: 3, gridRow: 2 }}
                  title="Move Right"
                  onClick={() => handlePositionAdjust("x", 1)}
                  disabled={!selectedLayerRawDetails}
                >
                  <ChevronRightIcon />
                </IconButton>
                <div style={{ gridColumn: 1, gridRow: 3 }} />
                <IconButton
                  style={{ gridColumn: 2, gridRow: 3 }}
                  title="Move Down"
                  onClick={() => handlePositionAdjust("y", 1)}
                  disabled={!selectedLayerRawDetails}
                >
                  <ChevronDownIcon />
                </IconButton>
                <div style={{ gridColumn: 3, gridRow: 3 }} />
              </ArrowButtonsGrid>
              <PositionInputs>
                <FormGroup>
                  <label htmlFor={`pp-pos-x-${selectedLayerId}`}>X</label>
                  <Form.Input
                    id={`pp-pos-x-${selectedLayerId}`}
                    type="number"
                    value={selectedLayerRawDetails.position.x}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handlePositionChange("x", e.target.value)
                    }
                    disabled={!selectedLayerRawDetails}
                    aria-label="X Position"
                  />
                </FormGroup>
                <FormGroup>
                  <label htmlFor={`pp-pos-y-${selectedLayerId}`}>Y</label>
                  <Form.Input
                    id={`pp-pos-y-${selectedLayerId}`}
                    type="number"
                    value={selectedLayerRawDetails.position.y}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handlePositionChange("y", e.target.value)
                    }
                    disabled={!selectedLayerRawDetails}
                    aria-label="Y Position"
                  />
                </FormGroup>
                <FormGroup>
                  <label htmlFor={`pp-zoom-${selectedLayerId}`}>Zoom</label>
                  <Form.Input
                    id={`pp-zoom-${selectedLayerId}`}
                    type="number"
                    value={selectedLayerRawDetails.zoom}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleZoomChange(e.target.value)
                    }
                    disabled={!selectedLayerRawDetails}
                    step="0.1"
                    min="0.1" // Ensure zoom doesn't go to or below zero
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
                value={selectedLayerRawDetails.opacity}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  handleOpacityChange(parseFloat(e.target.value))
                }
                disabled={!selectedLayerRawDetails}
                aria-label="Opacity"
              />
              <span className="value-display">
                {`${Math.round(selectedLayerRawDetails.opacity * 100)}%`}
              </span>
            </FormGroup>
          </ControlSection>
        </SelectedLayerControlsWrapper>
      )}

      <ContentArea vertical horizontal>
        {rawLayersConfig.length > 0 ? (
          <LayerList>
            {rawLayersConfig.map((layer) => (
              <LayerRow
                key={layer.id}
                isSelected={layer.id === selectedLayerId}
                onClick={() => handleSelectLayer(layer.id)}
              >
                <LayerName title={layer.src}>{layer.name}</LayerName>
                <DeleteLayerButton
                  title="Delete Layer"
                  onClick={(e) => handleLayerDelete(layer.id, e)}
                >
                  <CloseIcon />
                </DeleteLayerButton>
              </LayerRow>
            ))}
          </LayerList>
        ) : (
          <Placeholder>
            No layers configured. Add via story parameters or click Upload
            Image.
          </Placeholder>
        )}
      </ContentArea>
    </PanelWrapper>
  );
};
