async function openSessions(taskId) {
  try {
    const d = await fetchJSON(`/api/tasks/${taskId}/sessions`);
    const running = state.activeSession && state.activeSession.task_id === taskId ? state.activeSession.session_id : null;
    const rows = d.sessions.length
      ? d.sessions
          .map(
            (s) => `<div class="session-row${s.id === running ? " running" : ""}">
            <span class="session-date">${esc(formatDate(s.started_at))}</span>
            <span class="session-time">${esc(fmtTime(s.started_at))} &rarr; ${s.ended_at ? esc(fmtTime(s.ended_at)) : `<span class="session-now">now</span>`}</span>
            <span class="session-dur">${s.ended_at ? esc(fmtDur(s.duration_seconds)) : `<span class="session-live" data-session-live>${esc(liveText(s.started_at))}</span>`}</span>
            <button class="btn btn-sm btn-danger" data-action="session-delete" data-id="${s.id}" data-task="${taskId}">Delete</button>
          </div>`
          )
          .join("")
      : `<p class="work-empty">No sessions yet.</p>`;
    const tzHint = [tzName(), tzOffsetLabel()].filter(Boolean).join(" · ");
    $("#sessions-title").textContent = "Sessions";
    $("#sessions-body").innerHTML = `
      <p class="session-tz" title="Backend stores UTC; these are converted to your local time.">Times in your timezone &middot; ${esc(tzHint)}</p>
      <p class="session-summary">${esc(fmtDur(d.total_seconds))} total &middot; ${d.session_count} session${d.session_count === 1 ? "" : "s"}</p>
      <div class="session-head"><span>Date</span><span>Start &rarr; End</span><span>Duration</span><span></span></div>
      <div class="session-list">${rows}</div>`;
    $("#sessions-backdrop").hidden = false;
    document.body.classList.add("modal-open");
  } catch (err) {
    toast("Failed to load sessions: " + err.message, "error");
  }
}

function closeSessions() {
  $("#sessions-backdrop").hidden = true;
  document.body.classList.remove("modal-open");
}

async function deleteSession(sessionId, taskId) {
  try {
    await fetchJSON(`/api/sessions/${sessionId}`, { method: "DELETE" });
    toast("Session deleted");
    await loadActiveSession();
    await refreshAll();
    if (taskId) openSessions(taskId);
  } catch (err) {
    toast("Failed: " + err.message, "error");
  }
}

App.register("sessions", { bind: () => {} });