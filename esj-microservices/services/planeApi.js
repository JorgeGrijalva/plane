const axios = require("axios");

const planeClient = axios.create({
  baseURL: `${process.env.PLANE_API_URL}/workspaces/${process.env.WORKSPACE_SLUG}`,
  headers: {
    "x-api-key": process.env.PLANE_API_KEY,
    "Content-Type": "application/json",
  },
});

module.exports = {
  // Crear un Proyecto
  createProject: async (data) => {
    const response = await planeClient.post(`/projects/`, data);
    return response.data;
  },

  // Crear un Cycle (Fase) en un Proyecto
  createCycle: async (projectId, data) => {
    const response = await planeClient.post(`/projects/${projectId}/cycles/`, data);
    return response.data;
  },

  // Obtener un Cycle por su ID
  getCycle: async (projectId, cycleId) => {
    const response = await planeClient.get(`/projects/${projectId}/cycles/${cycleId}/`);
    return response.data;
  },

  // Asignar etiqueta a un Work Item (Issue)
  addLabelToIssue: async (projectId, issueId, labelId) => {
    // Para agregar un label en Plane, usualmente se actualiza el array de label_ids
    const issueResponse = await planeClient.get(`/projects/${projectId}/issues/${issueId}/`);
    const currentLabels = issueResponse.data.label_ids || [];

    if (!currentLabels.includes(labelId)) {
      currentLabels.push(labelId);
      const updateResponse = await planeClient.patch(`/projects/${projectId}/issues/${issueId}/`, {
        label_ids: currentLabels,
      });
      return updateResponse.data;
    }
    return issueResponse.data;
  },

  // Obtener la carga de trabajo de un usuario (Issues en estado específico)
  getUserWorkload: async (projectId, userId, inProgressStateId) => {
    // Filtrar issues por usuario asignado y estado In Progress
    const response = await planeClient.get(`/projects/${projectId}/issues/`, {
      params: {
        assignees: userId,
        state_id: inProgressStateId,
      },
    });
    // Plane devuelve los results en un array 'results'
    const results = response.data.results || response.data || [];
    return results.length;
  },

  // Asignar un usuario a un Issue
  assignUserToIssue: async (projectId, issueId, userId) => {
    const issueResponse = await planeClient.get(`/projects/${projectId}/issues/${issueId}/`);
    const currentAssignees = issueResponse.data.assignee_ids || issueResponse.data.assignees || [];

    if (!currentAssignees.includes(userId)) {
      currentAssignees.push(userId);
      // Actualizamos los assignees
      const updateResponse = await planeClient.patch(`/projects/${projectId}/issues/${issueId}/`, {
        assignee_ids: currentAssignees, // En v1 suele ser assignee_ids
      });
      return updateResponse.data;
    }
    return issueResponse.data;
  },

  // Crear comentario en el Issue con formato HTML
  createIssueComment: async (projectId, issueId, commentHtml) => {
    const response = await planeClient.post(`/projects/${projectId}/issues/${issueId}/comments/`, {
      comment_html: commentHtml,
    });
    return response.data;
  },
};
