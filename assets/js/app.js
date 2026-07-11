(() => {
  "use strict";

  const { lessons: LESSONS, plan: PLAN, summary: SUMMARY } = window.DATAPREV_DATA;
  const STORAGE_KEY = "dataprev-agenda-progress-v2";
  const LEGACY_STORAGE_KEY = "dataprev-mission-control-v1";
  const lessonMap = new Map(LESSONS.map((lesson) => [lesson.id, lesson]));
  const initialCompleted = LESSONS.filter((lesson) => lesson.initialCompleted).map((lesson) => lesson.id);

  let state = loadState();

  function loadState() {
    for (const key of [STORAGE_KEY, LEGACY_STORAGE_KEY]) {
      try {
        const saved = JSON.parse(localStorage.getItem(key));
        if (saved && Array.isArray(saved.completed)) {
          return { completed: saved.completed.filter((id) => lessonMap.has(id)) };
        }
      } catch (error) {
        console.warn(`Progresso inválido em ${key}.`, error);
      }
    }
    return { completed: initialCompleted };
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function isDone(id) {
    return state.completed.includes(id);
  }

  function toggleDone(id, checked) {
    const completed = new Set(state.completed);
    checked ? completed.add(id) : completed.delete(id);
    state.completed = [...completed];
    saveState();
    renderAll();
  }

  function localDateISO(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function parseLocalDate(iso) {
    const [year, month, day] = iso.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function formatDate(iso, long = true) {
    return new Intl.DateTimeFormat("pt-BR", long
      ? { weekday: "long", day: "2-digit", month: "long" }
      : { day: "2-digit", month: "short" }
    ).format(parseLocalDate(iso));
  }

  function capitalize(value) {
    return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function shortSubject(subject) {
    const aliases = {
      "Legislação Acerca de Segurança da Informação e Proteção de Dados": "Legislação e Dados",
      "Inteligência de Negócios (Business Intelligence)": "Business Intelligence",
      "Gestão e Governança de Tecnologia da Informação": "Gestão e Governança",
      "Atualidades e Inteligência Artificial": "Atualidades e IA",
      "Desenvolvimento de Sistemas": "Desenvolvimento"
    };
    return aliases[subject] || subject;
  }

  function minutesAtSpeed(lesson) {
    return lesson.originalMinutes / SUMMARY.speed;
  }

  function formatMinutes(minutes) {
    const total = Math.round(minutes);
    const hours = Math.floor(total / 60);
    const mins = total % 60;
    if (!hours) return `${mins} min`;
    if (!mins) return `${hours}h`;
    return `${hours}h ${String(mins).padStart(2, "0")}min`;
  }

  function selectedLessons() {
    return LESSONS.filter((lesson) => lesson.selected);
  }

  function completedSelectedLessons() {
    return selectedLessons().filter((lesson) => isDone(lesson.id));
  }

  function calculateDaysRemaining() {
    const today = parseLocalDate(localDateISO());
    const exam = parseLocalDate(SUMMARY.examDate);
    return Math.max(0, Math.ceil((exam - today) / 86400000));
  }

  function progressFor(priority) {
    const items = LESSONS.filter((lesson) => lesson.selected && lesson.priority === priority);
    const done = items.filter((lesson) => isDone(lesson.id)).length;
    return {
      total: items.length,
      done,
      percent: items.length ? (done / items.length) * 100 : 0
    };
  }

  function priorityClass(priority) {
    return priority === "A+" ? "aplus" : priority.toLowerCase();
  }

  function toast(message) {
    const element = document.getElementById("toast");
    element.textContent = message;
    element.classList.add("show");
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => element.classList.remove("show"), 2300);
  }

  function lessonHTML(lesson, compact = false) {
    const done = isDone(lesson.id);
    const estimated = lesson.estimatedDuration ? " · estimada" : "";
    return `
      <label class="lesson-row ${done ? "done" : ""}">
        <input class="lesson-check" type="checkbox" ${done ? "checked" : ""} data-lesson="${lesson.id}">
        <span>
          <span class="lesson-title">${escapeHTML(lesson.title)}</span>
          <span class="lesson-meta">
            <span>${escapeHTML(shortSubject(lesson.subject))}</span>
            <span>Tópico ${lesson.topic}</span>
            <span>${formatMinutes(minutesAtSpeed(lesson))} em 1,5x${estimated}</span>
            ${compact ? "" : `<span>${escapeHTML(lesson.professor)}</span>`}
          </span>
        </span>
        <span class="priority-pill priority-${priorityClass(lesson.priority)}">${lesson.priority}</span>
      </label>`;
  }

  function dayCompletion(day) {
    return day.tasks.length > 0 && day.tasks.every(isDone);
  }

  function dayHTML(day, compact = false) {
    const lessons = day.tasks.map((id) => lessonMap.get(id)).filter(Boolean);
    const complete = dayCompletion(day);
    const current = day.date === localDateISO();
    const totalMinutes = day.video_minutes + (day.review_minutes || 0);

    return `
      <article class="card day-card ${complete ? "complete" : ""} ${current ? "current" : ""}" data-date="${day.date}">
        <div class="day-head">
          <div>
            <span class="phase-label">${escapeHTML(day.phase)}</span>
            <h3>${capitalize(formatDate(day.date))}</h3>
            <p>${lessons.length ? `${lessons.length} aulas planejadas` : "Sessão de revisão"}${complete ? " · concluída" : ""}</p>
          </div>
          <span class="day-duration">${formatMinutes(totalMinutes)}</span>
        </div>
        ${day.review_title ? `
          <div class="review-box">
            <strong>${escapeHTML(day.review_title)}</strong>
            <p>${escapeHTML(day.review_desc)}</p>
          </div>` : `
          <div class="lesson-list">${lessons.map((lesson) => lessonHTML(lesson, compact)).join("")}</div>
          <div class="review-box">
            <strong>Fechamento ativo · ${day.review_minutes || 10} min</strong>
            <p>Revise os pontos-chave ou resolva de 5 a 10 questões do conteúdo estudado.</p>
          </div>`}
      </article>`;
  }

  function findTodayPlan() {
    const today = localDateISO();
    return PLAN.find((day) => day.date === today)
      || PLAN.find((day) => day.date > today)
      || PLAN[PLAN.length - 1];
  }

  function bindLessonCheckboxes() {
    document.querySelectorAll("[data-lesson]").forEach((input) => {
      input.addEventListener("change", (event) => {
        toggleDone(event.currentTarget.dataset.lesson, event.currentTarget.checked);
      });
    });
  }

  function renderDashboard() {
    const days = calculateDaysRemaining();
    document.getElementById("daysRemaining").textContent = days;
    document.getElementById("countdownNote").textContent = days > 0
      ? "O cronograma termina na véspera, com revisão no lugar de conteúdo novo."
      : "A data da prova chegou. Respire, execute e confie no processo.";

    const selected = selectedLessons();
    const completed = completedSelectedLessons();
    const percentage = selected.length ? Math.round((completed.length / selected.length) * 100) : 0;
    const completedMinutes = completed.reduce((sum, lesson) => sum + minutesAtSpeed(lesson), 0);
    const contentDays = PLAN.filter((day) => day.tasks.length).length;

    document.getElementById("overallPercent").textContent = `${percentage}%`;
    document.getElementById("overallFraction").textContent = `${completed.length} de ${selected.length} aulas`;
    document.getElementById("completedCount").textContent = completed.length;
    document.getElementById("completedHours").textContent = formatMinutes(completedMinutes);
    document.getElementById("dailyPace").textContent = (selected.length / contentDays).toFixed(1).replace(".", ",");

    document.getElementById("priorityProgress").innerHTML = ["A+", "A", "B"].map((priority) => {
      const progress = progressFor(priority);
      return `
        <div class="priority-row">
          <div class="priority-row-head">
            <span class="priority-pill priority-${priorityClass(priority)}">${priority}</span>
            <span>${progress.done}/${progress.total} · ${Math.round(progress.percent)}%</span>
          </div>
          <div class="progress-track"><div class="progress-fill" style="width:${progress.percent}%"></div></div>
        </div>`;
    }).join("");

    const todayPlan = findTodayPlan();
    document.getElementById("todayCard").innerHTML = dayHTML(todayPlan);
    document.getElementById("todayHint").textContent = todayPlan.date === localDateISO()
      ? "Sua carga de hoje já está definida."
      : `Próxima sessão disponível em ${formatDate(todayPlan.date, false)}.`;

    const index = PLAN.findIndex((day) => day.date === todayPlan.date);
    document.getElementById("nextDays").innerHTML = PLAN
      .slice(Math.max(0, index + 1), Math.max(0, index + 4))
      .map((day) => dayHTML(day, true))
      .join("");
  }

  function renderAgenda() {
    const query = document.getElementById("agendaSearch").value.trim().toLowerCase();
    const month = document.getElementById("monthFilter").value;
    const subject = document.getElementById("subjectFilter").value;
    const status = document.getElementById("statusFilter").value;

    const filtered = PLAN.filter((day) => {
      const lessons = day.tasks.map((id) => lessonMap.get(id)).filter(Boolean);
      if (month !== "all" && !day.date.startsWith(month)) return false;
      if (subject !== "all" && !lessons.some((lesson) => lesson.subject === subject)) return false;
      if (status === "done" && !dayCompletion(day)) return false;
      if (status === "pending" && dayCompletion(day)) return false;

      if (query) {
        const haystack = [
          day.phase,
          day.review_title,
          day.review_desc,
          ...lessons.flatMap((lesson) => [lesson.title, lesson.subject, lesson.topicDesc, lesson.professor])
        ].join(" ").toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });

    document.getElementById("agendaList").innerHTML = filtered.length
      ? filtered.map((day) => dayHTML(day)).join("")
      : '<div class="card empty-state">Nenhuma sessão corresponde aos filtros selecionados.</div>';
  }

  function renderSubjects() {
    const grouped = new Map();
    selectedLessons().forEach((lesson) => {
      if (!grouped.has(lesson.subject)) grouped.set(lesson.subject, []);
      grouped.get(lesson.subject).push(lesson);
    });

    document.getElementById("subjectsGrid").innerHTML = [...grouped.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([subject, subjectLessons]) => {
        const done = subjectLessons.filter((lesson) => isDone(lesson.id)).length;
        const percent = subjectLessons.length ? (done / subjectLessons.length) * 100 : 0;
        const hours = subjectLessons.reduce((sum, lesson) => sum + minutesAtSpeed(lesson), 0) / 60;
        return `
          <article class="card subject-card" data-subject-card="${escapeHTML(subject)}" tabindex="0" role="button">
            <h2>${escapeHTML(shortSubject(subject))}</h2>
            <div class="subject-meta"><span>${subjectLessons.length} aulas</span><span>${hours.toFixed(1).replace(".", ",")}h em 1,5x</span></div>
            <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
            <div class="subject-footer"><span>${done} concluídas</span><strong>${Math.round(percent)}%</strong></div>
          </article>`;
      }).join("");
  }

  function renderPriorities() {
    const grouped = new Map();
    LESSONS.filter((lesson) => lesson.priority === "C").forEach((lesson) => {
      if (!grouped.has(lesson.subject)) grouped.set(lesson.subject, []);
      grouped.get(lesson.subject).push(lesson);
    });

    document.getElementById("optionalList").innerHTML = [...grouped.entries()].map(([subject, optionalLessons]) => `
      <details class="card optional-item">
        <summary>${escapeHTML(shortSubject(subject))} · ${optionalLessons.length} aulas</summary>
        <div class="lesson-list">${optionalLessons.map((lesson) => lessonHTML(lesson, true)).join("")}</div>
      </details>`).join("");
  }

  function renderAll() {
    renderDashboard();
    renderAgenda();
    renderSubjects();
    renderPriorities();
    bindLessonCheckboxes();
  }

  function switchView(view) {
    document.querySelectorAll(".view").forEach((element) => element.classList.remove("active"));
    document.getElementById(`view-${view}`).classList.add("active");
    document.querySelectorAll("[data-view]").forEach((button) => {
      button.classList.toggle("active", button.dataset.view === view);
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function markDay(date) {
    const day = PLAN.find((item) => item.date === date);
    if (!day || !day.tasks.length) {
      toast("Essa sessão é dedicada à revisão.");
      return;
    }
    const completed = new Set(state.completed);
    day.tasks.forEach((id) => completed.add(id));
    state.completed = [...completed];
    saveState();
    renderAll();
    toast("Sessão concluída.");
  }

  function exportBackup() {
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      completed: state.completed
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dataprev-progresso-${localDateISO()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast("Backup exportado.");
  }

  function importBackup(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(reader.result);
        const completed = payload.completed || payload.state?.completed;
        if (!Array.isArray(completed)) throw new Error("Formato inválido");
        state.completed = completed.filter((id) => lessonMap.has(id));
        saveState();
        renderAll();
        toast("Progresso importado.");
      } catch (error) {
        console.error(error);
        toast("Não foi possível importar esse arquivo.");
      }
    };
    reader.readAsText(file);
  }

  function populateFilters() {
    const subjectSelect = document.getElementById("subjectFilter");
    [...new Set(selectedLessons().map((lesson) => lesson.subject))]
      .sort((a, b) => a.localeCompare(b, "pt-BR"))
      .forEach((subject) => {
        const option = document.createElement("option");
        option.value = subject;
        option.textContent = shortSubject(subject);
        subjectSelect.appendChild(option);
      });

    const currentMonth = localDateISO().slice(0, 7);
    if (["2026-07", "2026-08", "2026-09", "2026-10"].includes(currentMonth)) {
      document.getElementById("monthFilter").value = currentMonth;
    }
  }

  function bindEvents() {
    document.querySelectorAll("[data-view]").forEach((button) => {
      button.addEventListener("click", () => switchView(button.dataset.view));
    });

    document.getElementById("focusToday").addEventListener("click", () => {
      switchView("dashboard");
      setTimeout(() => document.getElementById("todayCard").scrollIntoView({ behavior: "smooth", block: "center" }), 80);
    });

    document.getElementById("markToday").addEventListener("click", () => markDay(findTodayPlan().date));

    ["agendaSearch", "monthFilter", "subjectFilter", "statusFilter"].forEach((id) => {
      const element = document.getElementById(id);
      element.addEventListener(id === "agendaSearch" ? "input" : "change", renderAgenda);
    });

    document.getElementById("subjectsGrid").addEventListener("click", (event) => {
      const card = event.target.closest("[data-subject-card]");
      if (!card) return;
      document.getElementById("subjectFilter").value = card.dataset.subjectCard;
      switchView("agenda");
      renderAgenda();
    });

    document.getElementById("subjectsGrid").addEventListener("keydown", (event) => {
      if (!["Enter", " "].includes(event.key)) return;
      const card = event.target.closest("[data-subject-card]");
      if (card) card.click();
    });

    document.getElementById("exportBackup").addEventListener("click", exportBackup);
    document.getElementById("importBackup").addEventListener("change", (event) => {
      const [file] = event.currentTarget.files;
      if (file) importBackup(file);
      event.currentTarget.value = "";
    });
  }

  populateFilters();
  bindEvents();
  renderAll();
})();
