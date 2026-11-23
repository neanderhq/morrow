export async function copyTextToClipboard(
  text: string,
  clipboard?: Pick<Clipboard, "writeText">,
  documentRef?: Document,
) {
  try {
    let clipboardApi = clipboard;
    let activeDocument = documentRef;
    if (!clipboardApi && typeof navigator !== "undefined") clipboardApi = navigator.clipboard;
    if (clipboardApi) {
      try {
        await clipboardApi.writeText(text);
        return true;
      } catch {
        clipboardApi = undefined;
      }
    }
    if (!activeDocument && typeof document !== "undefined") activeDocument = document;
    if (!activeDocument?.body || typeof activeDocument.execCommand !== "function") return false;

    let field: HTMLTextAreaElement | undefined;
    try {
      field = activeDocument.createElement("textarea");
      field.value = text;
      field.setAttribute("readonly", "");
      field.setAttribute("aria-hidden", "true");
      field.style.position = "fixed";
      field.style.opacity = "0";
      activeDocument.body.appendChild(field);
      field.select();
      field.setSelectionRange(0, text.length);
      return activeDocument.execCommand("copy");
    } catch {
      return false;
    } finally {
      try {
        field?.remove();
      } catch {
        return false;
      }
    }
  } catch {
    return false;
  }
}
