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
  ScrollArea,
  IconButton,
  Form,
  Button,
} from "storybook/internal/components";
import {
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  RefreshIcon,
} from "@storybook/icons";
import { PIXEL_PERFECT_PARAM_KEY, ADDON_ID, EVENTS } from "../constants";
import { PixelPerfectHeader } from "./pixelPerfectControls/PixelPerfectHeader";
import { LayerListDisplay } from "./pixelPerfectControls/LayerListDisplay";
import { SelectedLayerDetailControls } from "./pixelPerfectControls/SelectedLayerDetailControls";

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
export interface PixelPerfectLayerState {
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

// Interface for payload from preview when layer is dragged
interface LayerPositionUpdatePayload {
  id: string;
  position: { x: number; y: number };
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

const ContentArea = styled(ScrollArea)`
  flex-grow: 1;
  margin-top: 10px;
  padding: 0 5px 0 0;
  background-color: transparent;
  border-radius: 4px;
`;

const SelectedLayerControlsWrapper = styled.div`
  padding: 10px;
  border: 1px solid ${({ theme }) => theme.appBorderColor || "#ccc"};
  border-radius: 4px;
  margin-bottom: 10px;
  background-color: ${({ theme }) => theme.background.content};
`;

const ControlSection = styled.div`
  margin-bottom: 15px;
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
  font-size: 14px;
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

const PositionInputs = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-grow: 1;
`;

const PositionControlsWrapper = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 15px;
  margin-top: 8px;
`;

const ArrowButtonsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 4px;
  width: 100px;
  height: 100px;
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
      const newRawLayersFromParams: PixelPerfectLayerState[] = [];
      const defaultOpacity = storyParams?.opacity ?? 0.5;
      const defaultPosition = storyParams?.position ?? { x: 0, y: 0 };
      const defaultZoom = storyParams?.zoom ?? 1;

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
            /* Keep default */
          }

          // Ensure layer IDs from story params are distinct from uploaded ones
          const layerId = `pp-layer-story-${currentStoryId}-${index}`;

          newRawLayersFromParams.push({
            id: layerId,
            name,
            src: baseSrc,
            opacity: layerSpecificOpacity ?? defaultOpacity,
            position: layerSpecificPosition ?? defaultPosition,
            zoom: layerSpecificZoom ?? defaultZoom,
            visible: false, // Initial visibility is false, controlled by selection/global toggle
            locked: false,
            invertColors: layerSpecificInvertColors ?? false,
          });
        });
      }

      // This updater function now correctly merges new params with existing state
      setRawLayersConfig((prevRawLayers) => {
        const nextLayers: PixelPerfectLayerState[] = [];
        const paramLayerIds = new Set(newRawLayersFromParams.map((l) => l.id));
        let newSelectedLayerId: string | null = null;

        // Process layers from parameters
        newRawLayersFromParams.forEach((paramLayer) => {
          const existingLayer = prevRawLayers.find(
            (l) => l.id === paramLayer.id,
          );
          if (existingLayer && existingLayer.src === paramLayer.src) {
            // If layer from params matches an existing one by ID and SRC,
            // keep its user-modified state (opacity, position, zoom, locked, invertColors, visible)
            // but update its name from params (in case it changed) and ensure param-defined specifics are used if they were the source.
            // This is subtle. The paramLayer already has the *correct* opacity/pos/zoom based on story param specifics or defaults.
            // We want to preserve user interactions if they occurred AFTER this layer was first created with those param settings.
            // The `existingLayer` here *is* the one that would have been dragged/modified.
            nextLayers.push({
              ...paramLayer, // Start with param definition (name, src, param-specific opacity/pos/zoom or defaults)
              // Then overlay with user-modified state if it was not just a default application.
              // Crucially, if the user dragged it, existingLayer.position is the truth.
              opacity: existingLayer.opacity,
              position: existingLayer.position,
              zoom: existingLayer.zoom,
              locked: existingLayer.locked,
              invertColors: existingLayer.invertColors,
              visible: existingLayer.visible, // Preserve visibility state too
            });
          } else {
            // It's a new layer from params (or src changed, treat as new)
            nextLayers.push(paramLayer);
          }
        });

        // Add uploaded layers from previous state that are not in current story params
        prevRawLayers.forEach((prevLayer) => {
          if (
            prevLayer.id.startsWith("pp-layer-uploaded-") &&
            !paramLayerIds.has(prevLayer.id)
          ) {
            nextLayers.push(prevLayer);
          }
        });

        // Determine selection based on the new `nextLayers`
        // Read current selectedLayerId from state directly inside this updater via a ref or pass as arg if needed,
        // for now, we use the selectedLayerId from the outer scope (which might be slightly stale if this runs due to its own change)
        // Better: use the `prevRawLayers` to find previous selection if needed.
        const currentSelectedLayer = prevRawLayers.find(
          (l) => l.id === selectedLayerId,
        );
        let selectionStillValid = false;
        if (currentSelectedLayer) {
          selectionStillValid = nextLayers.some(
            (l) => l.id === currentSelectedLayer.id,
          );
        }

        if (selectionStillValid) {
          newSelectedLayerId = selectedLayerId;
        } else if (nextLayers.length > 0) {
          newSelectedLayerId = nextLayers[0]?.id || null;
        } else {
          newSelectedLayerId = null;
        }

        // Only update selectedLayerId if it actually changes to prevent loops with its own effect
        if (newSelectedLayerId !== selectedLayerId) {
          setSelectedLayerId(newSelectedLayerId);
        }

        return nextLayers;
      });
    } else if (!active) {
      setRawLayersConfig([]);
      setSelectedLayerId(null);
    }
    // Dependencies: Only re-run if the story context or parameters change.
    // selectedLayerId (value) is read, setSelectedLayerId (setter) is called.
  }, [
    active,
    currentStoryId,
    storyParams,
    selectedLayerId,
    setSelectedLayerId,
  ]);

  useEffect(() => {
    const handleLayerPositionUpdate = (payload: LayerPositionUpdatePayload) => {
      console.log(
        `[${ADDON_ID}-Panel] Received layer position update:`,
        payload,
      );
      setRawLayersConfig((prevLayers) =>
        prevLayers.map((layer) =>
          layer.id === payload.id
            ? { ...layer, position: payload.position }
            : layer,
        ),
      );
    };

    const channel = api.getChannel();
    if (channel) {
      channel.on(EVENTS.UPDATE_LAYER_POSITION, handleLayerPositionUpdate);

      return () => {
        channel.off(EVENTS.UPDATE_LAYER_POSITION, handleLayerPositionUpdate);
      };
    }
    // If channel is not available, this effect does nothing and returns no cleanup.
    // It might be an indication that the API is not ready, though typically it should be.
    return undefined; // Explicitly return undefined if channel is not set up
  }, [api]);

  const processedLayers = useMemo(() => {
    return rawLayersConfig.map((layer) => ({
      ...layer,
      visible: areAllLayersVisible && layer.id === selectedLayerId,
    }));
  }, [rawLayersConfig, areAllLayersVisible, selectedLayerId]);

  useEffect(() => {
    if (active) {
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
      setRawLayersConfig((prev) => {
        const updatedLayers = prev.filter((l) => l.id !== layerIdToDelete);
        if (selectedLayerId === layerIdToDelete) {
          setSelectedLayerId(updatedLayers?.[0]?.id || null);
        }
        return updatedLayers;
      });
    },
    [selectedLayerId],
  );

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
                opacity: storyParams?.opacity ?? 0.5,
                position: storyParams?.position ?? { x: 0, y: 0 },
                zoom: storyParams?.zoom ?? 1,
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
          currentTarget.value = "";
        } else {
          console.log(
            "File selected was undefined, although files array was not empty.",
          );
        }
      } else {
        console.log("No file selected or currentTarget.files is null.");
      }
    },
    [areAllLayersVisible, storyParams],
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

  const isSelectedLayerLocked = selectedLayerRawDetails?.locked ?? false;
  const isSelectedLayerInverted =
    selectedLayerRawDetails?.invertColors ?? false;

  return (
    <PanelWrapper>
      <PixelPerfectHeader
        areAllLayersVisible={areAllLayersVisible}
        selectedLayerId={selectedLayerId}
        isSelectedLayerLocked={isSelectedLayerLocked}
        isSelectedLayerInverted={isSelectedLayerInverted}
        getLockTitle={getLockTitle}
        getInvertTitle={getInvertTitle}
        onToggleVisibility={handleToggleAllLayersVisibility}
        onToggleLock={handleToggleLock}
        onToggleInvert={handleToggleInvertColors}
        onUploadImage={handleUploadImage}
        fileInputRef={fileInputRef}
        onFileSelected={handleFileSelected}
        selectedLayerRawDetails={selectedLayerRawDetails}
      />

      {selectedLayerId && selectedLayerRawDetails && (
        <SelectedLayerDetailControls
          selectedLayer={selectedLayerRawDetails}
          onOpacityChange={handleOpacityChange}
          onPositionChange={handlePositionChange}
          onZoomChange={handleZoomChange}
          onPositionAdjust={handlePositionAdjust}
          onCenterPosition={handleCenterPosition}
          onResetOrigin={handleResetOrigin}
        />
      )}

      <ContentArea vertical horizontal>
        <LayerListDisplay
          rawLayersConfig={rawLayersConfig}
          selectedLayerId={selectedLayerId}
          onSelectLayer={handleSelectLayer}
          onDeleteLayer={handleLayerDelete}
        />
      </ContentArea>
    </PanelWrapper>
  );
};
