// Meltiva app config. Storage mode + auth gate.
// NOTE: This is a client-side gate for a browser-only app. Real auth arrives with Firebase.
export const CONFIG = {
  storage: "local",          // "local" (browser) | "firebase" (added later)
  username: "meltiva",
  // SHA-256 of  username + "::" + password  (password itself is NOT stored)
  passwordHash: "0f8c912ca113263af87102d90083542fd884b0ca06259e0a970015e0be660a43",
  firebase: null,            // dropped in when we wire cloud sync
};
