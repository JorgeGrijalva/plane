const axios = require("axios");

module.exports = {
  sendAlert: async (message) => {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      console.warn("SLACK_WEBHOOK_URL no está configurado. Mensaje omitido:", message);
      return;
    }
    try {
      await axios.post(webhookUrl, { text: message });
    } catch (error) {
      console.error("Error enviando alerta a Slack:", error.message);
    }
  },
};
