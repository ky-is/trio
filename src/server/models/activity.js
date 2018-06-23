const db = require.main.require('./helpers/db')

module.exports = {

	create (user, data) {
		data.user_id = user.id
		return db.one('INSERT INTO user_activities(${this:name}) VALUES(${this:csv}) RETURNING id', data)
	},

	update (id, body) {
		return db.oneOrNone(`UPDATE user_activities SET body = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING 1`, [ id, body ])
	},

	latest () {
		return db.manyOrNone(`SELECT id, user_id, body, created_at, updated_at, target_id, target_type, reply_id, action FROM user_activities ORDER BY updated_at DESC LIMIT 100`)
	},

	delete (id) {
		return db.oneOrNone(`DELETE FROM user_activities WHERE id = $1`, id)
	},

}
