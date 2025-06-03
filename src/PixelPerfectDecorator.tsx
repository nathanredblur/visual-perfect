import React, { useState, useEffect, useRef } from "react";
import type {
  PartialStoryFn as StoryFn,
  StoryContext,
} from "storybook/internal/types"; // Reverted to internal types
import { addons } from "storybook/preview-api"; // For addons.getChannel()
import { EVENTS, ADDON_ID } from "./constants";

// --- Interface for received layer state (should match PixelPerfectLayerState from PanelContent) ---
interface PixelPerfectLayerState {
  id: string;
  name: string;
  src: string;
  opacity: number;
  position: { x: number; y: number };
  zoom: number;
  visible: boolean;
  locked: boolean;
  invertColors: boolean;
}

// Interface for the event payload from the panel
interface PixelPerfectUpdatePayload {
  layers?: PixelPerfectLayerState[];
  // globalOpacity might be deprecated if all layers have resolved opacity
}

const OverlayContainer = React.forwardRef<
  HTMLDivElement,
  { children: React.ReactNode }
>(({ children }, ref) => (
  <div
    ref={ref}
    style={{ position: "relative", width: "100%", height: "100%" }}
  >
    {children} {/* This is the story itself */}
  </div>
));

export const PixelPerfectDecorator: (
  StoryFn: StoryFn<any>,
  context: StoryContext,
) => React.ReactElement = (StoryFn, context) => {
  const [currentLayers, setCurrentLayers] = useState<PixelPerfectLayerState[]>(
    [],
  );
  const storyRootRef = useRef<HTMLDivElement>(null);
  const channel = addons.getChannel();

  useEffect(() => {
    const handleUpdateLayers = (payload: PixelPerfectUpdatePayload) => {
      console.log(
        `[${ADDON_ID}-Preview] Received layer update:`,
        payload.layers,
      );
      setCurrentLayers(payload.layers || []);
    };

    channel.on(EVENTS.UPDATE_PIXEL_PERFECT_LAYERS, handleUpdateLayers);

    return () => {
      channel.off(EVENTS.UPDATE_PIXEL_PERFECT_LAYERS, handleUpdateLayers);
    };
  }, [channel]);

  // Observe the size of the story's root element to help with layer positioning if needed
  // This is a basic implementation; more robust solutions might be needed for dynamic content.
  useEffect(() => {
    const storybookRoot = document.getElementById("storybook-root"); // Or 'root' in older SB versions
    let currentRoot: HTMLElement | null = null;

    if (storyRootRef.current) {
      currentRoot = storyRootRef.current;
    } else if (storybookRoot && storybookRoot.firstChild) {
      // Fallback if ref isn't immediately available or not working as expected
      // This tries to get the direct child of storybook-root which is often the component's wrapper
      currentRoot = storybookRoot.firstChild as HTMLElement;
    }

    if (!currentRoot) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        // setContainerSize({
        //   width: entry.contentRect.width,
        //   height: entry.contentRect.height,
        // });
      }
    });

    resizeObserver.observe(currentRoot);
    // Initial size
    // setContainerSize({
    //   width: currentRoot.offsetWidth,
    //   height: currentRoot.offsetHeight,
    // });

    return () => {
      if (currentRoot) {
        resizeObserver.unobserve(currentRoot);
      }
    };
  }, [StoryFn]); // Re-run if StoryFn changes, indicating a new story might have a different root structure

  return (
    <OverlayContainer ref={storyRootRef}>
      <StoryFn {...context} /> {/* Render the story */}
      {currentLayers
        .filter((layer) => layer.visible) // visible is now always present
        .map((layer) => {
          const layerStyle: React.CSSProperties = {
            position: "absolute",
            top: `${layer.position.y}px`, // position is now always present
            left: `${layer.position.x}px`, // position is now always present
            opacity: layer.opacity, // opacity is now always present
            pointerEvents: layer.locked ? "none" : "auto", // locked is now always present
            filter: layer.invertColors ? "invert(100%)" : "none", // invertColors is now always present
            transform: `scale(${layer.zoom})`, // zoom is now always present
            transformOrigin: "top left",
            width:
              layer.src.startsWith("data:") || layer.src.startsWith("http")
                ? "auto"
                : undefined,
            height:
              layer.src.startsWith("data:") || layer.src.startsWith("http")
                ? "auto"
                : undefined,
            zIndex: 9990,
          };

          return (
            <div
              key={layer.id} // id is now always present
              style={layerStyle}
              data-layer-id={layer.id}
              data-layer-name={layer.name} // name is now always present
            >
              <img
                src={layer.src}
                alt={layer.name}
                style={{
                  display: "block",
                  width: "100%", // Make image responsive to the div's potential future sizing based on zoom
                  height: "auto",
                  opacity: "inherit", // Inherit opacity from parent div which has the primary opacity control
                  filter: "inherit", // Inherit filter
                }}
              />
            </div>
          );
        })}
    </OverlayContainer>
  );
};
