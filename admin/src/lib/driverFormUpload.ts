import { uploadMediaFile } from "./uploadMedia";
import { isImageFile } from "./mediaLimits";
import { IMAGE_SHAPES, loadImage, prepareImage } from "./prepareImage";

/** Shrink photos (never PDFs) so phone-camera shots fit the upload limit. Documents keep the whole page. */
async function uploadShrunk(file: File, folder: string) {
  if (!isImageFile(file) || file.type === "application/pdf") return uploadMediaFile(file, folder);
  const shape = folder === "drivers/profile" ? IMAGE_SHAPES.profile : IMAGE_SHAPES.document;
  return uploadMediaFile(await prepareImage(await loadImage(file), shape, undefined, file.name), folder);
}

const SINGLE_FILE_FIELDS = [
  { input: "profileImage", urlKey: "profileImageUrl", folder: "drivers/profile" },
  { input: "licenseFront", urlKey: "licenseFrontUrl", folder: "drivers/license" },
  { input: "licenseBack", urlKey: "licenseBackUrl", folder: "drivers/license" },
  { input: "nationalId", urlKey: "nationalIdUrl", folder: "drivers/documents" },
  { input: "policeClearance", urlKey: "policeClearanceUrl", folder: "drivers/documents" },
  { input: "registration", urlKey: "registrationDocUrl", folder: "drivers/vehicle" },
  { input: "insurance", urlKey: "insuranceDocUrl", folder: "drivers/vehicle" },
] as const;

async function uploadIfPresent(
  formData: FormData,
  inputName: string,
  folder: string
): Promise<string | undefined> {
  const file = formData.get(inputName);
  if (file instanceof File && file.size > 0) {
    const { url } = await uploadShrunk(file, folder);
    return url;
  }
  return undefined;
}

/**
 * Read form text fields and upload any selected files via /media/upload.
 * Returns a JSON-ready payload for POST /drivers/register or PATCH /drivers/:id.
 */
export async function buildDriverPayloadFromForm(
  form: HTMLFormElement
): Promise<Record<string, string>> {
  const formData = new FormData(form);
  const payload: Record<string, string> = {};

  for (const [key, value] of formData.entries()) {
    if (value instanceof File) continue;
    payload[key] = String(value);
  }

  for (const field of SINGLE_FILE_FIELDS) {
    const url = await uploadIfPresent(formData, field.input, field.folder);
    if (url) payload[field.urlKey] = url;
  }

  const licenseFiles = formData
    .getAll("license")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (licenseFiles[0] && !payload.licenseFrontUrl) {
    payload.licenseFrontUrl = (await uploadShrunk(licenseFiles[0], "drivers/license")).url;
  }
  if (licenseFiles[1] && !payload.licenseBackUrl) {
    payload.licenseBackUrl = (await uploadShrunk(licenseFiles[1], "drivers/license")).url;
  }

  return payload;
}
