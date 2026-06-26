export type DriverAccountStatus =
  | "pending"
  | "active"
  | "suspended"
  | "suspended_debt"
  | string;

export function getDriverAccountStatus(user: {
  driverDetails?: { status?: string };
} | null): DriverAccountStatus {
  return user?.driverDetails?.status ?? "pending";
}

/** Courier can submit vehicle + docs while awaiting admin approval. */
export function isDriverPendingApproval(
  user: { driverDetails?: { status?: string } } | null
): boolean {
  const status = getDriverAccountStatus(user);
  return status === "pending" || !user?.driverDetails;
}

export function canCourierEditVehicle(
  user: { driverDetails?: { status?: string } } | null
): boolean {
  return isDriverPendingApproval(user);
}

export function canCourierEditDocuments(
  user: { driverDetails?: { status?: string } } | null
): boolean {
  return isDriverPendingApproval(user);
}

export function canCourierGoOnDuty(
  user: { driverDetails?: { status?: string } } | null
): boolean {
  return getDriverAccountStatus(user) === "active";
}

export function driverStatusLabel(status: DriverAccountStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "pending":
      return "Pending approval";
    case "suspended":
      return "Suspended";
    case "suspended_debt":
      return "Suspended (debt)";
    default:
      return status;
  }
}

export function vehicleCategoryLabel(category?: string | null): string {
  switch (category) {
    case "motorcycle":
      return "Motorcycle";
    case "pragya":
      return "Pragya";
    case "comfort":
      return "Comfort";
    default:
      return category ? String(category) : "Not assigned";
  }
}
