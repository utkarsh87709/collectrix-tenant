// The backend's getAllRole does not return roleDescription and there is no
// get-by-id endpoint, so we cache descriptions locally keyed by the role name
// (role names are unique and enforced by the backend). This lets the edit form
// prefill the description for roles created/edited through this UI.
const KEY = "collectrix.roleDescriptions";

function readAll(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

export function getRoleDescription(roleName: string): string {
  return readAll()[roleName] ?? "";
}

export function setRoleDescription(roleName: string, description: string, previousName?: string): void {
  try {
    const all = readAll();
    if (previousName && previousName !== roleName) delete all[previousName];
    all[roleName] = description;
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}
