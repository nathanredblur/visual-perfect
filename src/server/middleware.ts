import express from "express";
import fs from "fs-extra"; // fs-extra has promises and is more convenient
import path from "path";
import { chromium } from "playwright"; // We'll use Chromium by default
import type { Page } from "playwright";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { ADDON_ID, DEFAULT_IMAGES_DIR } from "../constants"; // Assuming constants.ts is one level up

const router = express.Router();

// Add middleware to parse JSON request bodies
router.use(express.json());

export const API_BASE_PATH = "/__visual_perfect_api__"; // Must match the one in PanelContent.tsx (or other client-side fetch)

const BASELINES_DIR = path.resolve(process.cwd(), DEFAULT_IMAGES_DIR);
fs.ensureDirSync(BASELINES_DIR); // Ensure the baselines directory exists

console.log(`[${ADDON_ID}] Baselines directory: ${BASELINES_DIR}`);

/**
 * Helper to build the Storybook story URL.
 */
function getStorybookUrl(storyId: string, port = 6006) {
  // Assumes Storybook runs on localhost:6006. This might need to be configurable.
  return `http://localhost:${port}/iframe.html?id=${storyId}&viewMode=story`;
}

/**
 * Helper to take a screenshot with Playwright.
 */
async function takePlaywrightScreenshot(
  storyId: string,
  attempt = 0,
): Promise<Buffer | null> {
  let browser;
  try {
    console.log(`[${ADDON_ID}] Launching Playwright to capture ${storyId}`);
    browser = await chromium.launch(); // Might need config for CI: { headless: true, args: ['--no-sandbox'] }
    const context = await browser.newContext();
    const page: Page = await context.newPage();
    const storyUrl = getStorybookUrl(storyId);
    console.log(`[${ADDON_ID}] Navigating to ${storyUrl}`);

    await page.goto(storyUrl, { waitUntil: "networkidle" }); // Wait for the network to settle
    // We might need to wait for a specific selector if content loads asynchronously
    // await page.waitForSelector('#storybook-root > *', { state: 'visible' });

    // Short additional wait to ensure everything renders, especially short animations
    await page.waitForTimeout(500);

    console.log(`[${ADDON_ID}] Taking screenshot for ${storyId}`);
    const screenshotBuffer = await page.screenshot();
    console.log(
      `[${ADDON_ID}] Screenshot taken for ${storyId}, size: ${screenshotBuffer.length} bytes`,
    );
    return screenshotBuffer;
  } catch (error: any) {
    console.error(
      `[${ADDON_ID}] Playwright screenshot failed for ${storyId}:`,
      error,
    );
    // Simple retry attempt for network/timing issues
    if (attempt < 1 && error.message.includes("Navigation failed")) {
      console.log(`[${ADDON_ID}] Retrying screenshot for ${storyId}...`);
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2s before retrying
      return takePlaywrightScreenshot(storyId, attempt + 1);
    }
    return null;
  } finally {
    if (browser) {
      await browser.close();
      console.log(`[${ADDON_ID}] Playwright browser closed for ${storyId}`);
    }
  }
}

