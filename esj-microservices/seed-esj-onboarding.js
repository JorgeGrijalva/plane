require("dotenv").config();
const axios = require("axios");

const PLANE_API_URL = process.env.PLANE_API_URL || "http://localhost:3000/api/v1";
const WORKSPACE_SLUG = process.env.WORKSPACE_SLUG || "esj";
const API_KEY = process.env.PLANE_API_KEY;

const planeClient = axios.create({
  baseURL: `${PLANE_API_URL}/workspaces/${WORKSPACE_SLUG}`,
  headers: {
    "x-api-key": API_KEY,
    "Content-Type": "application/json",
  },
});

async function runSeed() {
  console.log("🌱 Iniciando script de semilla (Sandbox ESJ)...");

  try {
    // 1. Crear el Proyecto "EAA-00-ENTRENAMIENTO"
    console.log("Creando Proyecto EAA-00-ENTRENAMIENTO...");
    const suffix = Math.floor(Math.random() * 100);
    const projectResponse = await planeClient.post(`/projects/`, {
      name: "EAATest " + suffix,
      identifier: "EAAT" + suffix,
      description: "Proyecto de Entrenamiento",
      network: 2,
    });

    const projectId = projectResponse.data.id;
    console.log(`✅ Proyecto creado. ID: ${projectId}`);

    // 2. Crear la Fase "FB_PRUEBA" (Caduca Hoy)
    console.log("Creando Fase FB_PRUEBA...");
    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - 7); // Empezó hace 7 días

    const cycleResponse = await planeClient.post(`/projects/${projectId}/cycles/`, {
      project: projectId,
      name: "FB_PRUEBA",
      start_date: startDate.toISOString().split("T")[0],
      end_date: today.toISOString().split("T")[0],
      description: "Esta fase caduca HOY. Si se entregan piezas mañana, marcará anomalía.",
    });

    const cycleId = cycleResponse.data.id;
    console.log(`✅ Fase creada. ID: ${cycleId}`);

    // 3. Crear 3 Productos de Prueba
    const productos = [
      "Columna de Prueba - Modifica mi estatus a RFI",
      "Ancla Principal - Pásame a Terminado",
      "Viga Secundaria - Intenta cambiar mis fechas",
    ];

    await Promise.all(
      productos.map(async (producto, i) => {
        console.log(`Creando Producto: ${producto}...`);
        const issueResponse = await planeClient.post(`/projects/${projectId}/issues/`, {
          name: producto,
          description_html: `<p>Este es un producto de prueba. Juega con los estatus para ver cómo reacciona el sistema y los SLAs.</p>`,
        });

        const issueId = issueResponse.data.id;

        // Asignar el producto a la fase
        await planeClient.post(`/projects/${projectId}/cycles/${cycleId}/cycle-issues/`, {
          issues: [issueId],
        });

        console.log(`✅ Producto ${i + 1} creado y asignado a la fase.`);
      })
    );

    console.log("🎉 ¡Entorno de Sandbox ESJ creado con éxito!");
    console.log("👉 Ingresa a la interfaz y busca el proyecto EAA-00-ENTRENAMIENTO.");
  } catch (error) {
    console.error("❌ Error creando el entorno de pruebas:");
    console.error(error.response ? error.response.data : error.message);
  }
}

runSeed();
