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

/** Text + background colours for the account status, so riders can tell good from bad at a glance. */
export function driverStatusColors(status: DriverAccountStatus): { text: string; bg: string } {
  switch (status) {
    case "active":
      return { text: "#15803d", bg: "#dcfce7" };
    case "pending":
      return { text: "#b45309", bg: "#fef3c7" };
    case "suspended":
    case "suspended_debt":
      return { text: "#b91c1c", bg: "#fee2e2" };
    default:
      return { text: "#475569", bg: "#f1f5f9" };
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
