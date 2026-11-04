import { isEmailConfigured } from "@agent-native/core/server";
import { createToolkitAuthPlugin } from "@agent-native/toolkit/app/auth/server";

import { buildLandingHtml } from "../lib/landing-html.js";

// The toolkit's auth page can't be restyled by renderSignInPage, so the signed-out page is our
// own document (server/lib/landing-html.ts). "Forgot password" is shown only when an email
// provider is configured; otherwise it would be a dead control.
export default async (nitroApp: any) => {
  let forgotPassword = false;
  try {
    forgotPassword = await isEmailConfigured();
  } catch {
    forgotPassword = false;
  }
  return createToolkitAuthPlugin({
    workspaceAppPublicPaths: ["/"],
    // The published rota: GET only, the unguessable token in the path is the credential.
    // Everything else stays behind sign-in.
    publicPaths: ["/s/:token", "/api/public/schedule/:token"],
    rootAuth: true,
    marketing: false,
    loginHtml: buildLandingHtml({ forgotPassword }),
  })(nitroApp);
};
