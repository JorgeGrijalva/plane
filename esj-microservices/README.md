# Guía de Implementación ESJ - Plane.so Microservicios

Esta guía documenta la implementación de la capa intermedia (microservicios en Node.js) que integra los flujos operativos de la División de Acero Estructural de ESJ entre SAP y Plane.so.

## Resumen de la Solución

Se han desarrollado tres microservicios principales para cumplir con las reglas de negocio de ESJ, los cuales corren dentro de un servidor Express local o en la nube:

1. **Microservicio 1: SAP-to-Plane Sync (Endpoint API)**
   Recibe JSONs (por ejemplo, desde llamadas HTTP posteadas por SAP PI/PO o scripts puente) para crear Proyectos (Proyectos SAP) y Ciclos (Fases SAP / PEP).
2. **Microservicio 2: RFI & Anomaly Watchdog (Webhook Listener)**
   Escucha actualizaciones de tareas ("Work Items") y vigila si la fecha de término de un elemento ocurre posterior a la fecha de corte administrativo de la Fase. Avisa en Slack/Teams con una etiqueta roja.
3. **Microservicio 3: Capture SLA Round-Robin (Webhook Listener)**
   Actúa sobre el estado "Listo para Captura", buscando al usuario del equipo de captura con menor carga activa de trabajo, lo asigna automáticamente, y registra el timestamp de inicio del SLA de 24 horas.

---

## 🚀 1. Instalación y Puesta en Marcha

Los archivos se han generado en la carpeta `esj-microservices` de tu repositorio local. Para iniciarlo:

1. Abre tu terminal y ve a la carpeta:
   ```bash
   cd /Users/arturo/Documents/Github/plane/esj-microservices
   ```
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Copia el archivo de configuración base:
   ```bash
   cp .env.example .env
   ```
4. Edita el archivo `.env` rellenando los datos (API Key, UUIDs).
5. Corre el servicio:
   ```bash
   npm run dev
   ```

_(El servidor levantará por default en `http://localhost:4000`)_

---

## ⚙️ 2. Configuración en Plane.so

### A. Webhooks

Para que los Microservicios 2 y 3 funcionen, Plane.so debe mandar un evento cuando ocurre una actualización en las tareas.

1. Ve a los **Settings** de tu Workspace de ESJ (`http://localhost:3000/esj/settings`).
2. Ve a la sección **Webhooks** y da clic en _Add Webhook_.
3. **URL**: `http://tu_ip_o_ngrok:4000/api/plane/webhook`
   _(Si estás testeando localmente en la misma máquina, usa tu IP de red local o localhost si el docker está expuesto)._
4. **Events**: Selecciona **Issue Updated** (o "Item Updates" en la UI moderna de Plane).
5. Guarda el Webhook.

### B. Mapeo de Identificadores (UUIDs)

Para que el script funcione, debes encontrar los **IDs** internos de Plane y agregarlos a tu `.env`. Puedes usar la pestaña de Network del inspector web en Plane.so (F12) o consultar la base de datos para obtener:

- **`STATE_READY_FOR_CAPTURE_ID`**: El ID del estado "05 Terminado / Listo para Captura".
- **`STATE_IN_PROGRESS_ID`**: El ID del estado "03 En proceso".
- **`STATE_COMPLETED_ID`**: El ID del estado o de tu workflow group de "Completado".
- **`ANOMALY_LABEL_ID`**: Crea un label en Plane llamado "ANOMALÍA: Fuera de Tiempo" con color rojo, y copia su ID.
- **`CAPTURA_TEAM_USER_IDS`**: Los IDs (uuid) de los usuarios que procesan capturas.

---

## 🛠️ 3. Pruebas de Funcionamiento

### Prueba MS1: Sincronización desde SAP (POST)

Envía este curl para simular que SAP libera un proyecto nuevo:

```bash
curl -X POST http://localhost:4000/api/sap/sync \
-H "Content-Type: application/json" \
-d '{
  "tipo": "PROYECTO",
  "proyecto_sap": "EA-25-832",
  "nombre": "Estructura Nave MTY"
}'
```

Y este para liberar Fases:

```bash
curl -X POST http://localhost:4000/api/sap/sync \
-H "Content-Type: application/json" \
-d '{
  "tipo": "FASES",
  "plane_project_id": "uuid-del-proyecto-creado",
  "fases": [
    { "codigo": "FB_01", "nombre": "Estructura Base", "fecha_inicio": "2026-05-01", "fecha_fin": "2026-06-01" }
  ]
}'
```

### Prueba MS2 y MS3: SLA y Watchdog

1. Desde la UI de Plane, entra a un proyecto.
2. Mueve una tarea a "Listo para Captura" (esto lanzará el webhook).
3. Verás en la consola de Node el log: `[SLA Assignation] Issue XXX pasó a Listo para captura...`
4. Revisa la tarea, deberá estar asignada y con un comentario automático.

Para la anomalía (MS2): Mueve una tarea a Completado en un Ciclo que haya vencido "ayer" y verás la alerta en Slack y la etiqueta aplicada.
