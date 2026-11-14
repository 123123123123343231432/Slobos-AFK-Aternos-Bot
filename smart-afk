{
const mc = require('minecraft-protocol')

function randomMs(minMs, maxMs) {
    return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
}

function setupSmartOnlineAfk(bot, createBot, serverConfig) {
    let jumpTimer = null
    let jumpOffTimer = null
    let pingTimer = null
    let stopped = false
    let leftDueToPlayers = false

    function cleanupTimers() {
        if (jumpTimer) clearTimeout(jumpTimer)
        if (jumpOffTimer) clearTimeout(jumpOffTimer)
        if (pingTimer) clearTimeout(pingTimer)
        jumpTimer = jumpOffTimer = pingTimer = null
    }

    function scheduleNextJump() {
        if (stopped || !bot.entity) return

        bot.setControlState('jump', true)
        jumpOffTimer = setTimeout(() => {
            if (bot.entity) bot.setControlState('jump', false)
        }, 300)

        const nextJump = randomMs(20000, 5 * 60 * 1000)
        jumpTimer = setTimeout(scheduleNextJump, nextJump)
    }

    function checkInGamePlayers() {
        if (stopped || !bot.players) return

        const otherPlayers = Object.keys(bot.players).filter(
            (name) => name !== bot.username
        )

        if (otherPlayers.length > 0) {
            leftDueToPlayers = true
            stopped = true
            cleanupTimers()

            try {
                bot.quit()
            } catch (e) {}

            startServerPingLoop()
        }
    }

    function startServerPingLoop() {
        const checkInterval = randomMs(10000, 20000)

        pingTimer = setTimeout(() => {
            mc.ping(
                {
                    host: serverConfig.host,
                    port: serverConfig.port || 25565,
                    version: serverConfig.version || false
                },
                (err, response) => {
                    if (err) {
                        startServerPingLoop()
                        return
                    }

                    const onlineCount = response.players?.online ?? 0

                    if (onlineCount === 0) {
                        cleanupTimers()
                        if (typeof createBot === 'function') {
                            createBot()
                        }
                    } else {
                        startServerPingLoop()
                    }
                }
            )
        }, checkInterval)
    }

    bot.once('spawn', () => {
        stopped = false
        leftDueToPlayers = false
        cleanupTimers()

        scheduleNextJump()
        setTimeout(checkInGamePlayers, 2000)
    })

    bot.on('playerJoined', (player) => {
        if (player.username !== bot.username) {
            checkInGamePlayers()
        }
    })

    bot.on('end', () => {
        cleanupTimers()
        if (!leftDueToPlayers) {
            stopped = true
        }
    })

    bot.on('kicked', () => {
        if (!leftDueToPlayers) cleanupTimers()
    })

    bot.on('error', () => {
        if (!leftDueToPlayers) cleanupTimers()
    })
}

module.exports = setupSmartOnlineAfk
