(() => {
  "use strict";

  const { lessons: LESSONS, plan: BASE_PLAN, summary: SUMMARY } = window.DATAPREV_DATA;
  const STORAGE_KEY = "dataprev-agenda-progress-v3";
  const LEGACY_KEYS = ["dataprev-agenda-progress-v2", "dataprev-mission-control-v1"];
  const lessonMap = new Map(LESSONS.map((lesson) => [lesson.id, lesson]));
  const originalDateMap = new Map();

  BASE_PLAN.forEach((day) => day.tasks.forEach((id) => originalDateMap.set(id, day.date)));

  const initialCompleted = LESSONS
    .filter((lesson) => lesson.initialCompleted)
    .map((lesson) => lesson.id);

  let state = loadState();
  let timerInterval = null;

  function defaultState() {
    return {
      completed: initialCompleted,
      movedLessons: {},
      sessions: [],
      timer: {
        running: false,
        startedAt: null,
        elapsedSeconds: 0,
        subject: "",
        lessonId: ""
      }
    };
  }

  function normalizeState(saved = {}) {
    const base = defaultState();
    return {
      completed: Array.isArray(saved.completed)
        ? saved.completed.filter((id) => lessonMap.has(id))
        : base.completed,
      movedLessons: saved.movedLessons && typeof saved.movedLessons === "object"
        ? Object.fromEntries(
            Object.entries(saved.movedLessons)
              .filter(([id, date]) => lessonMap.has(id) && /^\d{4}-\d{2}-\d{2}$/.test(date))
          )
        : {},
      sessions: Array.isArray(saved.sessions)
        ? saved.sessions.filter((session) =>
            session &&
            Number.isFinite(Number(session.seconds)) &&
            Number(session.seconds) > 0 &&
            /^\d{4}-\d{2}-\d{2}$/.test(session.date)
          )
        : [],
      timer: {
        ...base.timer,
        ...(saved.timer || {})
      }
    };
  }

  function loadState() {
    for (const key of [STORAGE_KEY, ...LEGACY_KEYS]) {
      try {
        const saved = JSON.parse(localStorage.getItem(key));
        if (saved) return normalizeState(saved);
      } catch (error) {
        console.warn(`Dados inválidos em ${key}.`, error);
      }
    }
    return defaultState();
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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

  function addDaysISO(iso, amount) {
    const date = parseLocalDate(iso);
    date.setDate(date.getDate() + amount);
    return localDateISO(date);
  }

  function formatDate(iso, long = true) {
    return new Intl.DateTimeFormat("pt-BR", long
      ? { weekday: "long", day: "2-digit", month: "long" }
      : { day: "2-digit", month: "short" }
    ).format(parseLocalDate(iso));
  }

  function formatWeekday(iso) {
    return new Intl.DateTimeFormat("pt-BR", { weekday: "short" })
      .format(parseLocalDate(iso))
      .replace(".", "");
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

  function formatSeconds(seconds) {
    const safe = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const secs = safe % 60;
    return [hours, minutes, secs].map((part) => String(part).padStart(2, "0")).join(":");
  }

  function formatStudyDuration(seconds) {
    const minutes = Math.round(seconds / 60);
    return formatMinutes(minutes);
  }

  function selectedLessons() {
    return LESSONS.filter((lesson) => lesson.selected);
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

  function effectivePlan() {
    const plan = BASE_PLAN.map((day) => ({
      ...day,
      tasks: day.tasks.filter((id) => !state.movedLessons[id])
    }));

    Object.entries(state.movedLessons).forEach(([id, targetDate]) => {
      let target = plan.find((day) => day.date === targetDate);
      if (!target) {
        target = {
          date: targetDate,
          tasks: [],
          video_minutes: 0,
          review_minutes: 10,
          phase: "Sessão personalizada"
        };
        plan.push(target);
      }
      target.tasks.push(id);
    });

    plan.forEach((day) => {
      day.video_minutes = Math.round(
        day.tasks.reduce((sum, id) => {
          const lesson = lessonMap.get(id);
          return sum + (lesson ? minutesAtSpeed(lesson) : 0);
        }, 0) * 10
      ) / 10;
    });

    return plan.sort((a, b) => a.date.localeCompare(b.date));
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
    window.__toastTimer = setTimeout(() => element.classList.remove("show"), 2600);
  }

  function bringLessonToToday(id) {
    const originalDate = originalDateMap.get(id);
    const today = localDateISO();
    if (!originalDate || originalDate <= today) {
      toast("Essa aula não está em uma data futura.");
      return;
    }
    state.movedLessons[id] = today;
    saveState();
    renderAll();
    toast("Aula trazida para hoje.");
  }

  function restoreLesson(id) {
    if (!state.movedLessons[id]) return;
    delete state.movedLessons[id];
    saveState();
    renderAll();
    toast("Aula devolvida para a data original.");
  }

  function lessonHTML(lesson, options = {}) {
    const { compact = false, dayDate = "", allowMove = true } = options;
    const done = isDone(lesson.id);
    const estimated = lesson.estimatedDuration ? " · estimada" : "";
    const originalDate = originalDateMap.get(lesson.id);
    const movedToToday = state.movedLessons[lesson.id] === localDateISO();
    const canBring = allowMove && originalDate && originalDate > localDateISO() && dayDate !== localDateISO();

    let action = "";
    if (movedToToday && dayDate === localDateISO()) {
      action = `<button class="lesson-action" type="button" data-restore-lesson="${lesson.id}">Devolver</button>`;
    } else if (canBring) {
      action = `<button class="lesson-action" type="button" data-bring-lesson="${lesson.id}">Trazer para hoje</button>`;
    }

    return `
      <div class="lesson-row ${done ? "done" : ""} ${movedToToday ? "moved" : ""}">
        <label class="lesson-check-wrap" aria-label="Marcar aula como concluída">
          <input class="lesson-check" type="checkbox" ${done ? "checked" : ""} data-lesson="${lesson.id}">
        </label>
        <div class="lesson-content">
          <span class="lesson-title">${escapeHTML(lesson.title)}</span>
          <span class="lesson-meta">
            <span>${escapeHTML(shortSubject(lesson.subject))}</span>
            <span>Tópico ${lesson.topic}</span>
            <span>${formatMinutes(minutesAtSpeed(lesson))} em 1,5x${estimated}</span>
            ${movedToToday ? "<span class=\"moved-label\">Antecipada</span>" : ""}
            ${compact ? "" : `<span>${escapeHTML(lesson.professor)}</span>`}
          </span>
        </div>
        <div class="lesson-side">
          <span class="priority-pill priority-${priorityClass(lesson.priority)}">${lesson.priority}</span>
          ${action}
        </div>
      </div>`;
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
          <div class="lesson-list">
            ${lessons.length
              ? lessons.map((lesson) => lessonHTML(lesson, { compact, dayDate: day.date })).join("")
              : '<div class="empty-day">Nenhuma aula restante nesta data.</div>'}
          </div>
          <div class="review-box">
            <strong>Fechamento ativo · ${day.review_minutes || 10} min</strong>
            <p>Revise os pontos-chave ou resolva de 5 a 10 questões do conteúdo estudado.</p>
          </div>`}
      </article>`;
  }

  function findTodayPlan() {
    const plan = effectivePlan();
    const today = localDateISO();
    return plan.find((day) => day.date === today)
      || plan.find((day) => day.date > today)
      || plan[plan.length - 1];
  }

  function sessionSecondsBetween(startDate, endDate) {
    return state.sessions
      .filter((session) => session.date >= startDate && session.date <= endDate)
      .reduce((sum, session) => sum + Number(session.seconds), 0);
  }

  function totalSessionSeconds() {
    return state.sessions.reduce((sum, session) => sum + Number(session.seconds), 0);
  }

  function currentTimerSeconds() {
    const base = Number(state.timer.elapsedSeconds) || 0;
    if (!state.timer.running || !state.timer.startedAt) return base;
    return base + Math.max(0, Math.floor((Date.now() - state.timer.startedAt) / 1000));
  }

  function timerSubjectValue() {
    return document.getElementById("timerSubject")?.value || state.timer.subject || "";
  }

  function timerLessonValue() {
    return document.getElementById("timerLesson")?.value || state.timer.lessonId || "";
  }

  function syncTimerStateFromFields() {
    state.timer.subject = timerSubjectValue();
    state.timer.lessonId = timerLessonValue();
    saveState();
  }

  function startPauseTimer() {
    if (state.timer.running) {
      state.timer.elapsedSeconds = currentTimerSeconds();
      state.timer.running = false;
      state.timer.startedAt = null;
      saveState();
      updateTimerUI();
      toast("Cronômetro pausado.");
      return;
    }

    const subject = timerSubjectValue();
    if (!subject) {
      toast("Selecione uma matéria.");
      return;
    }

    state.timer.subject = subject;
    state.timer.lessonId = timerLessonValue();
    state.timer.running = true;
    state.timer.startedAt = Date.now();
    saveState();
    updateTimerUI();
    toast("Cronômetro iniciado.");
  }

  function finishTimer() {
    const seconds = currentTimerSeconds();
    if (seconds < 60) {
      toast("Registre pelo menos 1 minuto de estudo.");
      return;
    }

    const subject = timerSubjectValue();
    if (!subject) {
      toast("Selecione uma matéria.");
      return;
    }

    state.sessions.unshift({
      id: crypto.randomUUID ? crypto.randomUUID() : `session-${Date.now()}`,
      date: localDateISO(),
      seconds,
      subject,
      lessonId: timerLessonValue(),
      createdAt: new Date().toISOString()
    });

    state.timer = {
      running: false,
      startedAt: null,
      elapsedSeconds: 0,
      subject,
      lessonId: ""
    };

    saveState();
    renderAll();
    toast(`Sessão de ${formatStudyDuration(seconds)} salva.`);
  }

  function resetTimer() {
    if (currentTimerSeconds() > 0 && !window.confirm("Zerar o cronômetro atual?")) return;
    state.timer.running = false;
    state.timer.startedAt = null;
    state.timer.elapsedSeconds = 0;
    saveState();
    updateTimerUI();
  }

  function updateTimerUI() {
    const display = document.getElementById("timerDisplay");
    const status = document.getElementById("timerStatus");
    const button = document.getElementById("timerStartPause");
    if (!display || !status || !button) return;

    display.textContent = formatSeconds(currentTimerSeconds());
    status.textContent = state.timer.running ? "Cronômetro em andamento" : currentTimerSeconds() ? "Cronômetro pausado" : "Pronto para começar";
    button.textContent = state.timer.running ? "Pausar" : currentTimerSeconds() ? "Continuar" : "Iniciar";
    document.title = state.timer.running
      ? `${formatSeconds(currentTimerSeconds())} · DATAPREV`
      : "DATAPREV · Agenda de Estudos";
  }

  function populateTimerLessons(subject, selectedLesson = "") {
    const select = document.getElementById("timerLesson");
    if (!select) return;
    const currentPlanIds = new Set(effectivePlan().flatMap((day) => day.tasks));
    const options = LESSONS
      .filter((lesson) => lesson.subject === subject && currentPlanIds.has(lesson.id) && !isDone(lesson.id))
      .sort((a, b) => {
        const dateA = state.movedLessons[a.id] || originalDateMap.get(a.id) || "9999";
        const dateB = state.movedLessons[b.id] || originalDateMap.get(b.id) || "9999";
        return dateA.localeCompare(dateB);
      });

    select.innerHTML = '<option value="">Sessão geral da matéria</option>' +
      options.map((lesson) => `<option value="${lesson.id}">${escapeHTML(lesson.title)}</option>`).join("");
    if (selectedLesson && options.some((lesson) => lesson.id === selectedLesson)) {
      select.value = selectedLesson;
    }
  }

  function populateSubjectSelects() {
    const subjects = [...new Set(selectedLessons().map((lesson) => lesson.subject))]
      .sort((a, b) => a.localeCompare(b, "pt-BR"));

    ["timerSubject", "manualSubject"].forEach((id) => {
      const select = document.getElementById(id);
      if (!select) return;
      const existing = id === "timerSubject" ? state.timer.subject : "";
      select.innerHTML = '<option value="">Selecione uma matéria</option>' +
        subjects.map((subject) => `<option value="${escapeHTML(subject)}">${escapeHTML(shortSubject(subject))}</option>`).join("");
      if (existing && subjects.includes(existing)) select.value = existing;
    });

    const timerSubject = document.getElementById("timerSubject");
    if (timerSubject && !timerSubject.value) {
      const today = findTodayPlan();
      const firstLesson = today?.tasks.map((id) => lessonMap.get(id)).find(Boolean);
      if (firstLesson) {
        timerSubject.value = firstLesson.subject;
        state.timer.subject = firstLesson.subject;
      }
    }
    populateTimerLessons(timerSubject?.value || "", state.timer.lessonId);
  }

  function renderDashboard() {
    const days = calculateDaysRemaining();
    const plan = effectivePlan();
    document.getElementById("daysRemaining").textContent = days;
    document.getElementById("countdownNote").textContent = days > 0
      ? "O cronograma termina na véspera, com revisão no lugar de conteúdo novo."
      : "A data da prova chegou. Respire, execute e confie no processo.";

    const selected = selectedLessons();
    const completed = selected.filter((lesson) => isDone(lesson.id));
    const percentage = selected.length ? Math.round((completed.length / selected.length) * 100) : 0;
    const completedMinutes = completed.reduce((sum, lesson) => sum + minutesAtSpeed(lesson), 0);
    const contentDays = plan.filter((day) => day.tasks.length).length;
    const totalSeconds = totalSessionSeconds();
    const today = localDateISO();
    const weekStart = addDaysISO(today, -6);
    const weeklySeconds = sessionSecondsBetween(weekStart, today);

    document.getElementById("overallPercent").textContent = `${percentage}%`;
    document.getElementById("overallFraction").textContent = `${completed.length} de ${selected.length} aulas`;
    document.getElementById("completedCount").textContent = completed.length;
    document.getElementById("completedHours").textContent = formatMinutes(completedMinutes);
    document.getElementById("netStudyHours").textContent = formatStudyDuration(totalSeconds);
    document.getElementById("weeklyStudyHours").textContent = formatStudyDuration(weeklySeconds);
    document.getElementById("dailyPace").textContent = contentDays ? (selected.length / contentDays).toFixed(1).replace(".", ",") : "0";

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
    document.getElementById("todayHint").textContent = todayPlan.date === today
      ? "Sua carga de hoje está definida. Você também pode antecipar aulas futuras."
      : `Próxima sessão disponível em ${formatDate(todayPlan.date, false)}.`;

    const index = plan.findIndex((day) => day.date === todayPlan.date);
    document.getElementById("nextDays").innerHTML = plan
      .slice(Math.max(0, index + 1), Math.max(0, index + 4))
      .map((day) => dayHTML(day, true))
      .join("");
  }

  function renderAgenda() {
    const plan = effectivePlan();
    const query = document.getElementById("agendaSearch").value.trim().toLowerCase();
    const month = document.getElementById("monthFilter").value;
    const subject = document.getElementById("subjectFilter").value;
    const status = document.getElementById("statusFilter").value;

    const filtered = plan.filter((day) => {
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
        const studiedSeconds = state.sessions
          .filter((session) => session.subject === subject)
          .reduce((sum, session) => sum + Number(session.seconds), 0);
        return `
          <article class="card subject-card" data-subject-card="${escapeHTML(subject)}" tabindex="0" role="button">
            <h2>${escapeHTML(shortSubject(subject))}</h2>
            <div class="subject-meta"><span>${subjectLessons.length} aulas</span><span>${hours.toFixed(1).replace(".", ",")}h em 1,5x</span></div>
            <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
            <div class="subject-footer"><span>${done} concluídas · ${formatStudyDuration(studiedSeconds)} líquidas</span><strong>${Math.round(percent)}%</strong></div>
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
        <div class="lesson-list">
          ${optionalLessons.map((lesson) => lessonHTML(lesson, { compact: true, allowMove: false })).join("")}
        </div>
      </details>`).join("");
  }

  function renderHours() {
    const total = totalSessionSeconds();
    const today = localDateISO();
    const weekStart = addDaysISO(today, -6);
    const week = sessionSecondsBetween(weekStart, today);
    const todaySeconds = sessionSecondsBetween(today, today);
    const average = state.sessions.length ? total / state.sessions.length : 0;

    document.getElementById("hoursTotal").textContent = formatStudyDuration(total);
    document.getElementById("hoursToday").textContent = formatStudyDuration(todaySeconds);
    document.getElementById("hoursWeek").textContent = formatStudyDuration(week);
    document.getElementById("hoursAverage").textContent = state.sessions.length ? formatStudyDuration(average) : "0 min";

    const days = Array.from({ length: 7 }, (_, index) => addDaysISO(today, index - 6));
    const values = days.map((date) => sessionSecondsBetween(date, date));
    const max = Math.max(...values, 1);

    document.getElementById("studyBars").innerHTML = days.map((date, index) => {
      const seconds = values[index];
      const height = Math.max(seconds ? 8 : 2, (seconds / max) * 100);
      return `
        <div class="study-bar-item">
          <div class="study-bar-value">${seconds ? formatStudyDuration(seconds) : "0"}</div>
          <div class="study-bar-track"><div class="study-bar-fill" style="height:${height}%"></div></div>
          <span>${capitalize(formatWeekday(date))}</span>
        </div>`;
    }).join("");

    document.getElementById("sessionList").innerHTML = state.sessions.length
      ? state.sessions
          .slice()
          .sort((a, b) => (b.createdAt || b.date).localeCompare(a.createdAt || a.date))
          .map((session) => {
            const lesson = session.lessonId ? lessonMap.get(session.lessonId) : null;
            return `
              <article class="card session-item">
                <div>
                  <strong>${escapeHTML(shortSubject(session.subject))}</strong>
                  <span>${escapeHTML(formatDate(session.date, false))}${lesson ? ` · ${escapeHTML(lesson.title)}` : ""}</span>
                </div>
                <div class="session-item-side">
                  <strong>${formatStudyDuration(Number(session.seconds))}</strong>
                  <button class="icon-button" type="button" data-delete-session="${escapeHTML(session.id)}" aria-label="Excluir sessão">Excluir</button>
                </div>
              </article>`;
          }).join("")
      : '<div class="card empty-state">Nenhuma hora registrada ainda. O cronômetro está esperando o primeiro play.</div>';
  }

  function renderAll() {
    populateSubjectSelects();
    renderDashboard();
    renderAgenda();
    renderSubjects();
    renderPriorities();
    renderHours();
    bindDynamicEvents();
    updateTimerUI();
  }

  function bindDynamicEvents() {
    document.querySelectorAll("[data-lesson]").forEach((input) => {
      input.addEventListener("change", (event) => {
        toggleDone(event.currentTarget.dataset.lesson, event.currentTarget.checked);
      });
    });

    document.querySelectorAll("[data-bring-lesson]").forEach((button) => {
      button.addEventListener("click", () => bringLessonToToday(button.dataset.bringLesson));
    });

    document.querySelectorAll("[data-restore-lesson]").forEach((button) => {
      button.addEventListener("click", () => restoreLesson(button.dataset.restoreLesson));
    });

    document.querySelectorAll("[data-delete-session]").forEach((button) => {
      button.addEventListener("click", () => {
        state.sessions = state.sessions.filter((session) => session.id !== button.dataset.deleteSession);
        saveState();
        renderAll();
        toast("Sessão removida.");
      });
    });
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
    const day = effectivePlan().find((item) => item.date === date);
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

  function addManualSession(event) {
    event.preventDefault();
    const date = document.getElementById("manualDate").value;
    const subject = document.getElementById("manualSubject").value;
    const minutes = Number(document.getElementById("manualMinutes").value);

    if (!date || !subject || !Number.isFinite(minutes) || minutes <= 0) {
      toast("Preencha data, matéria e minutos.");
      return;
    }

    state.sessions.unshift({
      id: crypto.randomUUID ? crypto.randomUUID() : `session-${Date.now()}`,
      date,
      seconds: Math.round(minutes * 60),
      subject,
      lessonId: "",
      createdAt: new Date().toISOString()
    });

    saveState();
    event.currentTarget.reset();
    document.getElementById("manualDate").value = localDateISO();
    renderAll();
    toast("Tempo registrado.");
  }

  function exportBackup() {
    const payload = {
      version: 3,
      exportedAt: new Date().toISOString(),
      ...state
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
        state = normalizeState(payload.state || payload);
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

    document.getElementById("manualDate").value = localDateISO();
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

    document.getElementById("timerStartPause").addEventListener("click", startPauseTimer);
    document.getElementById("timerFinish").addEventListener("click", finishTimer);
    document.getElementById("timerReset").addEventListener("click", resetTimer);

    document.getElementById("timerSubject").addEventListener("change", (event) => {
      state.timer.subject = event.currentTarget.value;
      state.timer.lessonId = "";
      populateTimerLessons(event.currentTarget.value);
      saveState();
    });

    document.getElementById("timerLesson").addEventListener("change", syncTimerStateFromFields);
    document.getElementById("manualSessionForm").addEventListener("submit", addManualSession);

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

  timerInterval = window.setInterval(updateTimerUI, 1000);
  window.addEventListener("beforeunload", saveState);
})();