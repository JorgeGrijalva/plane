require("dotenv").config();
const express = require("express");
const app = express();

app.use(express.json());

const sapSyncController = require("./controllers/sapSyncController");
const webhookController = require("./controllers/webhookController");

// Microservicio 1: SAP-to-Plane Sync
// Recibe eventos desde SAP para crear proyectos o fases
app.post("/api/sap/sync", sapSyncController.handleSapNotification);

// Microservicios 2 y 3: Webhooks de Plane
// Escucha el evento 'issue_update' de Plane
app.post("/api/plane/webhook", webhookController.handlePlaneWebhook);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 ESJ Plane Microservices running on port ${PORT}`);
});
