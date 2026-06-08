import { uploadMediaFile } from "./uploadMedia";

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
    const { url } = await uploadMediaFile(file, folder);
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
    payload.licenseFrontUrl = (await uploadMediaFile(licenseFiles[0], "drivers/license")).url;
  }
  if (licenseFiles[1] && !payload.licenseBackUrl) {
    payload.licenseBackUrl = (await uploadMediaFile(licenseFiles[1], "drivers/license")).url;
  }

  return payload;
}
