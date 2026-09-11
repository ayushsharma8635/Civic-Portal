// Default estimated resolution days per complaint category.
// Admins can override the value on individual complaints (estimated_days field).
export const CATEGORY_RESOLUTION_DAYS = {
  "Road Damage": 5,
  "Garbage Collection": 1,
  "Street Light": 2,
  "Water Leakage": 1,
  "Drainage": 3,
  "Electricity": 2,
  "Stray Animals": 2,
  "Illegal Parking": 1,
  "Public Safety": 2,
  "Other": 3,
};

export function estimateResolutionDays(category) {
  return CATEGORY_RESOLUTION_DAYS[category] ?? 3;
}

export function computeExpectedDate(createdDate, days) {
  const d = new Date(createdDate || Date.now());
  d.setDate(d.getDate() + Number(days || 3));
  return d.toISOString();
}

export function isComplaintDelayed(complaint) {
  if (!complaint || complaint.status === "Resolved" || complaint.status === "Rejected") return false;
  if (!complaint.expected_date) return false;
  return new Date() > new Date(complaint.expected_date);
}

export function formatExpectedResolution(days) {
  if (!days || days <= 0) return "—";
  if (days === 1) return "1 Day";
  return `${days} Days`;
}