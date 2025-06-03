import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./Button";
import { expect, fn } from "storybook/test";
import image from "./Button.png"; // Changed to string URL to avoid TS error for now

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta: Meta<typeof Button> = {
  title: "Example/Button",
  component: Button,
  // More on argTypes: https://storybook.js.org/docs/react/api/argtypes
  argTypes: {
    backgroundColor: { control: "color" },
  },
  args: {
    onClick: fn(),
  },
  tags: ["autodocs"],
  parameters: {
    myAddonParameter: `
<MyComponent boolProp scalarProp={1} complexProp={{ foo: 1, bar: '2' }}>
  <SomeOtherComponent funcProp={(a) => a.id} />
</MyComponent>
`,
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
export const Primary: Story = {
  // More on args: https://storybook.js.org/docs/react/writing-stories/args
  args: {
    primary: true,
    label: "Button",
  },
  parameters: {
    pixelPerfect: {
      // Global/default settings
      opacity: 0.6,
      position: { x: 5, y: 5 },
      zoom: 0.9,
      layers: [
        "https://placehold.co/350x150.png?text=Layer+1+(URL)", // Layer as a string URL
        // Simulating an imported image (which resolves to a string path/URL)
        // For now, using a direct string URL instead of `image` from import
        image,
        {
          // Layer as an object, overriding some global settings
          src: "https://placehold.co/120x60.png?text=Layer+3+(Object)",
          opacity: 0.8, // Override global opacity
          position: { x: 100, y: 50 }, // Override global position
          zoom: 1.1, // Override global zoom
          invertColors: true,
        },
        {
          // Layer as an object, inheriting global settings
          src: "https://placehold.co/100x100.png?text=Layer+4+(Inherits)",
        },
      ],
    },
  },
};

export const Secondary: Story = {
  args: {
    label: "Button",
  },
  parameters: {
    pixelPerfect: {
      layers: [image],
    },
  },
};

export const Large: Story = {
  args: {
    size: "large",
    label: "Button",
  },
};

export const Small: Story = {
  args: {
    size: "small",
    label: "Button",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    label: "Button",
  },
  play: async ({ canvas }) => {
    const button = await canvas.getByRole("button");
    await expect(button).toHaveAttribute("disabled");
  },
};
