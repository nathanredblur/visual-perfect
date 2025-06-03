import React from "react";
import { styled } from "storybook/theming";
import type { Theme } from "storybook/theming";
import { IconButton, Button } from "storybook/internal/components";
import {
  EyeIcon,
  EyeCloseIcon,
  LockIcon,
  UnlockIcon,
  ContrastIcon,
  UploadIcon,
} from "@storybook/icons";

// Styled Components (moved from PixelPerfectPanelContent.tsx)
export const ControlsHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  flex-shrink: 0;
  border-bottom: 1px solid ${({ theme }) => theme.appBorderColor || "#ddd"};
  padding-bottom: 10px;
`;

export const IconGroup = styled.div`
  display: inline-flex;
  align-items: center;
  border-radius: ${({ theme }) => theme.appBorderRadius || 4}px;
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.appBorderColor || "#ddd"};
`;

export const StyledIconButtonInGroup = styled(IconButton)<{
  isActive?: boolean;
}>`
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

export const UploadButtonStyled = styled(Button)`
  padding-top: 6px;
  padding-bottom: 6px;
  line-height: 1;
  svg {
    margin-right: 6px;
  }
`;

ControlsHeader.displayName = "ControlsHeader";
IconGroup.displayName = "IconGroup";
StyledIconButtonInGroup.displayName = "StyledIconButtonInGroup";
UploadButtonStyled.displayName = "UploadButtonStyled";

interface PixelPerfectHeaderProps {
  areAllLayersVisible: boolean;
  selectedLayerId: string | null;
  isSelectedLayerLocked: boolean;
  isSelectedLayerInverted: boolean;
  getLockTitle: () => string;
  getInvertTitle: () => string;
  onToggleVisibility: () => void;
  onToggleLock: () => void;
  onToggleInvert: () => void;
  onUploadImage: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileSelected: (event: React.ChangeEvent<HTMLInputElement>) => void;
  selectedLayerRawDetails?: { locked: boolean; invertColors: boolean }; // Optional, for icon state
}

export const PixelPerfectHeader: React.FC<PixelPerfectHeaderProps> = ({
  areAllLayersVisible,
  selectedLayerId,
  isSelectedLayerLocked,
  isSelectedLayerInverted,
  getLockTitle,
  getInvertTitle,
  onToggleVisibility,
  onToggleLock,
  onToggleInvert,
  onUploadImage,
  fileInputRef,
  onFileSelected,
  selectedLayerRawDetails,
}) => {
  return (
    <>
      <input
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        ref={fileInputRef}
        onChange={onFileSelected}
      />
      <ControlsHeader>
        <IconGroup>
          <StyledIconButtonInGroup
            title={
              areAllLayersVisible ? "Hide Active Layer" : "Show Active Layer"
            }
            onClick={onToggleVisibility}
            isActive={areAllLayersVisible}
          >
            {areAllLayersVisible ? <EyeIcon /> : <EyeCloseIcon />}
          </StyledIconButtonInGroup>
          <StyledIconButtonInGroup
            title={getLockTitle()}
            onClick={onToggleLock}
            disabled={!selectedLayerId}
            isActive={isSelectedLayerLocked}
          >
            {selectedLayerRawDetails && selectedLayerRawDetails.locked ? (
              <UnlockIcon />
            ) : (
              <LockIcon />
            )}
          </StyledIconButtonInGroup>
          <StyledIconButtonInGroup
            title={getInvertTitle()}
            onClick={onToggleInvert}
            disabled={!selectedLayerId}
            isActive={isSelectedLayerInverted}
          >
            {selectedLayerRawDetails && selectedLayerRawDetails.invertColors ? (
              <ContrastIcon />
            ) : (
              <ContrastIcon
                style={{ filter: "grayscale(100%) opacity(0.7)" }}
              />
            )}
          </StyledIconButtonInGroup>
        </IconGroup>
        <UploadButtonStyled
          size="small"
          onClick={onUploadImage}
          variant="outline"
        >
          <UploadIcon />
          Upload Image
        </UploadButtonStyled>
      </ControlsHeader>
    </>
  );
};
