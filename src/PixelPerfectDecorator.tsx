import React, { useState, useEffect, useRef, useCallback } from "react";
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

// Interface for position update payload (emitted from preview)
interface LayerPositionUpdatePayload {
  id: string;
  position: { x: number; y: number };
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
  const storyId = context.id; // Get current storyId from context

  // Refs for draggable layer elements
  const layerRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // State for dragging logic
  const [draggingLayerId, setDraggingLayerId] = useState<string | null>(null);
  const dragStartMouseRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartLayerPositionRef = useRef<{ x: number; y: number } | null>(
    null,
  );
  const currentDragPositionRef = useRef<{ x: number; y: number } | null>(null);

  // --- Refs for event handlers to avoid stale closures ---
  const onMouseMoveRef = useRef((event: MouseEvent) => {});
  const onMouseUpRef = useRef((event: MouseEvent) => {});

  useEffect(() => {
    const handleUpdateLayers = (payload: PixelPerfectUpdatePayload) => {
      setCurrentLayers(payload.layers || []);
    };

    channel.on(EVENTS.UPDATE_PIXEL_PERFECT_LAYERS, handleUpdateLayers);

    return () => {
      channel.off(EVENTS.UPDATE_PIXEL_PERFECT_LAYERS, handleUpdateLayers);
    };
  }, [channel]);

  // NEW Effect: Decorator signals readiness and requests initial layers
  useEffect(() => {
    if (channel && storyId) {
      channel.emit(EVENTS.REQUEST_INITIAL_LAYERS, { storyId });
    }
  }, [channel, storyId]);

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

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (
        !draggingLayerId ||
        !dragStartMouseRef.current ||
        !dragStartLayerPositionRef.current
      ) {
        return;
      }

      const layer = currentLayers.find((l) => l.id === draggingLayerId);
      if (!layer) return;

      const deltaX = event.clientX - dragStartMouseRef.current.x;
      const deltaY = event.clientY - dragStartMouseRef.current.y;

      const newX = dragStartLayerPositionRef.current.x + deltaX / layer.zoom;
      const newY = dragStartLayerPositionRef.current.y + deltaY / layer.zoom;

      currentDragPositionRef.current = { x: newX, y: newY };

      const layerElement = layerRefs.current.get(draggingLayerId);
      if (layerElement) {
        const dragTranslateX = newX - layer.position.x;
        const dragTranslateY = newY - layer.position.y;
        layerElement.style.transform = `translate(${dragTranslateX}px, ${dragTranslateY}px) scale(${layer.zoom})`;
      }

