import type { ProjectAnnotations, Renderer } from "storybook/internal/types";
import { PixelPerfectDecorator } from "./PixelPerfectDecorator"; // Import the new decorator

const preview: ProjectAnnotations<Renderer> = {
  decorators: [PixelPerfectDecorator],
};

export default preview;
