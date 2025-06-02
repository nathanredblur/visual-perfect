// You can use presets to augment the Storybook configuration
// You rarely want to do this in addons,
// so often you want to delete this file and remove the reference to it in package.json#exports and package.json#bundler.nodeEntries
// Read more about presets at https://storybook.js.org/docs/addons/writing-presets

// Using 'any' for StorybookConfig as well for now to avoid module resolution issues.
import path from "path";
// We'll try to use this type if available after npm install
// import type { StorybookConfig } from "@storybook/types";
import type {
  UserConfig as ViteConfig,
  PluginOption,
  ViteDevServer,
} from "vite";
import type { Configuration as WebpackDevServerConfig } from "webpack-dev-server"; // For devServer types
import type { Express } from "express"; // For devServer.app type

// Helper to import the middleware from its compiled location
const getMiddlewarePath = () => {
  // In an addon development environment (when working in this repo directly),
  // we might want to point to src if using ts-node or similar, or to dist if always building.
  // For a published addon, it will always be from dist.
  // This logic might need adjustment depending on how the addon is tested/run locally.
  try {
    // Attempt to resolve the path of the distributed version
    // This will fail if the addon isn't built, but it's what an end-user would have.
    return require.resolve(
      "storybook-addon-visual-perfect/dist/server/middleware.cjs", // Assuming .cjs for CommonJS output
    );
  } catch (e) {
    // Fallback for local addon development: points to the compiled location within the current project.
    // This assumes you have run `npm run build` to generate the `dist` folder.
    console.warn(
      "Visual Perfect Addon: Could not resolve middleware from node_modules, attempting local dist path.",
    );
    return path.resolve(process.cwd(), "dist/server/middleware.cjs"); // Assuming .cjs
  }
};

export const viteFinal = async (config: any): Promise<any> => {
  const { visualPerfectMiddleware, API_BASE_PATH } = await import(
    getMiddlewarePath()
  );

  const visualPerfectPlugin: PluginOption = {
    name: "storybook-vite-visual-perfect-middleware",
    configureServer(server: ViteDevServer) {
      console.log(
        `[Visual Perfect Addon] Adding middleware to Vite server at ${API_BASE_PATH}`,
      );
      server.middlewares.use(API_BASE_PATH, visualPerfectMiddleware);
    },
  };

  config.plugins = config.plugins || [];
  config.plugins.push(visualPerfectPlugin);
  return config;
};

export const webpackFinal = async (config: any): Promise<any> => {
  const { visualPerfectMiddleware, API_BASE_PATH } = await import(
    getMiddlewarePath()
  );

  // For Webpack 5
  if (config.devServer) {
    const originalSetupMiddlewares = config.devServer.setupMiddlewares;
    config.devServer.setupMiddlewares = (
      middlewares: any[],
      devServer: any,
    ) => {
      if (!devServer || !devServer.app) {
        throw new Error("webpack-dev-server or devServer.app is not defined");
      }
      console.log(
        `[Visual Perfect Addon] Adding middleware to Webpack dev server at ${API_BASE_PATH}`,
      );
      (devServer.app as Express).use(API_BASE_PATH, visualPerfectMiddleware);
      if (originalSetupMiddlewares) {
        return originalSetupMiddlewares(
          middlewares,
          devServer as WebpackDevServerConfig,
        );
      }
      return middlewares;
    };
  }
  return config;
};

// Registers the server middleware.
// Storybook will look for a `middleware.js` (or .ts) file in the specified directory.
// Ensure that the build process compiles this middleware to the correct location.
// By convention, many addons place their server code in a 'server' directory.
// If the middleware is in src/server/middleware.ts, after compiling with tsup (according to your package.json),
// it might be in dist/server/middleware.cjs or similar.
// Let's assume dist/server/middleware.cjs for now.
// The actual property for custom middleware might vary or require a different approach
// depending on the Storybook version and how it handles server addons.
// Storybook 9 introduced changes; the most common way is through `framework` configuration or `configDir/middleware.js`
// For now, we will leave this as a reference and implement it correctly when we create the middleware.
// Storybook does not have a direct `serverMiddleware` property in `StorybookConfig`.
// This is usually handled by configuring the development server (Express) directly.
// For Storybook, this is often done through a `middleware.js` file in the Storybook configuration directory (`.storybook`)
// or via presets that modify the server configuration.

// What we can do in the preset is define an entry for the Node code
// that could configure the middleware if we use an approach that allows it.
// However, the most direct way is to use the `middleware.js` file in the `.storybook` dir,
// or if the framework allows, through `framework.options.builder.viteConfig` or `webpackFinal`.

// For now, this preset will not directly configure the middleware.
// We will do this by creating a .storybook/middleware.js file in the example project
// or when the user uses this addon, we will instruct them to do so.
// But for the addon ITSELF to provide the middleware, we would need a different approach.

// --- REVIEW OF PRESET STRATEGY FOR MIDDLEWARE ---
// The way addons *package* middleware has evolved.
// A common way is for the preset to expose a function that modifies the Express configuration.
// However, with Vite as the default builder in many cases, this changes.

// For now, this `preset.ts` will only ensure that the `bundler` entries in `package.json` are correct
// and that the addon is loaded.
// The middleware configuration will be addressed in the next step (creation of the middleware file and
// how it integrates with Storybook's development server).
// The `nodeEntries` in `package.json` already points to `src/preset.ts`, which is correct.
