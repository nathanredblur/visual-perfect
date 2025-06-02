import React, { useState, useCallback, Fragment } from "react";
import { useStorybookApi } from "storybook/manager-api";
import { styled } from "storybook/theming";
import {
  Button,
  Placeholder,
  ScrollArea,
  Separator,
} from "storybook/internal/components";
import { ADDON_ID, EVENTS } from "../constants";

const API_BASE_PATH = "/__visual_perfect_api__";

// Using generic styles instead of theme-based
const PanelWrapper = styled.div`
  padding: 10px;
  font-family: sans-serif;
  color: #333;
  background-color: #f8f8f8;
  height: 100%;
  box-sizing: border-box;
  overflow-y: auto;
`;

const ControlsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
`;

const StatusText = styled.div`
  flex-grow: 1;
  font-size: 12px;
  color: #555;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
`;

interface VisualTestResult {
  status: "idle" | "running" | "success" | "failed" | "error" | "new";
  message?: string;
  diffImage?: string;
  newImage?: string;
  baselineExists?: boolean;
}

interface PanelContentProps {
  active: boolean;
}

export const PanelContent: React.FC<PanelContentProps> = ({ active }) => {
  const [result, setResult] = useState<VisualTestResult>({
    status: "idle",
    baselineExists: false,
  });
  const api = useStorybookApi();

  const getCurrentStoryId = useCallback(() => {
    if (!api) return null;
    const urlState = api.getUrlState();
    return urlState ? urlState.storyId : null;
  }, [api]);

  const handleRunTest = useCallback(async () => {
    const storyId = getCurrentStoryId();
    if (storyId) {
      setResult({
        status: "running",
        message: "Capturing and comparing with Playwright...",
        diffImage: undefined,
        newImage: undefined,
      });
      try {
        const response = await fetch(`${API_BASE_PATH}/test`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storyId }),
        });
        const testApiResult = await response.json();

        if (!response.ok) {
          throw new Error(
            testApiResult.message || `Server error: ${response.status}`,
          );
        }
        setResult({ ...testApiResult, storyId });
      } catch (error: any) {
        console.error(
          `[${ADDON_ID}] Error during visual test for story ${storyId}:`,
          error,
        );
        setResult({
          status: "error",
          message:
            error.message ||
            "Failed to run visual test. Check console and server logs.",
          baselineExists: result.baselineExists,
        });
      }
    }
  }, [api, result.baselineExists, getCurrentStoryId]);

  const handleAcceptChanges = useCallback(async () => {
    const storyId = getCurrentStoryId();
    if (
      storyId &&
      (result.status === "failed" || result.status === "new") &&
      result.newImage
    ) {
      setResult((prevResult) => ({
        ...prevResult,
        status: "running",
        message: "Accepting new baseline...",
      }));
      try {
        const response = await fetch(`${API_BASE_PATH}/accept`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storyId, imageBase64: result.newImage }),
        });
        const acceptApiResult = await response.json();

        if (!response.ok) {
          throw new Error(
            acceptApiResult.message || `Server error: ${response.status}`,
          );
        }
        setResult({
          status: "success",
          message: acceptApiResult.message || "Baseline accepted.",
          baselineExists: true,
          diffImage: undefined,
          newImage: result.newImage,
        });
      } catch (error: any) {
        console.error(
          `[${ADDON_ID}] Error accepting new baseline for story ${storyId}:`,
          error,
        );
        setResult((prevResult) => ({
          ...prevResult,
          status: "error",
          message:
            error.message ||
            "Failed to accept new baseline. Check console and server logs.",
        }));
      }
    }
  }, [result, getCurrentStoryId]);

  const getStatusMessage = () => {
    if (result.status === "idle") return "Ready to test.";
    if (result.status === "running") return result.message || "Processing...";
    if (result.status === "success")
      return result.message || "No changes found.";
    if (result.status === "failed")
      return result.message || "Visual differences detected.";
    if (result.status === "new")
      return result.message || "New baseline image created.";
    if (result.status === "error")
      return `Error: ${result.message || "An unknown error occurred."}`;
    return "Unknown status.";
  };

  if (!active) {
    // Content is not rendered if not active, consistent with Panel behavior
    return null;
  }

  return (
    <PanelWrapper>
      <ControlsRow>
        <StatusText title={getStatusMessage()}>
          {getStatusMessage()}{" "}
          {result.baselineExists === false &&
            result.status !== "running" &&
            result.status !== "new" &&
            "(No baseline)"}
        </StatusText>
        <Button onClick={handleRunTest} disabled={result.status === "running"}>
          Run Test
        </Button>
        <Separator />
        <Button
          title="Accept new image as baseline"
          onClick={handleAcceptChanges}
          disabled={result.status !== "failed" && result.status !== "new"}
        >
          Accept
        </Button>
        <Button
          title="Re-run the test"
          onClick={handleRunTest}
          disabled={result.status === "running"}
        >
          Redo
        </Button>
      </ControlsRow>
      <ImageDisplayWrapper>
        {result.status === "running" && (
          <MessagePlaceholder>Processing test...</MessagePlaceholder>
        )}
        {result.status === "failed" && result.diffImage && (
          <Fragment>
            <MessagePlaceholder>
              Differences found (Diff image below)
            </MessagePlaceholder>
            <StyledImg src={result.diffImage} alt="Visual difference" />
          </Fragment>
        )}
        {result.status === "failed" && !result.diffImage && result.newImage && (
          <Fragment>
            <MessagePlaceholder>
              New image (Diff generation failed or not applicable)
            </MessagePlaceholder>
            <StyledImg src={result.newImage} alt="New image" />
          </Fragment>
        )}
        {result.status === "success" && (
          <MessagePlaceholder>
            Test passed! No visual changes detected.
          </MessagePlaceholder>
        )}
        {result.status === "new" && result.newImage && (
          <Fragment>
            <MessagePlaceholder>
              New baseline image captured.
            </MessagePlaceholder>
            <StyledImg src={result.newImage} alt="New baseline image" />
          </Fragment>
        )}
        {result.status === "new" && !result.newImage && (
          <MessagePlaceholder>
            New baseline image captured (preview not available).
          </MessagePlaceholder>
        )}
        {result.status === "error" && (
          <MessagePlaceholder>{`Error: ${result.message}`}</MessagePlaceholder>
        )}
        {result.status === "idle" && (
          <MessagePlaceholder>Click "Run Test" to start.</MessagePlaceholder>
        )}
      </ImageDisplayWrapper>
    </PanelWrapper>
  );
};
