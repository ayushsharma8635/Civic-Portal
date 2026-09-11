export function getOfficerSession() {
  try {
    const stored = localStorage.getItem('civic_officer_session');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function setOfficerSession(officer) {
  localStorage.setItem('civic_officer_session', JSON.stringify(officer));
}

export function clearOfficerSession() {
  localStorage.removeItem('civic_officer_session');
}