import { pick, types } from "@react-native-documents/picker";
import RNFS from "react-native-fs";
import { Dialog_alert, Dialog_confirm } from "./dialog";

export type IFileImportType = "json" | "csv" | "any";

export async function FileImport_pickFile(fileType: IFileImportType = "any"): Promise<string | undefined> {
  try {
    const acceptedTypes =
      fileType === "csv"
        ? [types.csv, types.plainText]
        : fileType === "json"
          ? [types.json, types.plainText]
          : [types.allFiles];
    const [result] = await pick({ type: acceptedTypes, allowMultiSelection: false });
    if (!result?.uri) {
      return undefined;
    }

    // On Android, content:// URIs from the Downloads provider cannot be read
    // directly by RNFS - we must copy to the app's cache dir first, which uses
    // the ContentResolver with the granted URI permission from ACTION_OPEN_DOCUMENT.
    const uri = result.uri;
    if (uri.startsWith("content://")) {
      const ext = fileType === "csv" ? "csv" : "json";
      const destPath = `${RNFS.CachesDirectoryPath}/liftosaur_import_${Date.now()}.${ext}`;
      await RNFS.copyFile(uri, destPath);
      const content = await RNFS.readFile(destPath, "utf8");
      await RNFS.unlink(destPath).catch(() => undefined); // clean up, ignore errors
      return content;
    }

    // file:// or other URIs - read directly
    return await RNFS.readFile(decodeURIComponent(uri), "utf8");
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err.code === "DOCUMENT_PICKER_CANCELED" || err.code === "OPERATION_CANCELED") {
      return undefined;
    }
    Dialog_alert("Import failed: " + (err.message ?? "Unknown error"));
    return undefined;
  }
}

export async function FileImport_confirm(message: string): Promise<boolean> {
  return Dialog_confirm(message);
}
