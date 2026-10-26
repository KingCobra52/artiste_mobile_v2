const WEBKIT_ACCESS_CONTROL_SUFFIX = " due to access control checks.";

export function isWebKitSameOriginRscCancellation({
  message,
  browserName,
  baseURL,
}: {
  message: string;
  browserName: string;
  baseURL: string | undefined;
}) {
  if (
    browserName !== "webkit" ||
    !baseURL ||
    !message.endsWith(WEBKIT_ACCESS_CONTROL_SUFFIX)
  ) {
    return false;
  }

  try {
    const appURL = new URL(baseURL);
    const resource = message.slice(0, -WEBKIT_ACCESS_CONTROL_SUFFIX.length);
    if (!resource.startsWith(`/${appURL.host}/`)) return false;

    const cancelledURL = new URL(`${appURL.protocol}/${resource}`);
    return (
      cancelledURL.origin === appURL.origin &&
      Boolean(cancelledURL.searchParams.get("_rsc"))
    );
  } catch {
    return false;
  }
}
