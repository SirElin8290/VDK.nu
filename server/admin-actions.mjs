export function canGrantAdmin(user, ownerEmail) {
  return !!ownerEmail && user.roles.includes('ADMIN') && user.email.toLowerCase() === ownerEmail.trim().toLowerCase();
}

export function reactivateMembership(db, id, season, admin, fail, transaction, audit) {
  const membership = db.prepare('SELECT m.*,u.password_hash FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.id=? AND m.season=?').get(id, season);
  if (!membership) fail(404, 'Medlemskapet hittades inte.');
  if (membership.status !== 'expired') fail(409, 'Endast avslutade medlemskap kan återaktiveras.');
  if (!membership.paid || !membership.approved_at || !membership.password_hash || membership.category === 'business') fail(409, 'Återaktivering kräver ett tidigare godkänt och betalt medlemskap med aktiverat konto.');
  transaction(db, () => {
    db.prepare("UPDATE memberships SET status='active' WHERE id=?").run(membership.id);
    audit(db, admin.id, 'membership_reactivated', membership.id);
  });
}

export function grantAdmin(db, id, admin, ownerEmail, season, fail, transaction, audit) {
  if (!canGrantAdmin(admin, ownerEmail)) fail(403, 'Endast kontoägaren kan utse administratörer.');
  if (id === admin.id) fail(400, 'Ändra inte din egen behörighet här.');
  if (!db.prepare('SELECT id FROM users WHERE id=?').get(id)) fail(404, 'Användaren hittades inte.');
  if (!db.prepare("SELECT 1 FROM memberships WHERE user_id=? AND season=? AND status='active' AND paid=1").get(id, season)) fail(409, 'Ett aktivt och betalt medlemskap krävs.');
  transaction(db, () => {
    const result = db.prepare("INSERT OR IGNORE INTO roles VALUES (?,'ADMIN')").run(id);
    if (result.changes) audit(db, admin.id, 'role_ADMIN', id);
  });
}