// Endpoint to run the visual test
router.post("/test", async (req, res) => {
  const { storyId, imageBase64: clientImageBase64 } = req.body;
  console.log(`[${ADDON_ID}] Received /test request for story: ${storyId}`);

  if (!storyId) {
    res.writeHead(400, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ message: "storyId is required" }));
  }

  try {
    const currentImageBuffer = await takePlaywrightScreenshot(storyId);
    if (!currentImageBuffer) {
      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          status: "error",
          message: "Failed to capture current story image with Playwright.",
        }),
      );
    }

    const baselinePath = path.join(BASELINES_DIR, `${storyId}.png`);
    const newImageBase64 = currentImageBuffer.toString("base64");

    if (await fs.pathExists(baselinePath)) {
      console.log(`[${ADDON_ID}] Baseline found for ${storyId}. Comparing...`);
      const baselineImageBuffer = await fs.readFile(baselinePath);

      const baselinePng = PNG.sync.read(baselineImageBuffer);
      const currentPng = PNG.sync.read(currentImageBuffer);
      const { width, height } = baselinePng;

      if (currentPng.width !== width || currentPng.height !== height) {
        console.warn(
          `[${ADDON_ID}] Image dimensions mismatch for ${storyId}. Baseline: ${width}x${height}, Current: ${currentPng.width}x${currentPng.height}. Saving new image.`,
        );
        await fs.writeFile(baselinePath, currentImageBuffer);
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({
            status: "failed",
            message:
              "Image dimensions differ. New image saved as baseline. Please review and accept or re-run.",
            newImage: newImageBase64, // Send the new image to display it
            baselineExists: true,
            // No diffImage because dimensions are different
          }),
        );
      }

      const diffPng = new PNG({ width, height });
      const mismatchedPixels = pixelmatch(
        baselinePng.data,
        currentPng.data,
        diffPng.data,
        width,
        height,
        { threshold: 0.1 },
      );

      if (mismatchedPixels > 0) {
        console.log(
          `[${ADDON_ID}] Differences found for ${storyId}: ${mismatchedPixels} pixels`,
        );
        const diffImagePath = path.join(BASELINES_DIR, `${storyId}.diff.png`);
        await fs.writeFile(diffImagePath, PNG.sync.write(diffPng));
        const diffImageBase64 = PNG.sync.write(diffPng).toString("base64");
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({
            status: "failed",
            message: `Found ${mismatchedPixels} mismatched pixels.`,
            diffImage: `data:image/png;base64,${diffImageBase64}`,
            newImage: `data:image/png;base64,${newImageBase64}`, // The current image that caused the failure
            baselineExists: true,
          }),
        );
      } else {
        console.log(`[${ADDON_ID}] No differences found for ${storyId}.`);
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({
            status: "success",
            message: "No visual changes detected.",
            baselineExists: true,
          }),
        );
      }
    } else {
      console.log(
        `[${ADDON_ID}] No baseline found for ${storyId}. Creating new baseline...`,
      );
      await fs.writeFile(baselinePath, currentImageBuffer);
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          status: "new",
          message: "New baseline image created.",
          newImage: `data:image/png;base64,${newImageBase64}`,
          baselineExists: true, // Now it exists
        }),
      );
    }
  } catch (error: any) {
    // Diagnostic logs removed from here
    console.error(
      `[${ADDON_ID}] Error in /test endpoint for ${storyId}:`,
      error,
    );
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
    }
    return res.end(
      JSON.stringify({
        status: "error",
        message: error.message || "Server error during visual test.",
      }),
    );
  }
});

// Endpoint to accept the new image as baseline
router.post("/accept", async (req, res) => {
  const { storyId, imageBase64 } = req.body;
  console.log(`[${ADDON_ID}] Received /accept request for story: ${storyId}`);

  if (!storyId || !imageBase64) {
    res.writeHead(400, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({ message: "storyId and imageBase64 are required" }),
    );
  }

  try {
    const baselinePath = path.join(BASELINES_DIR, `${storyId}.png`);
    // The base64 image from the panel already has the data:image/png;base64, prefix,
    // or it's the "newImage" that the server sent in /test, which also has the prefix.
    // We need to remove that prefix before saving it.
    let actualBase64Data = imageBase64;
    if (imageBase64.startsWith("data:image/png;base64,")) {
      actualBase64Data = imageBase64.replace("data:image/png;base64,", "");
    }

    await fs.writeFile(baselinePath, Buffer.from(actualBase64Data, "base64"));
    console.log(`[${ADDON_ID}] New baseline accepted and saved for ${storyId}`);

    // Optional: delete the .diff.png image if it exists
    const diffImagePath = path.join(BASELINES_DIR, `${storyId}.diff.png`);
    if (await fs.pathExists(diffImagePath)) {
      await fs.remove(diffImagePath);
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({ status: "success", message: "New baseline accepted." }),
    );
  } catch (error: any) {
    console.error(
      `[${ADDON_ID}] Error in /accept endpoint for ${storyId}:`,
      error,
    );
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
    }
    return res.end(
      JSON.stringify({
        status: "error",
        message: error.message || "Server error accepting baseline.",
      }),
    );
  }
});

// Main middleware to be exported
// This is an Express router. It will need to be used by the Storybook server.
// Example: app.use(API_BASE_PATH, visualPerfectMiddleware);
export const visualPerfectMiddleware = router;

// For this middleware to be usable, we need a way to tell Storybook to use it.
// In Storybook, this can be done in several ways:
// 1. The user creates a `.storybook/middleware.js` file and imports and uses this router.
//    Example in `.storybook/middleware.js`:
//    const { visualPerfectMiddleware } = require('your-addon-name/dist/server/middleware'); // Adjust path
//    module.exports = function (router) {
//      router.use('/__visual_perfect_api__', visualPerfectMiddleware);
//    };
// 2. The addon's preset (`src/preset.ts`) attempts to modify the dev server configuration
//    (Vite or Webpack) to inject this middleware. This is more complex and depends on the SB version.

// For now, we will focus on having the middleware logic here.
// Integration with the Storybook server will be addressed as a separate addon configuration step.
