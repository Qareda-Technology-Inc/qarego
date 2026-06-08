/** In-memory on-duty riders (socketId + coords). Shared by sockets and offer broadcast. */
const onDutyRiders = new Map();

export function setOnDutyRider(riderId, data) {
  onDutyRiders.set(String(riderId), data);
}

export function deleteOnDutyRider(riderId) {
  onDutyRiders.delete(String(riderId));
}

export function hasOnDutyRider(riderId) {
  return onDutyRiders.has(String(riderId));
}

export function updateOnDutyRiderCoords(riderId, coords) {
  const entry = onDutyRiders.get(String(riderId));
  if (entry) entry.coords = coords;
}

export function getOnDutyRiderIds() {
  return Array.from(onDutyRiders.keys());
}

export function getOnDutyRider(riderId) {
  return onDutyRiders.get(String(riderId));
}

export function getOnDutyRidersEntries() {
  return Array.from(onDutyRiders.entries());
}

export default onDutyRiders;
