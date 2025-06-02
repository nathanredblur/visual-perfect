import React, { useState, useCallback, Fragment, useEffect } from "react";
import { useStorybookApi } from "storybook/manager-api";
import { styled } from "storybook/theming";
import {
  Button,
  Placeholder,
  ScrollArea,
  Separator,
  IconButton,
} from "storybook/internal/components";
import { PlayIcon, CheckIcon, AlertIcon, RefreshIcon } from "@storybook/icons";
import { ADDON_ID } from "../constants";

// --- Custom SVG Icons ---
const SwitchIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <line x1="20" y1="17" x2="4" y2="17"></line>
    <polyline points="7 12 4 17 7 22"></polyline>
    <line x1="4" y1="7" x2="20" y2="7"></line>
    <polyline points="17 2 20 7 17 12"></polyline>
  </svg>
);

const DiffIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect x="3" y="3" width="12" height="12" rx="0" ry="0" />
    <rect
      x="9"
      y="9"
      width="12"
      height="12"
      rx="0"
      ry="0"
      style={{ fill: "currentColor", fillOpacity: 0.3 }}
    />
  </svg>
);

const API_BASE_PATH = "/__visual_perfect_api__";

// Using generic styles instead of theme-based
const PanelWrapper = styled.div`
  padding: 10px;
  font-family: sans-serif;
  color: #333;
  background-color: #f8f8f8;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
`;

const ControlsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  flex-shrink: 0;
`;

const StatusText = styled.div<{ status?: VisualTestResult["status"] }>`
  flex-grow: 1;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  color: ${({ status, theme }) => {
    if (status === "success") return theme.color.positive;
    if (status === "failed" || status === "error") return theme.color.negative;
    if (status === "new") return theme.color.warning; // Or a neutral color
    return theme.color.defaultText;
  }};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  svg {
    width: 14px;
    height: 14px;
  }
`;

const ImageDisplayWrapper = styled.div`
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: auto;
  background-color: #eee;
  border-radius: 4px;
  padding: 10px;
  margin-top: 10px;
  min-height: 200px;
  position: relative; // For positioning image type label
`;

const StyledImg = styled.img`
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border: 1px solid #ddd;
  border-radius: 4px;
`;

const MessagePlaceholder = styled(Placeholder)`
  width: 100%;
  text-align: center;
`;

const BottomControlsRow = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  flex-shrink: 0;
`;

const ImageTypeLabel = styled.div`
  position: absolute;
  top: 5px;
  left: 5px;
  background-color: rgba(0, 0, 0, 0.5);
  color: white;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
`;

interface VisualTestResult {
  status:
    | "idle"
    | "running"
    | "success"
    | "failed"
    | "error"
    | "new"
    | "baseline_exists"
    | "no_baseline"
    | "loading_baseline";
  message?: string;
  diffImage?: string;
  newImage?: string;
  baselineImage?: string;
  baselineExists?: boolean;
}

type DisplayImageType = "new" | "baseline" | "diff";
type AcceptActionState = "idle" | "accepted";

interface PanelContentProps {
  active: boolean;
}

const initialPanelState: VisualTestResult = {
  status: "idle",
  message: "Panel initializing...",
  diffImage: undefined,
  newImage: undefined,
  baselineImage: undefined,
  baselineExists: undefined,
};

