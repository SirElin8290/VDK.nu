export function initializeBoardAccess(db){db.exec('CREATE TABLE IF NOT EXISTS board_access(user_id INTEGER PRIMARY KEY REFERENCES users(id),granted_at TEXT NOT NULL,granted_by INTEGER REFERENCES users(id));');}
export const hasBoardAccess=(db,id)=>!!db.prepare('SELECT 1 FROM board_access WHERE user_id=?').get(id);
