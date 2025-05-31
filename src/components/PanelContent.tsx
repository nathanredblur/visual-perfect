import React, { useState, useCallback, Fragment } from "react";
import { useChannel, useStorybookApi } from "storybook/manager-api";
import { styled } from "storybook/theming";
import {
  Button,
  Placeholder,
  ScrollArea,
  Separator,
} from "storybook/internal/components";
import { EVENTS } from "../constants";

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

  const emit = useChannel({
    [EVENTS.VISUAL_TEST_RESULT]: (data: VisualTestResult) => setResult(data),
    [EVENTS.NEW_BASELINE_CREATED]: (data: { message: string }) =>
      setResult({ status: "new", message: data.message, baselineExists: true }),
    [EVENTS.BASELINE_ACCEPTED]: (data: { message: string }) =>
      setResult({
        status: "success",
        message: data.message,
        baselineExists: true,
      }),
    [EVENTS.ERROR_OCCURRED]: (data: { message: string }) =>
      setResult({ status: "error", message: data.message }),
  });

  const getCurrentStoryId = useCallback(() => {
    if (!api) return null;
    const urlState = api.getUrlState();
    return urlState ? urlState.storyId : null;
  }, [api]);

  const handleRunTest = useCallback(() => {
    const storyId = getCurrentStoryId();
    if (storyId) {
      setResult({
        status: "running",
        message: "Capturing screenshot and comparing...",
      });
      emit(EVENTS.REQUEST_VISUAL_TEST, { storyId });
    }
  }, [emit, getCurrentStoryId]);

  const handleAcceptChanges = useCallback(() => {
    const storyId = getCurrentStoryId();
    if (storyId && (result.status === "failed" || result.status === "new")) {
      setResult({ status: "running", message: "Accepting new baseline..." });
      emit(EVENTS.REQUEST_ACCEPT_NEW_BASELINE, {
        storyId,
        newImage: result.newImage,
      });
    }
  }, [emit, getCurrentStoryId, result.status, result.newImage]);

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
