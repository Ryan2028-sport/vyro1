// Despia native bridge wrapper for Vyro.
// Exposes a typed helper around the `despia-native` SDK plus a `isNative` flag
// so calls become safe no-ops in regular browsers.

import despia from "despia-native";

export const isNative =
  typeof navigator !== "undefined" &&
  /despia/i.test(navigator.userAgent || "");

/** Fire-and-forget a despia:// command. No-op outside the native runtime. */
export async function run(command: string): Promise<void> {
  if (!isNative) return;
  try {
    await despia(command);
  } catch (err) {
    console.warn("[despia] command failed:", command, err);
  }
}

/** Run a command and wait for the given response variables. */
export async function runWatch<T = Record<string, unknown>>(
  command: string,
  watch: string[],
): Promise<T | null> {
  if (!isNative) return null;
  try {
    return (await despia<T>(command, watch)) as T;
  } catch (err) {
    console.warn("[despia] watch command failed:", command, err);
    return null;
  }
}

// --- Convenience APIs (only the high-value surface; extend as needed) ---

export const haptics = {
  light: () => run("lighthaptic://"),
  heavy: () => run("heavyhaptic://"),
  success: () => run("successhaptic://"),
  warning: () => run("warninghaptic://"),
  error: () => run("errorhaptic://"),
};

export const biometrics = {
  /** Prompt Face ID / Touch ID. Resolves true if the user authenticated. */
  async prompt(reason = "Authenticate"): Promise<boolean> {
    if (!isNative) return true; // allow in browser dev
    const res = await runWatch<{ bioAuthSuccess?: string }>(
      `bioauth://?reason=${encodeURIComponent(reason)}`,
      ["bioAuthSuccess"],
    );
    return res?.bioAuthSuccess === "true";
  },
};

export const share = (message: string, url: string) =>
  run(
    `shareapp://message?=${encodeURIComponent(message)}&url=${encodeURIComponent(url)}`,
  );

export const saveImage = (url: string) =>
  run(`savethisimage://?url=${encodeURIComponent(url)}`);

export const statusBar = {
  color: (hex: string) => run(`statusbarcolor://{${hex}}`),
  textColor: (mode: "light" | "dark") => run(`statusbartextcolor://{${mode}}`),
  hide: () => run("hidebars://on"),
  show: () => run("hidebars://off"),
};

export const appInfo = () =>
  runWatch<{ versionNumber: string; bundleNumber: string }>(
    "getappversion://",
    ["versionNumber", "bundleNumber"],
  );

export const deviceUuid = () =>
  runWatch<{ uuid: string }>("get-uuid://", ["uuid"]);

export const push = {
  register: () => run("registerpush://"),
  playerId: () =>
    runWatch<{ onesignalPlayerId: string }>("getonesignalplayerid://", [
      "onesignalPlayerId",
    ]),
  localMessage: (msg: string) =>
    run(`sendlocalpushmsg://${encodeURIComponent(msg)}`),
};

export const location = {
  backgroundOn: () => run("backgroundlocationon://"),
  backgroundOff: () => run("backgroundlocationoff://"),
};

export const purchases = {
  buy: (productId: string, externalId: string) =>
    runWatch<{ purchaseResult: string; transactionID: string }>(
      `revenuecat://purchase?external_id=${encodeURIComponent(externalId)}&product=${encodeURIComponent(productId)}`,
      ["purchaseResult", "transactionID"],
    ),
};

export { despia };
export default despia;