export const PanelContent: React.FC<PanelContentProps> = ({ active }) => {
  const [result, setResult] = useState<VisualTestResult>(initialPanelState);
  const [displayImage, setDisplayImage] = useState<DisplayImageType | null>(
    null,
  );
  const [acceptActionState, setAcceptActionState] =
    useState<AcceptActionState>("idle");

  const api = useStorybookApi();
  const storyData = api.getCurrentStoryData();
  const currentStoryId = storyData?.id;

  useEffect(() => {
    if (active && currentStoryId) {
      console.log(
        `[${ADDON_ID}] Story changed to: ${currentStoryId} or panel became active. Loading baseline info...`,
      );
      setResult({
        status: "loading_baseline",
        message: "Loading baseline information...",
      });
      setDisplayImage(null);
      setAcceptActionState("idle");

      const fetchBaseline = async () => {
        try {
          const response = await fetch(
            `${API_BASE_PATH}/baseline/${currentStoryId}`,
          );
          const baselineApiResult: VisualTestResult = await response.json();
          if (!response.ok) {
            throw new Error(
              baselineApiResult.message || `Server error: ${response.status}`,
            );
          }

          if (baselineApiResult.status === "baseline_exists") {
            setResult({
              status: "idle",
              message:
                baselineApiResult.message || "Baseline loaded. Ready to test.",
              baselineImage: baselineApiResult.baselineImage,
              baselineExists: true,
            });
            setDisplayImage("baseline");
          } else if (baselineApiResult.status === "no_baseline") {
            setResult({
              status: "idle",
              message:
                baselineApiResult.message ||
                "No baseline. Run test to create one.",
              baselineExists: false,
            });
            setDisplayImage(null);
          } else {
            throw new Error(
              `Unexpected status from baseline check: ${baselineApiResult.status}`,
            );
          }
        } catch (error: any) {
          console.error(
            `[${ADDON_ID}] Error loading baseline for story ${currentStoryId}:`,
            error,
          );
          setResult({
            status: "error",
            message: error.message || "Failed to load baseline information.",
          });
          setDisplayImage(null);
        }
      };
      fetchBaseline();
    } else if (!active) {
    }
  }, [active, currentStoryId]);

  useEffect(() => {
    if (result.status === "loading_baseline") return;

    if (result.status === "failed" && result.diffImage) {
      setDisplayImage("diff");
    } else if (
      (result.status === "failed" ||
        result.status === "new" ||
        result.status === "success") &&
      result.newImage
    ) {
      setDisplayImage("new");
    } else if (result.status === "baseline_exists" && result.baselineImage) {
      setDisplayImage("baseline");
    } else if (
      result.status === "idle" ||
      result.status === "error" ||
      result.status === "no_baseline"
    ) {
      if (result.status === "idle" && result.baselineImage) {
        setDisplayImage("baseline");
      } else {
        setDisplayImage(null);
      }
    }
  }, [result]);

  const handleRunTest = useCallback(async () => {
    if (!currentStoryId) return;
    setAcceptActionState("idle");
    setDisplayImage(null);
    setResult({
      status: "running",
      message: "Capturing and comparing...",
      baselineExists: result.baselineExists,
    });
    try {
      const response = await fetch(`${API_BASE_PATH}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId: currentStoryId }),
      });
      const testApiResult: VisualTestResult = await response.json();
      if (!response.ok)
        throw new Error(
          testApiResult.message || `Server error: ${response.status}`,
        );
      setResult(testApiResult);
    } catch (error: any) {
      setResult({
        status: "error",
        message: error.message || "Failed to run test.",
        baselineExists: result.baselineExists,
      });
    }
  }, [currentStoryId, result.baselineExists]);

  const handleAcceptChanges = useCallback(async () => {
    if (
      !currentStoryId ||
      !result.newImage ||
      !(result.status === "failed" || result.status === "new")
    )
      return;
    setResult((prev) => ({
      ...prev,
      status: "running",
      message: "Accepting baseline...",
    }));
    try {
      const response = await fetch(`${API_BASE_PATH}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId: currentStoryId,
          imageBase64: result.newImage,
        }),
      });
      const acceptApiResult = await response.json();
      if (!response.ok)
        throw new Error(
          acceptApiResult.message || `Server error: ${response.status}`,
        );
      setResult({
        status: "success",
        message: acceptApiResult.message || "Baseline accepted.",
        baselineExists: true,
        newImage: result.newImage,
        baselineImage: result.newImage,
        diffImage: undefined,
      });
      setAcceptActionState("accepted");
      setDisplayImage("new");
    } catch (error: any) {
      setResult((prev) => ({
        ...prev,
        status: "error",
        message: error.message || "Failed to accept baseline.",
      }));
    }
  }, [currentStoryId, result.newImage, result.status]);

  const getStatusIcon = () => {
    if (result.status === "success" && acceptActionState !== "accepted")
      return <CheckIcon />;
    if (result.status === "failed") return <AlertIcon />;
    if (result.status === "error") return <AlertIcon />;
    if (
      result.status === "new" ||
      result.status === "no_baseline" ||
      result.status === "baseline_exists"
    )
      return <AlertIcon />;
    return null;
  };

  const handleSwitchImage = () => {
    if (displayImage === "new") {
      setDisplayImage("baseline");
    } else {
      setDisplayImage("new");
    }
  };

  const currentImageToDisplay = (): string | null => {
    if (displayImage === "diff" && result.diffImage) return result.diffImage;
    if (displayImage === "baseline" && result.baselineImage)
      return result.baselineImage;
    if (displayImage === "new" && result.newImage) return result.newImage;
    if (
      result.baselineImage &&
      (result.status === "idle" || result.status === "baseline_exists")
    )
      return result.baselineImage;
    if (result.newImage) return result.newImage;
    return null;
  };
  const imageSrc = currentImageToDisplay();
  const imageLabel = displayImage ? displayImage.toUpperCase() : null;

  if (!active) return null;
  const isRunning =
    result.status === "running" || result.status === "loading_baseline";

  const acceptButtonStyle: React.CSSProperties =
    acceptActionState === "accepted"
      ? { backgroundColor: "#4CAF50", color: "white", cursor: "default" }
      : { backgroundColor: "#007bff", color: "white" };

  const acceptedButtonStyle: React.CSSProperties = {
    backgroundColor: "#4CAF50",
    color: "white",
    cursor: "default",
  };

  const noChangesButtonStyle: React.CSSProperties = {
    cursor: "default",
  };

  // Determine which primary action button to show (Run Test or Redo)
  let showRunTestButton = false;
  let showRedoIconButton = false;

  if (
    acceptActionState !== "accepted" &&
    !(result.status === "new" || result.status === "failed")
  ) {
    if (
      result.status === "idle" ||
      result.status === "no_baseline" ||
      result.status === "baseline_exists"
    ) {
      showRunTestButton = true;
    } else if (
      result.status === "error" ||
      result.status ===
        "success" /* && acceptActionState !== "accepted" is implied by outer if */
    ) {
      showRedoIconButton = true;
    }
  }

  return (
    <PanelWrapper>
      <ControlsRow>
        <StatusText status={result.status}>
          {getStatusIcon()}
          <span>{result.message || " "}</span>
        </StatusText>

        {showRunTestButton && (
          <Button
            variant="outline"
            onClick={handleRunTest}
            disabled={isRunning}
          >
            <PlayIcon style={{ marginRight: "6px" }} />
            Run Test
          </Button>
        )}
        {showRedoIconButton && (
          <IconButton
            onClick={handleRunTest}
            disabled={isRunning}
            title="Redo Test"
          >
            <RefreshIcon />
          </IconButton>
        )}

        {/* Accept Changes Button Group (Accept + Redo icon) */}
        {(result.status === "new" || result.status === "failed") &&
          acceptActionState !== "accepted" && (
            <>
              <Button
                onClick={handleAcceptChanges}
                disabled={isRunning || !result.newImage}
                style={acceptButtonStyle}
              >
                Accept
              </Button>
              <Separator />
              <IconButton
                onClick={handleRunTest}
                disabled={isRunning}
                title="Redo Test"
              >
                <RefreshIcon />
              </IconButton>
            </>
          )}

        {/* Accepted State / Post-Success State */}
        {result.status === "success" && acceptActionState === "accepted" && (
          <>
            <Button disabled style={acceptedButtonStyle}>
              <CheckIcon style={{ marginRight: "6px" }} />
              Accepted
            </Button>
            <Separator />
            <IconButton
              onClick={handleRunTest}
              disabled={isRunning}
              title="Redo Test"
            >
              <RefreshIcon />
            </IconButton>
          </>
        )}
      </ControlsRow>

      <ImageDisplayWrapper>
        {isRunning && (
          <MessagePlaceholder>
            {result.message || "Processing..."}
          </MessagePlaceholder>
        )}
        {!isRunning && !imageSrc && (
          <MessagePlaceholder>
            {result.message ||
              "No image to display. Run a test or check baseline status."}
          </MessagePlaceholder>
        )}
        {!isRunning && imageSrc && (
          <>
            <StyledImg
              src={imageSrc}
              alt={displayImage || "Visual test image"}
            />
          </>
        )}
      </ImageDisplayWrapper>

      {!isRunning &&
        (result.status === "failed" ||
          result.status === "success" ||
          result.status === "baseline_exists") &&
        result.newImage &&
        result.baselineImage && (
          <BottomControlsRow>
            <Button
              variant="outline"
              size="small"
              onClick={handleSwitchImage}
              title="Switch between new and baseline image"
            >
              <SwitchIcon
                style={{ marginRight: "4px", width: "14px", height: "14px" }}
              />
              Switch (
              {displayImage === "new"
                ? "Baseline"
                : displayImage === "baseline"
                  ? "New"
                  : "New"}
              )
            </Button>

            {result.diffImage && (
              <IconButton
                onClick={() => setDisplayImage("diff")}
                active={displayImage === "diff"}
                title="Show Difference Image"
              >
                <DiffIcon style={{ width: "14px", height: "14px" }} />
              </IconButton>
            )}
          </BottomControlsRow>
        )}
    </PanelWrapper>
  );
};
