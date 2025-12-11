const guildPlayers = new Map();

/**
 * Lấy hoặc tạo một music controller cho guild.
 * @param {string} guildId - ID của guild.
 * @returns {object} - Music controller.
 */
function getMusicController(guildId) {
  if (!guildPlayers.has(guildId)) {
    guildPlayers.set(guildId, {
      queue: [],
      player: null,
      connection: null,
      isPlaying: false,
      textChannel: null,
      inactivityTimer: null, // To manage the inactivity timeout
    });
  }
  return guildPlayers.get(guildId);
}

module.exports = { guildPlayers, getMusicController };