import { createToolkitAuthPlugin } from "@agent-native/toolkit/app/auth/server";

export default createToolkitAuthPlugin({
  workspaceAppPublicPaths: ["/"],
  // The published rota: GET only, the unguessable token in the path is the credential.
  // Everything else stays behind sign-in.
  publicPaths: ["/s/:token", "/api/public/schedule/:token"],
  rootAuth: true,
  marketing: false,
});
