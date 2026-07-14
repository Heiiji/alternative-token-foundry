/**
 * GM authority election. When several GMs are connected, exactly one must process
 * relayed requests to avoid duplicate updates. The election is deterministic
 * (lowest active-GM id wins) so every client agrees without any coordination.
 */

/**
 * PURE: elect the primary GM from a list of users.
 * @param {Array<{id:string, active:boolean, isGM:boolean}>} users
 * @returns {string | null}  id of the primary GM, or null if no GM is active.
 */
export function electPrimaryGM(users) {
  const gms = (users ?? []).filter((u) => u && u.active && u.isGM);
  if (gms.length === 0) return null;
  return gms.map((u) => u.id).sort((a, b) => String(a).localeCompare(String(b)))[0];
}

/** Runtime: id of the current primary active GM (or null). */
export function getPrimaryActiveGMId() {
  const users = typeof game !== "undefined" ? Array.from(game.users ?? []) : [];
  return electPrimaryGM(users);
}

/** Runtime: is *this* client the authoritative GM? */
export function isPrimaryActiveGM() {
  const uid = typeof game !== "undefined" ? game.user?.id : null;
  return !!uid && getPrimaryActiveGMId() === uid;
}
