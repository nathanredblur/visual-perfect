# Storybook Addon Visual Perfect

Storybook addon for comprehensive visual testing, including:

1.  **Visual Regression Tests (Panel)**: Compare Storybook stories against baseline images to catch unintended UI changes.
2.  **Pixel Perfect Comparison (Tool)**: Overlay your Storybook story with a reference image to check for pixel-level accuracy (Coming Soon / To be detailed).

## Features (Visual Tests Panel)

- **Run Test**: Compares the current Storybook canvas with an existing baseline image. If no baseline exists, a new one is created. Image comparison uses the [Pixelmatch](https://www.npmjs.com/package/pixelmatch) library.
- **Accept**: If visual differences are found, this action allows you to accept the new image as the baseline.
- **Redo**: Re-runs the visual test for the current story.

## Installation

First, install the package:

```sh
npm install --save-dev storybook-addon-visual-perfect
# or
yarn add --dev storybook-addon-visual-perfect
```

then install playwrite deplendencies

```sh
NODE_TLS_REJECT_UNAUTHORIZED=0 npx playwright install --with-deps
```

Then, register it as an addon in your `.storybook/main.js` or `.storybook/main.ts`:

```ts
// .storybook/main.ts

// Replace your-framework with the framework you are using (e.g., react-webpack5, vue3-vite)
import type { StorybookConfig } from "@storybook/your-framework";

const config: StorybookConfig = {
  // ...rest of config
  addons: [
    // Other addons
    "storybook-addon-visual-perfect", // 👈 Register the addon here
  ],
};

export default config;
```

## Usage

### Visual Tests Panel

Once installed and registered, the "Visual tests" panel will be available in your Storybook UI.

1.  Navigate to a story.
2.  Open the "Visual tests" tab in the addons panel.
3.  Click "Run Test" to perform a visual comparison.
    - If it's the first time running the test for this story, a baseline image will be created.
    - If a baseline exists, the current story will be compared against it.
4.  If differences are detected:
    - Review the differences highlighted in the panel.
    - Click "Accept" to update the baseline image with the current version of the story.
5.  Click "Redo" to run the test again at any time.

### Pixel Perfect Tool (Toolbar)

_(Details about the Pixel Perfect tool in the toolbar will be added here once implemented. This tool will help you overlay images for precise comparison.)_

## Configuration (Optional)

_(Details about configuration options can be added here later, such as threshold for Pixelmatch, custom image directory, etc.)_

## Contributing

_(Information about how to contribute to this addon can be added here.)_

## License

_(License information can be added here.)_

### Notes

- vitest is integrated with storybook so we can run visual testing with jest instead?
  https://www.youtube.com/watch?v=8t5wxrFpCQY
  npx storybook add @storybook/addon-vitest
  https://storybook.js.org/docs/writing-tests/integrations/vitest-addon
- I figureout how to integrate preset watching this example https://github.com/repobuddy/visual-testing/blob/main/packages/storybook-addon-vis/.storybook/local-preset.cjs
- inspired by https://github.com/repobuddy/visual-testing

### Next steps

- try to use only playwrite internal libraries for pixel match.
- load image automatically on change between stories
- change size of the image to only size of the component.
- integrate pixel perfect tools https://www.welldonecode.com/perfectpixel/
