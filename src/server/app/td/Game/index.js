const { TESTING } = require.main.require('../common/constants')

const { uid } = require.main.require('./helpers/util')

const { TICK_DURATION, UPDATE_DURATION } = require('./config')

const Player = require('./Player')

//CONSTRUCTOR

const games = []

class Game {

	constructor (io) {
		this.players = []
		this.id = uid()
		this.io = io.to(this.id)
		this.state = 'open'
		this.playing = false
		this.serverUpdate = 0
		this.idleCount = 0
		this.updatesUntilStart = (TESTING ? 2 : 15) * 1000 / UPDATE_DURATION

		this.waves = 3 //SAMPLE
		this.wavesFinished
		this.waveNumber = 0
		this.waveCheck = 1
		this.sendWaveResult = true
		this.duration = 0

		this.creepMode = null
		this.towerMode = null
		this.sellMode = null

		console.log(new Date().toLocaleTimeString(), this.id, 'TD created')
		games.push(this)
	}

//PRIVATE

	playerById (id) {
		for (const player of this.players) {
			if (player.user.id === id) {
				return player
			}
		}
		return null
	}

	playerIndexOf (id) {
		const players = this.players
		for (let idx = 0; idx < players.length; idx += 1) {
			const player = players[idx]
			if (player.user.id === id) {
				return idx
			}
		}
		return null
	}

	playerCount () {
		return this.players.length
	}

	activePlayerCount () {
		let result = 0
		for (const player of this.players) {
			if (player.joined) {
				result += 1
			}
		}
		return result
	}

//JOIN

	formattedPlayers () {
		const broadcastPlayers = []
		for (const player of this.players) {
			broadcastPlayers.push({
				id: player.user.id,
				name: player.user.name,
			})
		}
		return broadcastPlayers
	}

	ready (socket) {
		if (this.playing || !socket.player) {
			return
		}
		console.log(new Date().toLocaleTimeString(), this.id, 'TD started')
		socket.player.ready = true
		for (const player of this.players) {
			if (!player.ready) {
				return
			}
		}
		this.state = 'started'
		this.playing = true
		this.waveNumber = 1
		this.broadcast('start game', {
			gid: this.id,
			players: this.formattedPlayers(),
			tickDuration: TICK_DURATION,
			updateDuration: UPDATE_DURATION,
			updatesUntilStart: this.updatesUntilStart,
			waves: this.waves,
			creepMode: this.creepMode,
			towerMode: this.towerMode,
			sellMode: this.sellMode,
		})
	}

	add (socket) {
		const user = socket.user
		const pid = user.id
		let data
		let player = this.playerById(pid)
		if (player) {
			player.joined = true
			socket.player = player
			this.broadcast('update player', { pid, joined: true })
			data = {
				gid: this.id,
				players: this.formattedPlayers(),
				tickDuration: TICK_DURATION,
				updateDuration: UPDATE_DURATION,
				updatesUntilStart: this.updatesUntilStart,
				// history: this.history, //TODO
			}
			console.log('Rejoin game', this.id, user.id)
		} else {
			if (this.playing) {
				return socket.emit('joined game', { error: `Already playing ${this.id}` })
			}
			player = new Player(socket, user)
			this.players.push(player)
			data = { gid: this.id }
		}
		socket.game = this
		socket.player = player
		socket.join(this.id, () => {
			socket.emit('joined game', data)
		})
	}

//LEAVE

	checkFinished () {
		for (const player of this.players) {
			if (player.joined && !player.lost && (!this.wavesFinished || !player.finished)) {
				return false
			}
		}
		this.finish()
	}

	finish () {
		if (this.finished) {
			return console.log('Game already finished')
		}
		console.log(new Date().toLocaleTimeString(), this.id, 'TD finished')
		this.state = 'finished'
		this.finished = true
	}

	destroy () {
		for (const player of this.players) {
			const socket = player.socket
			if (socket) {
				socket.leave(this.id)
				if (socket.game === this) {
					socket.game = null
					socket.player = null
				}
			}
		}

		for (let idx = games.length - 1; idx >= 0; idx -= 1) {
			if (this === games[idx]) {
				games.splice(idx, 1)
				return console.log(new Date().toLocaleTimeString(), this.id, 'TD removed')
			}
		}
		console.log('ERR unable to remove deleted game', this.id)
	}

	remove (socket) {
		const pid = socket.user.id
		const leaveIndex = this.playerIndexOf(pid)
		if (leaveIndex !== null) {
			if (this.playing) {
				const player = this.players[leaveIndex]
				player.joined = false
			} else {
				this.players.splice(leaveIndex, 1)
			}

			if (this.activePlayerCount() <= 0) {
				this.destroy()
				return true
			}
			socket.game = null
			socket.player = null
			this.broadcast('update player', { pid, joined: false })
		}
	}

	broadcast (name, message) {
		this.io.emit(name, message)
	}

}

Game.all = games

Game.getList = function () {
	const result = []
	for (let idx = games.length - 1; idx >= 0; idx -= 1) {
		const game = games[idx]
		result.push({
			id: game.id,
			players: game.formattedPlayers(),
			state: game.state,
			update: game.serverUpdate,
		})
	}
	return result
}

module.exports = Game