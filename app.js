const STORAGE_KEY = 'tablero-tareas';
const THEME_KEY = 'tablero-tema';
const STATUSES = ['pendiente', 'en-proceso', 'terminada'];

const form = document.getElementById('task-form');
const columns = document.querySelectorAll('.column');

let tasks = loadTasks();

/* ================= Tema claro / oscuro ================= */

const themeToggle = document.getElementById('theme-toggle');

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
  themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
  themeToggle.title = themeToggle.getAttribute('aria-label');
}

themeToggle.addEventListener('click', () => {
  setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});
themeToggle.title = document.documentElement.dataset.theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';

/* ================= Utilidades de fecha ================= */

// Fechas siempre como 'YYYY-MM-DD' en hora local (evita desfases por zona horaria)
function toISO(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function fromISO(value) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const longFmt = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', year: 'numeric' });
const shortFmt = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' });
const monthFmt = new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' });

function formatDate(value) {
  return value ? shortFmt.format(fromISO(value)) : '';
}

/* ================= Selector de fecha ================= */

const dateInput = document.getElementById('date');
const dateTrigger = document.getElementById('date-trigger');
const dateLabel = document.getElementById('date-label');
const calendar = document.getElementById('calendar');
const calTitle = document.getElementById('cal-title');
const calGrid = document.getElementById('cal-grid');

let viewDate = new Date(); // mes visible
viewDate.setDate(1);

function setDate(value) {
  dateInput.value = value;
  if (value) {
    dateLabel.textContent = longFmt.format(fromISO(value));
    dateLabel.classList.remove('placeholder');
  } else {
    dateLabel.textContent = 'Fecha (opcional)';
    dateLabel.classList.add('placeholder');
  }
}

function renderCalendar() {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  calTitle.textContent = monthFmt.format(viewDate);

  // La semana empieza en lunes
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);
  const todayISO = toISO(new Date());

  calGrid.innerHTML = '';
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const iso = toISO(d);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cal-day';
    btn.textContent = d.getDate();
    btn.dataset.date = iso;
    btn.setAttribute('aria-label', longFmt.format(d));
    if (d.getMonth() !== month) btn.classList.add('outside');
    if (iso === todayISO) btn.classList.add('today');
    if (iso === dateInput.value) {
      btn.classList.add('selected');
      btn.setAttribute('aria-pressed', 'true');
    }
    calGrid.appendChild(btn);
  }
}

function openCalendar() {
  const base = dateInput.value ? fromISO(dateInput.value) : new Date();
  viewDate = new Date(base.getFullYear(), base.getMonth(), 1);
  renderCalendar();
  calendar.hidden = false;
  dateTrigger.setAttribute('aria-expanded', 'true');
  const focusTarget = calGrid.querySelector('.selected') || calGrid.querySelector('.today') || calGrid.querySelector('.cal-day:not(.outside)');
  focusTarget?.focus();
}

function closeCalendar(returnFocus = false) {
  if (calendar.hidden) return;
  calendar.hidden = true;
  dateTrigger.setAttribute('aria-expanded', 'false');
  if (returnFocus) dateTrigger.focus();
}

dateTrigger.addEventListener('click', () => {
  calendar.hidden ? openCalendar() : closeCalendar();
});

calendar.addEventListener('click', e => {
  const nav = e.target.closest('[data-nav]');
  if (nav) {
    viewDate.setMonth(viewDate.getMonth() + Number(nav.dataset.nav));
    renderCalendar();
    return;
  }
  const day = e.target.closest('.cal-day');
  if (day) {
    setDate(day.dataset.date);
    closeCalendar(true);
  }
});

document.getElementById('cal-today').addEventListener('click', () => {
  setDate(toISO(new Date()));
  closeCalendar(true);
});

document.getElementById('cal-clear').addEventListener('click', () => {
  setDate('');
  closeCalendar(true);
});

// Navegación con flechas dentro de la cuadrícula
calGrid.addEventListener('keydown', e => {
  const steps = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
  if (!(e.key in steps) || !e.target.dataset.date) return;
  e.preventDefault();
  const d = fromISO(e.target.dataset.date);
  d.setDate(d.getDate() + steps[e.key]);
  const iso = toISO(d);
  if (d.getMonth() !== viewDate.getMonth() || d.getFullYear() !== viewDate.getFullYear()) {
    viewDate = new Date(d.getFullYear(), d.getMonth(), 1);
    renderCalendar();
  }
  calGrid.querySelector(`[data-date="${iso}"]`)?.focus();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeCalendar(true);
});

document.addEventListener('click', e => {
  if (!e.target.closest('.datepicker')) closeCalendar();
});

/* ================= Tareas ================= */

function loadTasks() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

const CAL_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>';

function createTaskElement(task) {
  const li = document.createElement('li');
  li.className = 'task';
  li.draggable = true;
  li.dataset.id = task.id;

  const title = document.createElement('p');
  title.className = 'task-title';
  title.textContent = task.title;
  li.appendChild(title);

  if (task.description) {
    const desc = document.createElement('p');
    desc.className = 'task-desc';
    desc.textContent = task.description;
    li.appendChild(desc);
  }

  if (task.date) {
    const date = document.createElement('p');
    date.className = 'task-date';
    date.innerHTML = CAL_ICON; // icono fijo, sin datos del usuario
    date.append(formatDate(task.date));
    li.appendChild(date);
  }

  const del = document.createElement('button');
  del.className = 'delete';
  del.type = 'button';
  del.title = 'Eliminar tarea';
  del.setAttribute('aria-label', 'Eliminar tarea');
  del.textContent = '×';
  del.addEventListener('click', () => {
    tasks = tasks.filter(t => t.id !== task.id);
    saveTasks();
    render();
  });
  li.appendChild(del);

  li.addEventListener('dragstart', e => {
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
    li.classList.add('dragging');
  });
  li.addEventListener('dragend', () => li.classList.remove('dragging'));

  return li;
}

function render() {
  columns.forEach(column => {
    const status = column.dataset.status;
    const list = column.querySelector('.task-list');
    const items = tasks.filter(t => t.status === status);

    list.innerHTML = '';
    items.forEach(t => list.appendChild(createTaskElement(t)));

    if (items.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'empty';
      empty.textContent = 'Sin tareas';
      list.appendChild(empty);
    }
    column.querySelector('.count').textContent = items.length;
  });
}

form.addEventListener('submit', e => {
  e.preventDefault();
  const title = form.elements.title.value.trim();
  if (!title) {
    form.elements.title.focus();
    return;
  }

  tasks.push({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
    title,
    description: form.elements.description.value.trim(),
    date: dateInput.value,
    status: 'pendiente'
  });
  saveTasks();
  render();
  form.reset();
  setDate(''); // el input oculto no se limpia con reset()
  closeCalendar();
  form.elements.title.focus();
});

columns.forEach(column => {
  column.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    column.classList.add('drag-over');
  });
  column.addEventListener('dragleave', e => {
    if (!column.contains(e.relatedTarget)) column.classList.remove('drag-over');
  });
  column.addEventListener('drop', e => {
    e.preventDefault();
    column.classList.remove('drag-over');
    const id = e.dataTransfer.getData('text/plain');
    const task = tasks.find(t => t.id === id);
    const status = column.dataset.status;
    if (!task || !STATUSES.includes(status) || task.status === status) return;

    // Se mueve al final de la columna destino
    tasks = tasks.filter(t => t.id !== id);
    task.status = status;
    tasks.push(task);
    saveTasks();
    render();
  });
});

render();
