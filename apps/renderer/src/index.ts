import { APP_NAME } from "@wordcast/shared";
import { videoDimensions } from "@wordcast/video";

/**
 * Renderer worker entrypoint (placeholder).
 * The full poll/claim/TTS/render/upload loop is built in M6.
 */
function main(): void {
  console.log(
    `${APP_NAME} renderer worker — target ${videoDimensions.width}x${videoDimensions.height}@${videoDimensions.fps} (not yet implemented)`,
  );
}

main();
