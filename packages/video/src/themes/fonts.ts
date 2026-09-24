import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadPatrickHand } from "@remotion/google-fonts/PatrickHand";
import { loadFont as loadPoppins } from "@remotion/google-fonts/Poppins";

// Load only the weights/subset we use to keep font network requests small.
const inter = loadInter("normal", { weights: ["400", "600", "700"], subsets: ["latin"] });
const poppins = loadPoppins("normal", { weights: ["600", "700", "800"], subsets: ["latin"] });
const patrick = loadPatrickHand("normal", { weights: ["400"], subsets: ["latin"] });

export const FONTS = {
  inter: inter.fontFamily,
  poppins: poppins.fontFamily,
  patrick: patrick.fontFamily,
} as const;
