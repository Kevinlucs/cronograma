
(() => {
  "use strict";

  const { EXAMS, LESSONS, PLAN, SUMMARY } = window.STUDY_DATA;
  const STORAGE_KEY = "study-mission-control-v2";
  const LEGACY_KEY = "dataprev-mission-control-v1";

  const lessonMap = new Map(LESSONS.map(lesson => [lesson.id, lesson]));
  const examMap = new Map(EXAMS.map(exam => [exam.id, exam]));
  const initialCompleted = LESSONS.filter(item => item.initialCompleted).map(item => item.id);

  let state = loadState();
  let activeView = "dashboard";

  function loadState() {
    try {
      const current = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (current) {
        return {
          completed: Array.isArray(current.completed)
            ? current.completed.filter(id => lessonMap.has(id))
            : initialCompleted,
          theme: current.theme === "light" ? "light" : "dark"
        };
      }

      const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY));
      if (legacy) {
        return {
          completed: Array.isArray(legacy.completed)
            ? legacy.completed.filter(id => lessonMap.has(id))
            : initialCompleted,
          theme: legacy.theme === "light" ? "light" : "dark"
        };
      }
    } catch {
      // Começa com o estado seguro abaixo.
    }

    return { completed: initialCompleted, theme: "dark" };
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

  function daysUntil(iso) {
    const today = parseLocalDate(localDateISO());
    const target = parseLocalDate(iso);
    return Math.ceil((target - today) / 86400000);
  }

  function formatDate(iso, long = true) {
    return new Intl.DateTimeFormat(
      "pt-BR",
      long
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

  function shortSubject(subject) {
    const names = {
      "Legislação Acerca de Segurança da Informação e Proteção de Dados": "Legislação e Dados",
      "Inteligência de Negócios (Business Intelligence)": "Business Intelligence",
      "Gestão e Governança de Tecnologia da Informação": "Gestão e Governança",
      "Atualidades e Inteligência Artificial": "Atualidades e IA",
      "Desenvolvimento de Sistemas": "Desenvolvimento",
      "Legislação Aplicada e Normativos da Embratur": "Normativos da EMBRATUR",
      "Lei Geral de Proteção de Dados Pessoais – LGPD": "LGPD",
      "Lei de Acesso à Informação - LAI": "LAI",
      "Diversidade e Inclusão na Sociedade": "Diversidade e Inclusão",
      "Tecnologia da Informação e Inovação": "TI e Inovação"
    };
    return names[subject] || subject;
  }

  function priorityClass(priority) {
    return priority === "A+" ? "Aplus" : priority;
  }

  function isDone(id) {
    return state.completed.includes(id);
  }

  function toggleDone(id, checked) {
    const set = new Set(state.completed);
    checked ? set.add(id) : set.delete(id);
    state.completed = [...set];
    saveState();
    renderAll();
  }

  function toast(message) {
    const element = document.getElementById("toast");
    element.textContent = message;
    element.classList.add("show");
    clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(() => element.classList.remove("show"), 2300);
  }

  function primaryExam() {
    const embratur = examMap.get("EMBRATUR");
    return daysUntil(embratur.examDate) >= 0 ? embratur : examMap.get("DATAPREV");
  }

  function activeWeights() {
    return primaryExam().id === "EMBRATUR"
      ? { EMBRATUR: 70, DATAPREV: 30 }
      : { EMBRATUR: 0, DATAPREV: 100 };
  }

  function selectedLessons(exam = "all") {
    return LESSONS.filter(
      lesson => lesson.selected && (exam === "all" || lesson.exam === exam)
    );
  }

  function completedSelectedLessons(exam = "all") {
    return selectedLessons(exam).filter(lesson => isDone(lesson.id));
  }

  function progressForPriority(priority) {
    const items = selectedLessons().filter(lesson => lesson.priority === priority);
    const done = items.filter(lesson => isDone(lesson.id)).length;
    return {
      total: items.length,
      done,
      percent: items.length ? (done / items.length) * 100 : 0
    };
  }

  function progressForExam(examId) {
    const items = selectedLessons(examId);
    const done = items.filter(lesson => isDone(lesson.id)).length;
    return {
      total: items.length,
      done,
      percent: items.length ? (done / items.length) * 100 : 0
    };
  }

  function overlapLabel(overlap) {
    return {
      total: "Serve aos dois",
      partial: "Aproveitamento parcial",
      exclusive: "Exclusiva"
    }[overlap] || "Exclusiva";
  }

  function lessonHTML(lesson, compact = false) {
    const done = isDone(lesson.id);
    const estimate = lesson.estimatedDuration ? " · estimada" : "";
    const canonical = lesson.canonicalSubject || lesson.subject;

    return `
      <label class="lesson-item ${done ? "done" : ""}">
        <input
          class="lesson-check"
          type="checkbox"
          ${done ? "checked" : ""}
          data-lesson="${lesson.id}"
        />
        <span>
          <span class="lesson-title">${escapeHTML(lesson.title)}</span>
          <span class="lesson-meta">
            <span class="subject-name">${escapeHTML(shortSubject(canonical))}</span>
            <span>Tópico ${lesson.topic ?? "—"}</span>
            <span>${formatMinutes(minutesAtSpeed(lesson))} em ${SUMMARY.speed}x${estimate}</span>
            ${compact ? "" : `<span>${escapeHTML(lesson.professor || "Equipe Gran")}</span>`}
          </span>
        </span>
        <span class="lesson-badges">
          <span class="contest-badge ${lesson.exam.toLowerCase()}">${lesson.exam}</span>
          <span class="overlap-badge ${lesson.overlap}">${overlapLabel(lesson.overlap)}</span>
          <span class="priority-badge priority-${priorityClass(lesson.priority)}">${lesson.priority}</span>
        </span>
      </label>
    `;
  }

  function dayLessons(day, contest = "all") {
    return day.tasks
      .map(id => lessonMap.get(id))
      .filter(Boolean)
      .filter(lesson => contest === "all" || lesson.exam === contest);
  }

  function dayCompletion(day) {
    if (!day.tasks.length) return false;
    return day.tasks.every(isDone);
  }

  function dayMix(lessons) {
    return lessons.reduce(
      (mix, lesson) => {
        mix[lesson.exam] += minutesAtSpeed(lesson);
        return mix;
      },
      { EMBRATUR: 0, DATAPREV: 0 }
    );
  }

  function mixHTML(lessons) {
    if (!lessons.length) return "";
    const mix = dayMix(lessons);
    const total = mix.EMBRATUR + mix.DATAPREV;
    const embraturPercent = total ? (mix.EMBRATUR / total) * 100 : 0;
    const dataprevPercent = 100 - embraturPercent;

    if (!mix.EMBRATUR || !mix.DATAPREV) {
      const only = mix.EMBRATUR ? "EMBRATUR" : "DATAPREV";
      return `
        <div class="mix-strip">
          <div class="mix-row">
            <span>Foco da sessão</span>
            <strong>${only} · ${formatMinutes(total)}</strong>
          </div>
        </div>
      `;
    }

    return `
      <div class="mix-strip">
        <div class="mix-row">
          <span>Distribuição da sessão</span>
          <strong>
            EMBRATUR ${Math.round(embraturPercent)}% · DATAPREV ${Math.round(dataprevPercent)}%
          </strong>
        </div>
        <div class="mix-track" aria-label="Distribuição entre concursos">
          <span class="embratur-part" style="width:${embraturPercent}%"></span>
          <span class="dataprev-part" style="width:${dataprevPercent}%"></span>
        </div>
      </div>
    `;
  }

  function dayHTML(day, compact = false, contest = "all") {
    const lessons = dayLessons(day, contest);
    const complete = dayCompletion(day);
    const today = day.date === localDateISO();
    const visibleVideo = lessons.reduce((sum, lesson) => sum + minutesAtSpeed(lesson), 0);
    const total = visibleVideo + (day.review_minutes || 0);
    const sprint = day.phase.includes("EMBRATUR");
    const examDay = day.date === "2026-07-29";

    return `
      <article
        class="card agenda-day ${complete ? "complete" : ""} ${today ? "current" : ""} ${sprint ? "sprint" : ""} ${examDay ? "exam-day" : ""}"
        data-date="${day.date}"
      >
        <div class="day-header">
          <div>
            <span class="phase-tag">${escapeHTML(day.phase)}</span>
            <h3>${capitalize(formatDate(day.date))}</h3>
            <p>
              ${lessons.length
                ? `${lessons.length} aulas planejadas`
                : "Sessão de revisão"}
              ${complete ? " · sessão concluída" : ""}
            </p>
          </div>
          <div class="day-time">${formatMinutes(total)}</div>
        </div>

        ${mixHTML(lessons)}

        ${day.review_title ? `
          <div class="review-block">
            <strong>${escapeHTML(day.review_title)}</strong>
            <p>${escapeHTML(day.review_desc)}</p>
          </div>
        ` : `
          <div class="lesson-list">
            ${lessons.map(lesson => lessonHTML(lesson, compact)).join("")}
          </div>
          <div class="review-block" style="margin-top:10px">
            <strong>Fechamento ativo · ${day.review_minutes || 10} min</strong>
            <p>Faça revisão curta, caderno de erros ou de 5 a 10 questões dos assuntos vistos.</p>
          </div>
        `}

        ${day.strategy ? `
          <div class="strategy-callout">🧬 ${escapeHTML(day.strategy)}</div>
        ` : ""}
      </article>
    `;
  }

  function findTodayPlan() {
    const today = localDateISO();
    const exact = PLAN.find(day => day.date === today);
    if (exact) return exact;
    const future = PLAN.find(day => day.date > today);
    return future || PLAN[PLAN.length - 1];
  }

  function renderContestCards() {
    const weights = activeWeights();
    const primary = primaryExam();

    document.getElementById("contestCards").innerHTML = EXAMS.map(exam => {
      const progress = progressForExam(exam.id);
      const remaining = daysUntil(exam.examDate);
      const status = remaining < 0
        ? "Prova realizada"
        : remaining === 0
          ? "É hoje"
          : `${remaining} dias`;
      const currentPriority = weights[exam.id];

      return `
        <article class="contest-card ${primary.id === exam.id ? "primary" : ""}">
          <div class="contest-card-header">
            <div>
              <span class="contest-badge ${exam.id.toLowerCase()}">${exam.name}</span>
              <h3>${escapeHTML(exam.role)}</h3>
              <p>${escapeHTML(exam.location)} · ${formatDate(exam.examDate, false)}</p>
            </div>
            <div class="contest-countdown">
              <strong>${remaining < 0 ? "✓" : remaining}</strong>
              <span>${status}</span>
            </div>
          </div>

          <div class="contest-progress">
            <div class="contest-row">
              <span>Progresso planejado</span>
              <strong>${progress.done}/${progress.total} · ${Math.round(progress.percent)}%</strong>
            </div>
            <div class="progress-track">
              <div class="progress-fill" style="width:${progress.percent}%"></div>
            </div>
          </div>

          <div class="contest-row" style="margin-top:12px">
            <small>Prioridade atual</small>
            <strong>${currentPriority}%</strong>
          </div>
        </article>
      `;
    }).join("");
  }

  function renderDashboard() {
    const primary = primaryExam();
    const remaining = Math.max(0, daysUntil(primary.examDate));
    const weights = activeWeights();
    const selected = selectedLessons();
    const completed = completedSelectedLessons();
    const percent = selected.length ? Math.round((completed.length / selected.length) * 100) : 0;
    const completedMinutes = completed.reduce((sum, lesson) => sum + minutesAtSpeed(lesson), 0);
    const sharedCompleted = completed.filter(lesson => lesson.overlap !== "exclusive").length;

    document.getElementById("primaryExamName").textContent = primary.name;
    document.getElementById("primaryExamRole").textContent = primary.role;
    document.getElementById("daysRemaining").textContent = remaining;
    document.getElementById("heroPriority").textContent =
      primary.id === "EMBRATUR"
        ? `${weights.EMBRATUR}% EMBRATUR · ${weights.DATAPREV}% DATAPREV`
        : "100% DATAPREV";

    document.getElementById("overallPercent").textContent = `${percent}%`;
    document.getElementById("overallFraction").textContent = `${completed.length} de ${selected.length} aulas`;
    document.getElementById("completedCount").textContent = completed.length;
    document.getElementById("completedHours").textContent = formatMinutes(completedMinutes);
    document.getElementById("sharedProgress").textContent = sharedCompleted;
    document.getElementById("sharedCaption").textContent =
      `${SUMMARY.sharedSelected} aulas planejadas têm reaproveitamento`;

    document.getElementById("priorityProgress").innerHTML = ["A+", "A", "B"].map(priority => {
      const progress = progressForPriority(priority);
      return `
        <div class="priority-row">
          <div class="priority-row-header">
            <span><span class="priority-badge priority-${priorityClass(priority)}">${priority}</span></span>
            <span>${progress.done}/${progress.total} · ${Math.round(progress.percent)}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${progress.percent}%"></div>
          </div>
        </div>
      `;
    }).join("");

    renderContestCards();

    const todayPlan = findTodayPlan();
    document.getElementById("todayCard").innerHTML = dayHTML(todayPlan);
    document.getElementById("todayHint").textContent =
      todayPlan.date === localDateISO()
        ? "Sua missão de hoje já considera urgência, peso e reaproveitamento."
        : `Próxima sessão disponível: ${formatDate(todayPlan.date, false)}.`;

    const todayIndex = PLAN.findIndex(day => day.date === todayPlan.date);
    const next = PLAN.slice(Math.max(0, todayIndex + 1), Math.max(0, todayIndex + 4));
    document.getElementById("nextDays").innerHTML = next.map(day => dayHTML(day, true)).join("");

    bindLessonCheckboxes();
  }

  function selectedContestFilter() {
    return document.getElementById("contestFilter").value;
  }

  function renderAgenda() {
    const query = document.getElementById("agendaSearch").value.trim().toLowerCase();
    const month = document.getElementById("monthFilter").value;
    const contest = selectedContestFilter();
    const subject = document.getElementById("subjectFilter").value;
    const status = document.getElementById("statusFilter").value;

    const filtered = PLAN.filter(day => {
      if (month !== "all" && !day.date.startsWith(month)) return false;

      const lessons = dayLessons(day, contest);
      const isReviewForContest =
        !day.tasks.length &&
        (contest === "all" || day.phase.toUpperCase().includes(contest));

      if (!lessons.length && !isReviewForContest) return false;
      if (subject !== "all" && !lessons.some(lesson => lesson.canonicalSubject === subject)) {
        return false;
      }

      if (status === "done" && !dayCompletion(day)) return false;
      if (status === "pending" && dayCompletion(day)) return false;

      if (query) {
        const haystack = [
          day.phase,
          day.review_title,
          day.review_desc,
          ...lessons.flatMap(lesson => [
            lesson.title,
            lesson.subject,
            lesson.canonicalSubject,
            lesson.topicDesc,
            lesson.professor,
            lesson.exam
          ])
        ].join(" ").toLowerCase();

        if (!haystack.includes(query)) return false;
      }

      return true;
    });

    document.getElementById("agendaList").innerHTML = filtered.length
      ? filtered.map(day => dayHTML(day, false, contest)).join("")
      : `<div class="card empty-state">Nenhuma sessão encontrou esse filtro. O radar ficou limpo.</div>`;

    bindLessonCheckboxes();
  }

  function renderSubjects() {
    const contest = document.getElementById("subjectContestFilter").value;
    const items = selectedLessons(contest);
    const grouped = new Map();

    items.forEach(lesson => {
      const key = lesson.canonicalSubject || lesson.subject;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(lesson);
    });

    const cards = [...grouped.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([subject, subjectLessons]) => {
        const done = subjectLessons.filter(lesson => isDone(lesson.id)).length;
        const percent = subjectLessons.length ? (done / subjectLessons.length) * 100 : 0;
        const hours = subjectLessons.reduce((sum, lesson) => sum + minutesAtSpeed(lesson), 0) / 60;
        const exams = [...new Set(subjectLessons.map(lesson => lesson.exam))];

        return `
          <article class="subject-card" data-subject-card="${escapeHTML(subject)}">
            <div class="subject-heading">
              <h3>${escapeHTML(shortSubject(subject))}</h3>
              <div class="subject-origin">
                ${exams.map(exam => `<span class="contest-badge ${exam.toLowerCase()}">${exam}</span>`).join("")}
              </div>
            </div>
            <div class="subject-stats">
              <span>${subjectLessons.length} aulas</span>
              <span>${hours.toFixed(1).replace(".", ",")}h em ${SUMMARY.speed}x</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill" style="width:${percent}%"></div>
            </div>
            <div class="subject-stats" style="margin-top:9px;margin-bottom:0">
              <span>${done} concluídas</span>
              <strong>${Math.round(percent)}%</strong>
            </div>
          </article>
        `;
      });

    document.getElementById("subjectsGrid").innerHTML = cards.join("");
  }

  function renderPriorities() {
    const optional = LESSONS.filter(lesson => !lesson.selected && lesson.priority !== "SKIP");
    const grouped = new Map();

    optional.forEach(lesson => {
      const key = `${lesson.exam}|||${lesson.canonicalSubject || lesson.subject}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(lesson);
    });

    document.getElementById("optionalList").innerHTML = [...grouped.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
      .map(([key, group]) => {
        const [exam, subject] = key.split("|||");
        return `
          <details class="card" style="padding:15px">
            <summary style="cursor:pointer;font-weight:800">
              <span class="contest-badge ${exam.toLowerCase()}">${exam}</span>
              ${escapeHTML(shortSubject(subject))} · ${group.length} aulas
            </summary>
            <div class="lesson-list" style="margin-top:12px">
              ${group.map(lesson => lessonHTML(lesson, true)).join("")}
            </div>
          </details>
        `;
      }).join("");

    bindLessonCheckboxes();
  }

  function renderAll() {
    document.body.classList.toggle("light", state.theme === "light");
    renderDashboard();
    renderAgenda();
    renderSubjects();
    renderPriorities();
    renderSettingsMetrics();
  }

  function bindLessonCheckboxes() {
    document.querySelectorAll("[data-lesson]").forEach(input => {
      input.onchange = event => toggleDone(event.target.dataset.lesson, event.target.checked);
    });
  }

  function switchView(view) {
    activeView = view;
    const titles = {
      dashboard: [
        "Seu plano de ataque",
        "Duas provas, um único cérebro e nenhuma aula duplicada sem necessidade."
      ],
      agenda: [
        "Agenda integrada",
        "EMBRATUR na linha de frente agora; DATAPREV mantém o motor aquecido."
      ],
      subjects: [
        "Mapa das matérias",
        "Veja o que é exclusivo, compartilhado e parcialmente reaproveitável."
      ],
      priorities: [
        "Matriz de prioridade",
        "O cronograma protege os pontos de maior retorno e empurra o restante para a reserva."
      ]
    };

    document.querySelectorAll(".view").forEach(element => element.classList.remove("active"));
    document.getElementById(`view-${view}`).classList.add("active");

    document.querySelectorAll("[data-view]").forEach(button => {
      button.classList.toggle("active", button.dataset.view === view);
    });

    document.getElementById("viewTitle").textContent = titles[view][0];
    document.getElementById("viewSubtitle").textContent = titles[view][1];
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function markDay(date) {
    const day = PLAN.find(item => item.date === date);
    if (!day || !day.tasks.length) {
      toast("Essa sessão é de revisão e não possui videoaulas para marcar.");
      return;
    }

    const set = new Set(state.completed);
    day.tasks.forEach(id => set.add(id));
    state.completed = [...set];
    saveState();
    renderAll();
    toast("Sessão concluída. O cronograma soltou fogos discretos. 🎯");
  }

  function exportBackup() {
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      state
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mission-control-progresso-${localDateISO()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast("Backup exportado.");
  }

  function importBackup(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(reader.result);
        const imported = payload.state || payload;
        if (!Array.isArray(imported.completed)) throw new Error("Formato inválido");

        state.completed = imported.completed.filter(id => lessonMap.has(id));
        state.theme = imported.theme === "light" ? "light" : "dark";
        saveState();
        renderAll();
        toast("Progresso importado com sucesso.");
      } catch {
        toast("Não consegui ler esse backup.");
      }
    };
    reader.readAsText(file);
  }

  function populateMonthFilter() {
    const select = document.getElementById("monthFilter");
    const months = [...new Set(PLAN.map(day => day.date.slice(0, 7)))];
    const formatter = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

    months.forEach(month => {
      const [year, number] = month.split("-").map(Number);
      const option = document.createElement("option");
      option.value = month;
      option.textContent = capitalize(formatter.format(new Date(year, number - 1, 1)));
      select.appendChild(option);
    });

    const currentMonth = localDateISO().slice(0, 7);
    if (months.includes(currentMonth)) select.value = currentMonth;
  }

  function populateSubjectFilter() {
    const contest = selectedContestFilter();
    const current = document.getElementById("subjectFilter").value;
    const select = document.getElementById("subjectFilter");

    const options = [...new Set(
      selectedLessons(contest).map(lesson => lesson.canonicalSubject || lesson.subject)
    )].sort((a, b) => a.localeCompare(b, "pt-BR"));

    select.innerHTML = `<option value="all">Todas as matérias</option>` +
      options.map(subject =>
        `<option value="${escapeHTML(subject)}">${escapeHTML(shortSubject(subject))}</option>`
      ).join("");

    if (options.includes(current)) select.value = current;
  }

  function renderSettingsMetrics() {
    document.getElementById("extractedMetric").textContent = SUMMARY.totalExtracted;
    document.getElementById("scheduledMetric").textContent = SUMMARY.selected;
    document.getElementById("sharedMetric").textContent = SUMMARY.sharedSelected;
    document.getElementById("estimatedMetric").textContent = SUMMARY.estimatedDurations;
  }

  document.querySelectorAll("[data-view]").forEach(button => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });

  document.getElementById("focusToday").addEventListener("click", () => {
    switchView("dashboard");
    setTimeout(() => {
      document.getElementById("todayCard").scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  });

  document.getElementById("themeToggle").addEventListener("click", () => {
    state.theme = state.theme === "light" ? "dark" : "light";
    saveState();
    renderAll();
  });

  document.getElementById("markToday").addEventListener("click", () => {
    markDay(findTodayPlan().date);
  });

  document.getElementById("agendaSearch").addEventListener("input", renderAgenda);
  document.getElementById("monthFilter").addEventListener("change", renderAgenda);
  document.getElementById("statusFilter").addEventListener("change", renderAgenda);

  document.getElementById("contestFilter").addEventListener("change", () => {
    populateSubjectFilter();
    renderAgenda();
  });

  document.getElementById("subjectFilter").addEventListener("change", renderAgenda);
  document.getElementById("subjectContestFilter").addEventListener("change", renderSubjects);

  document.getElementById("subjectsGrid").addEventListener("click", event => {
    const card = event.target.closest("[data-subject-card]");
    if (!card) return;

    document.getElementById("contestFilter").value =
      document.getElementById("subjectContestFilter").value;
    populateSubjectFilter();
    document.getElementById("subjectFilter").value = card.dataset.subjectCard;
    switchView("agenda");
    renderAgenda();
  });

  const modal = document.getElementById("settingsModal");
  document.getElementById("openSettings").addEventListener("click", () => modal.classList.add("open"));
  document.getElementById("closeSettings").addEventListener("click", () => modal.classList.remove("open"));
  modal.addEventListener("click", event => {
    if (event.target === modal) modal.classList.remove("open");
  });

  document.getElementById("exportBackup").addEventListener("click", exportBackup);
  document.getElementById("importBackup").addEventListener("change", event => {
    const [file] = event.target.files;
    if (file) importBackup(file);
    event.target.value = "";
  });

  document.getElementById("resetProgress").addEventListener("click", () => {
    if (!confirm("Apagar todo o progresso salvo neste navegador?")) return;
    state.completed = initialCompleted;
    saveState();
    renderAll();
    toast("Progresso restaurado ao estado inicial.");
  });

  populateMonthFilter();
  populateSubjectFilter();
  renderAll();
})();