      // Emit position updates during mousemove for live feedback in panel
      channel.emit(EVENTS.UPDATE_LAYER_POSITION, {
        id: draggingLayerId,
        position: { x: newX, y: newY }, // Use the calculated newX, newY
      } as LayerPositionUpdatePayload);
    },
    [draggingLayerId, currentLayers, channel], // Added channel to dependencies
  );

  const handleMouseUp = useCallback(
    (event: MouseEvent) => {
      if (!draggingLayerId || !currentDragPositionRef.current) {
        if (!draggingLayerId) {
          window.removeEventListener("mousemove", onMouseMoveRef.current);
          window.removeEventListener("mouseup", onMouseUpRef.current);
          setDraggingLayerId(null);
        }
        return;
      }

      const finalPosition = currentDragPositionRef.current;

      // Emit the final position one last time on mouseup
      channel.emit(EVENTS.UPDATE_LAYER_POSITION, {
        id: draggingLayerId,
        position: finalPosition,
      } as LayerPositionUpdatePayload);

      setDraggingLayerId(null);
      dragStartMouseRef.current = null;
      dragStartLayerPositionRef.current = null;
      currentDragPositionRef.current = null;

      window.removeEventListener("mousemove", onMouseMoveRef.current);
      window.removeEventListener("mouseup", onMouseUpRef.current);
    },
    [draggingLayerId, channel],
  );

  // Update refs with the latest handlers
  useEffect(() => {
    onMouseMoveRef.current = handleMouseMove;
  }, [handleMouseMove]);

  useEffect(() => {
    onMouseUpRef.current = handleMouseUp;
  }, [handleMouseUp]);

  const handleMouseDown = useCallback(
    (
      event: React.MouseEvent<HTMLDivElement>,
      layer: PixelPerfectLayerState,
    ) => {
      if (layer.locked || event.button !== 0) return;

      event.preventDefault();
      event.stopPropagation();

      dragStartMouseRef.current = { x: event.clientX, y: event.clientY };
      dragStartLayerPositionRef.current = { ...layer.position };
      currentDragPositionRef.current = { ...layer.position };

      setDraggingLayerId(layer.id);

      const mouseMoveListener = (e: MouseEvent) => onMouseMoveRef.current(e);
      const mouseUpListener = (e: MouseEvent) => onMouseUpRef.current(e);

      window.addEventListener("mousemove", mouseMoveListener);
      window.addEventListener("mouseup", mouseUpListener);
    },
    [],
  );

  // General cleanup effect for listeners IF the component unmounts or draggingLayerId becomes null unexpectedly
  useEffect(() => {
    if (!draggingLayerId) {
      const activeMouseMoveListener = (e: MouseEvent) =>
        onMouseMoveRef.current(e);
      const activeMouseUpListener = (e: MouseEvent) => onMouseUpRef.current(e);
      window.removeEventListener("mousemove", activeMouseMoveListener);
      window.removeEventListener("mouseup", activeMouseUpListener);
    }
    return () => {
      if (draggingLayerId) {
        const activeMouseMoveListener = (e: MouseEvent) =>
          onMouseMoveRef.current(e);
        const activeMouseUpListener = (e: MouseEvent) =>
          onMouseUpRef.current(e);
        window.removeEventListener("mousemove", activeMouseMoveListener);
        window.removeEventListener("mouseup", activeMouseUpListener);
      }
    };
  }, [draggingLayerId]);

  return (
    <OverlayContainer ref={storyRootRef}>
      <StoryFn {...context} /> {/* Render the story */}
      {currentLayers
        .filter((layer) => layer.visible) // visible is now always present
        .map((layer) => {
          const isBeingDragged = draggingLayerId === layer.id;
          const layerStyle: React.CSSProperties = {
            position: "absolute",
            top: `${layer.position.y}px`, // position is now always present
            left: `${layer.position.x}px`, // position is now always present
            opacity: layer.opacity, // opacity is now always present
            // Corrected pointer-events logic:
            // - none if locked
            // - none if another layer is being dragged
            // - auto otherwise (allowing mousedown for this layer)
            pointerEvents:
              layer.locked || (!!draggingLayerId && !isBeingDragged)
                ? "none"
                : "auto",
            filter: layer.invertColors ? "invert(100%)" : "none", // invertColors is now always present
            // SIMPLIFIED: Transform is now only for the base scale.
            // The direct DOM manipulation in handleMouseMove handles temporary drag visuals.
            // When currentLayers updates from the panel, this will naturally apply the new top/left with this base scale.
            transform: `scale(${layer.zoom})`,
            transformOrigin: "top left",
            cursor: layer.locked
              ? "default"
              : isBeingDragged
                ? "grabbing"
                : "grab",
            zIndex: 9999, // Ensure layers are on top
            width:
              layer.src.startsWith("data:") || layer.src.startsWith("http")
                ? "auto"
                : undefined,
            height:
              layer.src.startsWith("data:") || layer.src.startsWith("http")
                ? "auto"
                : undefined,
          };

          return (
            <div
              key={layer.id} // id is now always present
              ref={(el) => {
                if (el) layerRefs.current.set(layer.id, el);
                else layerRefs.current.delete(layer.id);
              }}
              style={layerStyle}
              data-layer-id={layer.id}
              data-layer-name={layer.name} // name is now always present
              onMouseDown={(e) => handleMouseDown(e, layer)}
            >
              <img src={layer.src} alt={layer.name} />
            </div>
          );
        })}
    </OverlayContainer>
  );
};
