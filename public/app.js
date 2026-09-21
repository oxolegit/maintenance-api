const API = "/api";
const PAGE_SIZE = 10;
const TRANSITIONS = {
  new: ["in_progress", "rejected"],
  in_progress: ["done", "rejected"],
  done: [],
  rejected: [],
};

const apiKeyInput = document.getElementById("apiKey");
const message = document.getElementById("message");
const createForm = document.getElementById("createForm");
const formErrors = document.getElementById("formErrors");
const filterForm = document.getElementById("filterForm");
const equipmentSelect = document.getElementById("equipmentSelect");
const equipmentFilter = document.getElementById("equipmentFilter");
const tableBody = document.querySelector("#requestsTable tbody");
const empty = document.getElementById("empty");
const pageInfo = document.getElementById("pageInfo");
const prevPage = document.getElementById("prevPage");
const nextPage = document.getElementById("nextPage");

const state = { page: 1, pages: 1, equipment: new Map() };

try {
  apiKeyInput.value = localStorage.getItem("apiKey") ?? "";
} catch {
  // localStorage может быть недоступен — работаем без сохранения ключа
}

apiKeyInput.addEventListener("change", () => {
  try {
    localStorage.setItem("apiKey", apiKeyInput.value);
  } catch {
    // см. выше
  }
});

async function api(path, { method = "GET", body } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET" && apiKeyInput.value) headers["X-API-Key"] = apiKeyInput.value;

  const response = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 204) return null;
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.error?.message ?? `Ошибка ${response.status}`);
    error.details = payload.error?.details ?? [];
    error.requestId = payload.error?.requestId;
    throw error;
  }
  return payload;
}

function showMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle("error", isError);
  message.hidden = !text;
}

function showError(error) {
  const suffix = error.requestId ? ` (requestId: ${error.requestId})` : "";
  showMessage(`${error.message}${suffix}`, true);
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
}

async function loadEquipment() {
  const { data } = await api("/equipment?limit=100&sort=name&order=asc");
  state.equipment = new Map(data.map((item) => [item.id, item]));

  const options = data
    .map((item) => `<option value="${item.id}">${item.name} (${item.serialNumber})</option>`)
    .join("");
  equipmentSelect.innerHTML = options || '<option value="">нет оборудования</option>';
  equipmentFilter.innerHTML = `<option value="">всё</option>${options}`;
}

function buildQuery() {
  const params = new URLSearchParams({ page: state.page, limit: PAGE_SIZE });
  for (const [key, value] of new FormData(filterForm)) {
    if (value) params.set(key, value);
  }
  return params.toString();
}

function renderRow(request) {
  const row = document.createElement("tr");
  const equipment = state.equipment.get(request.equipmentId);
  const cells = [
    request.title,
    equipment ? equipment.name : request.equipmentId,
    request.priority,
    request.status,
    formatDate(request.plannedAt),
    formatDate(request.createdAt),
  ];
  for (const value of cells) {
    const cell = document.createElement("td");
    cell.textContent = value;
    row.appendChild(cell);
  }

  const actions = document.createElement("td");
  actions.className = "row-actions";
  for (const status of TRANSITIONS[request.status] ?? []) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `→ ${status}`;
    button.addEventListener("click", () => changeStatus(request.id, status));
    actions.appendChild(button);
  }
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "danger";
  remove.textContent = "Удалить";
  remove.addEventListener("click", () => removeRequest(request.id));
  actions.appendChild(remove);
  row.appendChild(actions);

  return row;
}

async function loadRequests() {
  const { data, meta } = await api(`/requests?${buildQuery()}`);
  state.pages = Math.max(meta.pages, 1);
  tableBody.replaceChildren(...data.map(renderRow));
  empty.hidden = data.length > 0;
  pageInfo.textContent = `Страница ${meta.page} из ${state.pages}, всего ${meta.total}`;
  prevPage.disabled = meta.page <= 1;
  nextPage.disabled = meta.page >= state.pages;
}

async function refresh() {
  try {
    await loadRequests();
  } catch (error) {
    showError(error);
  }
}

async function changeStatus(id, status) {
  try {
    await api(`/requests/${id}/status`, { method: "PATCH", body: { status } });
    showMessage(`Статус заявки изменён на ${status}`);
    await loadRequests();
  } catch (error) {
    showError(error);
  }
}

async function removeRequest(id) {
  if (!window.confirm("Удалить заявку?")) return;
  try {
    await api(`/requests/${id}`, { method: "DELETE" });
    showMessage("Заявка удалена");
    await loadRequests();
  } catch (error) {
    showError(error);
  }
}

createForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  formErrors.replaceChildren();

  const form = new FormData(createForm);
  const body = {
    equipmentId: form.get("equipmentId"),
    title: form.get("title"),
    description: form.get("description"),
    priority: form.get("priority"),
  };
  if (form.get("plannedAt")) body.plannedAt = new Date(form.get("plannedAt")).toISOString();

  try {
    const { data } = await api("/requests", { method: "POST", body });
    showMessage(`Заявка «${data.title}» создана`);
    createForm.reset();
    state.page = 1;
    await loadRequests();
  } catch (error) {
    showError(error);
    formErrors.replaceChildren(
      ...error.details.map((detail) => {
        const item = document.createElement("li");
        item.textContent = `${detail.field}: ${detail.message}`;
        return item;
      }),
    );
  }
});

filterForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.page = 1;
  refresh();
});

prevPage.addEventListener("click", () => {
  state.page = Math.max(1, state.page - 1);
  refresh();
});

nextPage.addEventListener("click", () => {
  state.page = Math.min(state.pages, state.page + 1);
  refresh();
});

(async () => {
  try {
    await loadEquipment();
    await loadRequests();
  } catch (error) {
    showError(error);
  }
})();
