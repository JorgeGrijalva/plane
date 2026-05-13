const planeApi = require("../services/planeApi");

/**
 * Microservicio 1: SAP-to-Plane Sync
 * Endpoint: POST /api/sap/sync
 *
 * Payload esperado para nuevo proyecto:
 * {
 *   "tipo": "PROYECTO",
 *   "proyecto_sap": "EA-25-832",
 *   "nombre": "Nave Industrial Monterrey"
 * }
 *
 * Payload esperado para liberación de fases (CJBTN):
 * {
 *   "tipo": "FASES",
 *   "plane_project_id": "uuid-del-proyecto-en-plane",
 *   "fases": [
 *     { "codigo": "FB_01", "nombre": "Estructura Base", "fecha_inicio": "2026-05-01", "fecha_fin": "2026-06-01" }
 *   ]
 * }
 */
exports.handleSapNotification = async (req, res) => {
  try {
    const { tipo, proyecto_sap, nombre, fases, plane_project_id } = req.body;

    if (tipo === "PROYECTO") {
      if (!proyecto_sap) return res.status(400).json({ error: "Falta proyecto_sap" });

      console.log(`[SAP Sync] Creando proyecto en Plane para SAP: ${proyecto_sap}`);

      const newProject = await planeApi.createProject({
        name: `${proyecto_sap} - ${nombre || "Sin nombre"}`,
        identifier: proyecto_sap
          .replace(/[^A-Za-z0-9]/g, "")
          .substring(0, 5)
          .toUpperCase(),
        description: `Proyecto sincronizado desde SAP. ID Original: ${proyecto_sap}`,
        network: 2, // 2 = Public (o según políticas de tu workspace)
      });

      return res.status(201).json({ message: "Proyecto creado", project: newProject });
    }

    if (tipo === "FASES") {
      if (!plane_project_id) return res.status(400).json({ error: "Falta plane_project_id" });

      console.log(`[SAP Sync] Creando ${fases.length} ciclos para el proyecto ${plane_project_id}`);

      const cyclePromises = fases.map((fase) =>
        planeApi.createCycle(plane_project_id, {
          name: `${fase.codigo} - ${fase.nombre}`,
          start_date: fase.fecha_inicio,
          end_date: fase.fecha_fin,
          description: `Fase sincronizada desde SAP CJBTN.`,
        })
      );

      const createdCycles = await Promise.all(cyclePromises);

      return res.status(201).json({ message: "Fases/Ciclos creados", cycles: createdCycles });
    }

    res.status(400).json({ error: "Tipo de sincronización no válido (use PROYECTO o FASES)" });
  } catch (error) {
    console.error("[SAP Sync Error]", error.response?.data || error.message);
    res.status(500).json({ error: "Error interno del servidor", details: error.response?.data });
  }
};
