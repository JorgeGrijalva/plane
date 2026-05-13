const planeApi = require("../services/planeApi");
const slackService = require("../services/slackService");

/**
 * Endpoint unificado para Webhooks de Plane.
 * Escucha eventos y delega a los microservicios 2 y 3.
 */
exports.handlePlaneWebhook = async (req, res) => {
  // Respondemos 200 rápido para que Plane no reintente o marque error
  res.status(200).send("OK");

  try {
    const payload = req.body;

    // En Plane, los webhooks de Issue usualmente son 'issue_update' o 'issue_create'
    const eventType = payload.event;

    if (eventType !== "issue_update") {
      return; // Ignoramos otros eventos
    }

    const issue = payload.data;
    const projectId = payload.project?.id || issue.project;
    const issueId = issue.id;

    if (!projectId || !issueId) return;

    // Ejecutar Microservicio 2: RFI & Anomaly Watchdog
    await checkRfiAnomaly(projectId, issue);

    // Ejecutar Microservicio 3: Capture SLA Round-Robin
    await checkCaptureSlaAssignation(projectId, issue);
  } catch (error) {
    console.error("[Webhook Error]", error.message);
  }
};

/**
 * Microservicio 2: RFI & Anomaly Watchdog
 * Revisa si un issue completado supera la fecha límite del ciclo (fase).
 */
async function checkRfiAnomaly(projectId, issue) {
  const isCompleted = issue.state_id === process.env.STATE_COMPLETED_ID || issue.state?.group === "completed";
  const cycleId = issue.cycle_id;

  if (isCompleted && cycleId) {
    const cycle = await planeApi.getCycle(projectId, cycleId);
    if (!cycle || !cycle.end_date) return;

    const cycleEndDate = new Date(cycle.end_date);
    const today = new Date();

    // Comparamos si hoy es posterior a la fecha de término de la fase
    if (today > cycleEndDate) {
      console.log(`[Watchdog] Anomalía detectada en el Issue: ${issue.name}`);

      const anomalyLabelId = process.env.ANOMALY_LABEL_ID;
      if (anomalyLabelId) {
        await planeApi.addLabelToIssue(projectId, issue.id, anomalyLabelId);
      }

      // Base URL asumiendo que PLANE_API_URL es "/api/v1"
      const baseUrl = process.env.PLANE_API_URL.replace("/api/v1", "");
      const issueUrl = `${baseUrl}/${process.env.WORKSPACE_SLUG}/projects/${projectId}/issues/${issue.id}`;

      const msg = `🚨 *ANOMALÍA: Fuera de Tiempo*\nLa pieza/entregable *${issue.name}* fue liberada, pero su fase *${cycle.name}* ya estaba cerrada (Límite: ${cycle.end_date}).\nPosible impacto por RFI tardío.\n🔗 <${issueUrl}|Ver en Plane>`;

      await slackService.sendAlert(msg);
    }
  }
}

/**
 * Microservicio 3: Capture SLA Round-Robin (Asignador Automático)
 * Asigna el issue al capturista con menos carga viva y marca el SLA.
 */
async function checkCaptureSlaAssignation(projectId, issue) {
  const readyForCaptureStateId = process.env.STATE_READY_FOR_CAPTURE_ID;
  const inProgressStateId = process.env.STATE_IN_PROGRESS_ID;

  if (issue.state_id === readyForCaptureStateId) {
    console.log(`[SLA Assignation] Issue ${issue.name} pasó a "Listo para Captura".`);

    const capturaTeamIds = (process.env.CAPTURA_TEAM_USER_IDS || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (capturaTeamIds.length === 0) {
      console.warn("[SLA Assignation] Advertencia: CAPTURA_TEAM_USER_IDS no configurado.");
      return;
    }

    let minWorkload = Infinity;
    let selectedUserId = null;

    // Calcular la carga de trabajo real (Work Items en estado "In Progress")
    const workloadPromises = capturaTeamIds.map(async (userId) => {
      try {
        const workload = await planeApi.getUserWorkload(projectId, userId, inProgressStateId);
        return { userId, workload };
      } catch (err) {
        console.error(`[SLA Assignation] Error leyendo carga del usuario ${userId}:`, err.message);
        return { userId, workload: Infinity };
      }
    });

    const workloads = await Promise.all(workloadPromises);

    for (const { userId, workload } of workloads) {
      if (workload < minWorkload) {
        minWorkload = workload;
        selectedUserId = userId;
      }
    }

    if (selectedUserId) {
      console.log(`[SLA Assignation] Round-Robin seleccionó a ${selectedUserId} (Carga: ${minWorkload})`);

      await planeApi.assignUserToIssue(projectId, issue.id, selectedUserId);

      // Comentario de inicio de SLA
      const timestampStr = new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" });
      const commentHtml = `<p>⏳ <strong>SLA de Captura Iniciado.</strong><br/>Asignado automáticamente por Round-Robin.<br/>Tiempo límite: 24 horas a partir de ${timestampStr}.</p>`;

      await planeApi.createIssueComment(projectId, issue.id, commentHtml);
    }
  }
}
