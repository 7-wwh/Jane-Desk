    // Drag and drop handler state
    let draggedElement = null;
    let isRearrangeMode = false;

    function toggleRearrangeMode() {
      isRearrangeMode = !isRearrangeMode;
      const btn = document.getElementById('btn-rearrange');
      const label = document.getElementById('rearrange-label');
      const handles = document.querySelectorAll('.drag-handle');

      if (isRearrangeMode) {
        btn.classList.remove('bg-stone-200', 'text-stone-800');
        btn.classList.add('bg-stone-900', 'text-white');
        label.innerText = 'Lock Layout';
        handles.forEach(h => h.classList.remove('opacity-0'));
        showToast('Rearrange mode active: Drag widgets to reorder');
      } else {
        btn.classList.remove('bg-stone-900', 'text-white');
        btn.classList.add('bg-stone-200', 'text-stone-800');
        label.innerText = 'Rearrange';
        handles.forEach(h => h.classList.add('opacity-0'));
        showToast('Layout locked');
      }
    }

    function handleDragStart(e) {
      draggedElement = e.currentTarget;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/html', draggedElement.innerHTML);
      draggedElement.classList.add('opacity-40', 'scale-95');
    }

    function handleDragOver(e) {
      if (e.preventDefault) e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      return false;
    }

    function handleDragEnter(e) {
      const target = e.currentTarget;
      if (target !== draggedElement) {
        target.classList.add('ring-2', 'ring-amber-400', 'ring-offset-2');
      }
    }

    function handleDragLeave(e) {
      e.currentTarget.classList.remove('ring-2', 'ring-amber-400', 'ring-offset-2');
    }

    function handleDrop(e) {
      if (e.stopPropagation) e.stopPropagation();
      const target = e.currentTarget;

      if (draggedElement && target !== draggedElement && target.parentNode === draggedElement.parentNode) {
        const container = target.parentNode;
        const children = Array.from(container.children);
        const draggedIdx = children.indexOf(draggedElement);
        const targetIdx = children.indexOf(target);

        if (draggedIdx < targetIdx) {
          container.insertBefore(draggedElement, target.nextSibling);
        } else {
          container.insertBefore(draggedElement, target);
        }
        showToast('Widget positions updated!');
        if (typeof saveSetting === 'function') saveSetting('widget_order', currentWidgetOrder());
      }
      return false;
    }

    function handleDragEnd(e) {
      document.querySelectorAll('.draggable-widget').forEach(widget => {
        widget.classList.remove('opacity-40', 'scale-95', 'ring-2', 'ring-amber-400', 'ring-offset-2');
      });
      draggedElement = null;
    }

    // Live Dynamic Greeting
    function updateGreeting() {
      const hour = new Date().getHours();
      const name = getDisplayName();
      const greetingEl = document.getElementById('greeting-text');
      const nameEl = document.getElementById('greeting-name');
      if (hour < 12) {
        if (greetingEl) greetingEl.innerText = 'Good morning';
        if (nameEl) nameEl.innerText = `${name} ☀️`;
      } else if (hour < 18) {
        if (greetingEl) greetingEl.innerText = 'Good afternoon';
        if (nameEl) nameEl.innerText = `${name} 🌤️`;
      } else {
        if (greetingEl) greetingEl.innerText = 'Good evening';
        if (nameEl) nameEl.innerText = `${name} 🌙`;
      }
      updateAvatarInitials(name);
    }

    // Navigation Tab Switching (dashboard <-> settings views)
    function switchTab(tabName, btnElement) {
      document.querySelectorAll('.nav-btn').forEach(btn => {
        if (btn.id !== 'btn-rearrange') {
          btn.className = "nav-btn px-4 py-2 rounded-full text-xs sm:text-sm font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-300/40 transition-all duration-200";
        }
      });
      btnElement.className = "nav-btn px-4 py-2 rounded-full text-xs sm:text-sm font-semibold bg-stone-900 text-white shadow-sm transition-all duration-200";

      const dashboardEl = document.getElementById('dashboard-view');
      const tasksEl = document.getElementById('tasks-view');
      const settingsEl = document.getElementById('settings-view');
      const isTasks = tabName === 'tasks';
      const isSettings = tabName === 'settings';

      if (settingsEl) settingsEl.classList.toggle('hidden', !isSettings);
      if (tasksEl) tasksEl.classList.toggle('hidden', !isTasks);
      if (dashboardEl) dashboardEl.classList.toggle('hidden', isTasks || isSettings);

      if (isSettings) {
        if (typeof loadSettingsPage === 'function') loadSettingsPage();
        showToast('Editing your workspace preferences');
      } else if (isTasks) {
        if (typeof loadTasksPage === 'function') loadTasksPage();
        showToast('Reviewing all tasks');
      } else {
        showToast(`Switched view to: ${tabName.toUpperCase()}`);
      }
    }

    // ---- Settings (server-backed via /api/settings, localStorage fallback) ----
    const SETTINGS_KEY = 'checkboxNewDashboardSettings';
    const SETTING_LABELS = {
      'widget-hero': 'Focus Task',
      'widget-timer': 'Focus Timer',
      'widget-tasks': 'Daily Tasks',
      'widget-empty-3': 'Empty Slot 1',
      'widget-chart': 'Analytics Tracker',
      'widget-empty-1': 'Empty Slot 2',
      'widget-empty-2': 'Empty Slot 3',
    };
    const SETTINGS_DEFAULTS = {
      user_name: 'Alex',
      weekly_focus_hours: 40,
      daily_task_target: 8,
      archive_days: 30,
      waking_hours: 16,
      widget_order: ['widget-hero', 'widget-timer', 'widget-tasks', 'widget-empty-3', 'widget-chart', 'widget-empty-1', 'widget-empty-2'],
    };

    // Applied settings cache — seeded from localStorage, overridden by the server.
    let settingsLocal = { ...SETTINGS_DEFAULTS };
    try {
      settingsLocal = { ...SETTINGS_DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
    } catch (_) {}

    function persistLocalSettings() {
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsLocal)); } catch (_) {}
    }

    function getSetting(key) {
      return settingsLocal[key] !== undefined ? settingsLocal[key] : SETTINGS_DEFAULTS[key];
    }

    function getDisplayName() {
      return String(getSetting('user_name') || SETTINGS_DEFAULTS.user_name).trim() || SETTINGS_DEFAULTS.user_name;
    }

    window.getSetting = getSetting;

    // Persist one setting: apply locally first, then mirror to the server when reachable.
    async function saveSetting(key, value, toastMsg) {
      settingsLocal[key] = value;
      persistLocalSettings();
      applySettingToDashboard(key);
      updateLayoutPreview();
      try {
        const res = await fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings: { [key]: value } }),
        });
        if (!res.ok) throw new Error('server rejected');
        if (toastMsg) showToast(toastMsg);
      } catch (_) {
        if (toastMsg) showToast('Offline — saved in this browser only');
      }
    }

    function applySettingToDashboard(key) {
      if (key === 'user_name') {
        updateGreeting();
      } else if (key === 'weekly_focus_hours') {
        updateWeeklyTarget();
      } else if (key === 'daily_task_target') {
        updateDailyTarget();
      } else if (key === 'widget_order') {
        applyWidgetOrder(getSetting('widget_order'));
      }
    }

    function applySettingsToDashboard() {
      applyWidgetOrder(getSetting('widget_order'));
      updateWeeklyTarget();
      updateDailyTarget();
      updateGreeting();
    }

    async function loadSettingsFromServer() {
      try {
        const res = await fetch('/api/settings');
        if (!res.ok) return;
        const data = await res.json();
        const server = (data && data.settings) || {};
        settingsLocal = { ...settingsLocal, ...server };
        persistLocalSettings();
        applySettingsToDashboard();
      } catch (_) {}
    }

    function updateAvatarInitials(name) {
      const els = document.querySelectorAll('.avatar-initials, #setting-avatar-preview');
      const initials = name.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'AX';
      els.forEach(el => { if (el) el.innerText = initials; });
    }

    function updateWeeklyTarget() {
      const el = document.getElementById('weekly-target-pill');
      if (!el) return;
      el.classList.remove('hidden');
      el.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>Weekly target: ' + getSetting('weekly_focus_hours') + 'h';
    }

    function updateDailyTarget() {
      const el = document.getElementById('daily-target-label');
      if (!el) return;
      el.classList.remove('hidden');
      el.innerText = 'Target: ' + getSetting('daily_task_target') + '/day';
    }

    function updateGreetingPreview() {
      const name = (document.getElementById('setting-username').value.trim() || SETTINGS_DEFAULTS.user_name);
      document.getElementById('setting-avatar-preview').innerText =
        name.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'AX';

      const hour = new Date().getHours();
      const emoji = hour < 12 ? '☀️' : (hour < 18 ? '🌤️' : '🌙');
      const prefix = hour < 12 ? 'Good morning' : (hour < 18 ? 'Good afternoon' : 'Good evening');
      document.getElementById('setting-greeting-preview-main').innerText = prefix;
      document.getElementById('setting-greeting-preview').innerText = `${name} ${emoji}`;
      document.getElementById('setting-date-preview').innerText = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }

    // ---- Widget order helpers ----
    const WIDGET_ROW2_IDS = ['widget-chart', 'widget-empty-1', 'widget-empty-2'];

    function currentWidgetOrder() {
      const row1 = Array.from(document.querySelectorAll('#widgets-row-1 .draggable-widget')).map(el => el.id);
      const row2 = Array.from(document.querySelectorAll('#widgets-row-2 .draggable-widget')).map(el => el.id);
      return row1.concat(row2);
    }

    function applyWidgetOrder(order) {
      if (!Array.isArray(order) || !order.length) return;
      const row1 = document.getElementById('widgets-row-1');
      const row2 = document.getElementById('widgets-row-2');
      order.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const dest = WIDGET_ROW2_IDS.indexOf(id) !== -1 ? row2 : row1;
        if (el.parentNode === dest) dest.appendChild(el);
      });
    }

    function updateLayoutPreview() {
      const box = document.getElementById('setting-layout-preview');
      if (!box) return;
      const order = currentWidgetOrder();
      box.innerHTML = order.length
        ? order.map(id => '<span class="text-[10px] font-bold bg-stone-200 text-stone-700 px-2.5 py-1 rounded-full">' + (SETTING_LABELS[id] || id) + '</span>').join('')
        : '<span class="text-[10px] font-bold bg-stone-200 text-stone-700 px-2.5 py-1 rounded-full">—</span>';
    }

    function saveLayout() {
      saveSetting('widget_order', currentWidgetOrder(), 'Widget layout saved');
    }

    function resetLayout() {
      applyWidgetOrder(SETTINGS_DEFAULTS.widget_order);
      saveSetting('widget_order', currentWidgetOrder(), 'Widget layout reset to default');
    }

    // ---- Settings page population & actions ----
    function loadSettingsPage() {
      const input = document.getElementById('setting-username');
      if (input) input.value = getDisplayName();
      const weekly = document.getElementById('setting-weekly-hours');
      if (weekly) weekly.value = getSetting('weekly_focus_hours');
      const daily = document.getElementById('setting-daily-target');
      if (daily) daily.value = getSetting('daily_task_target');
      const archive = document.getElementById('setting-archive-days');
      if (archive) archive.value = getSetting('archive_days');
      const waking = document.getElementById('setting-waking-hours');
      if (waking) waking.value = getSetting('waking_hours');
      document.getElementById('setting-server').innerText = location.host || 'local';
      updateLayoutPreview();
      updateGreetingPreview();
      checkApiHealth();
    }

    function saveUserSettings() {
      const name = document.getElementById('setting-username').value.trim() || SETTINGS_DEFAULTS.user_name;
      saveSetting('user_name', name, `Saved — welcome back, ${name}`);
      updateGreetingPreview();
      const dashBtn = document.querySelector('.nav-btn');
      if (dashBtn) switchTab('dashboard', dashBtn);
    }

    function resetUserSettings() {
      const input = document.getElementById('setting-username');
      if (input) input.value = SETTINGS_DEFAULTS.user_name;
      updateGreetingPreview();
      showToast('Preview reset — click Save to apply');
    }

    function saveTargets() {
      const weeklyEl = document.getElementById('setting-weekly-hours');
      const dailyEl = document.getElementById('setting-daily-target');
      const archiveEl = document.getElementById('setting-archive-days');
      const wakingEl = document.getElementById('setting-waking-hours');
      const weekly = Math.min(168, Math.max(1, parseInt(weeklyEl.value, 10) || SETTINGS_DEFAULTS.weekly_focus_hours));
      const daily = Math.min(50, Math.max(1, parseInt(dailyEl.value, 10) || SETTINGS_DEFAULTS.daily_task_target));
      const archiveDays = Math.min(365, Math.max(1, parseInt(archiveEl.value, 10) || SETTINGS_DEFAULTS.archive_days));
      const wakingHours = Math.min(24, Math.max(1, parseInt(wakingEl.value, 10) || SETTINGS_DEFAULTS.waking_hours));
      weeklyEl.value = weekly;
      dailyEl.value = daily;
      archiveEl.value = archiveDays;
      wakingEl.value = wakingHours;
      settingsLocal.weekly_focus_hours = weekly;
      settingsLocal.daily_task_target = daily;
      settingsLocal.archive_days = archiveDays;
      settingsLocal.waking_hours = wakingHours;
      updateWeeklyTarget();
      updateDailyTarget();
      saveSetting('weekly_focus_hours', weekly);
      saveSetting('daily_task_target', daily);
      saveSetting('archive_days', archiveDays, 'Dashboard targets saved');
      saveSetting('waking_hours', wakingHours);
      if (typeof loadData === 'function') loadData();
    }

    function resetTargets() {
      document.getElementById('setting-weekly-hours').value = SETTINGS_DEFAULTS.weekly_focus_hours;
      document.getElementById('setting-daily-target').value = SETTINGS_DEFAULTS.daily_task_target;
      document.getElementById('setting-archive-days').value = SETTINGS_DEFAULTS.archive_days;
      document.getElementById('setting-waking-hours').value = SETTINGS_DEFAULTS.waking_hours;
      showToast('Preview reset — click Save Targets to apply');
    }

    async function checkApiHealth() {
      const el = document.getElementById('setting-api-status');
      if (!el) return;
      try {
        const res = await fetch('/api/health');
        const ok = res.ok;
        el.className = 'inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0 ' + (ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700');
        el.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-current"></span>' + (ok ? 'Online' : 'Degraded');
      } catch (_) {
        el.className = 'inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0 bg-red-100 text-red-700';
        el.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-current"></span>Offline';
      }
    }

    // Initialize: apply locally-cached settings, then merge in any server-side values.
    applySettingsToDashboard();
    updateLayoutPreview();
    loadSettingsFromServer();

    // Pomodoro Timer Logic
    let timerInterval = null;
    let timerSeconds = 1500; // 25 mins default
    let totalSecondsMode = 1500;
    let isTimerRunning = false;

    function formatTimerDisplay(secs) {
      const mins = Math.floor(secs / 60);
      const remaining = secs % 60;
      return `${String(mins).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
    }

    function updateTimerArc() {
      const arc = document.getElementById('timer-arc');
      const percentage = (timerSeconds / totalSecondsMode) * 100;
      arc.setAttribute('stroke-dasharray', `${percentage}, 100`);
    }

    function toggleTimer() {
      const playIcon = document.getElementById('play-icon');
      if (isTimerRunning) {
        pauseTimer();
      } else {
        isTimerRunning = true;
        showToast("Focus Timer started");
        playIcon.innerHTML = `<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5 0a1 1 0 012 0v4a1 1 0 11-2 0V8z" clip-rule="evenodd"/>`;
        timerInterval = setInterval(() => {
          if (timerSeconds > 0) {
            timerSeconds--;
            document.getElementById('timer-display').innerText = formatTimerDisplay(timerSeconds);
            updateTimerArc();
          } else {
            pauseTimer();
            showToast("🎉 Focus session complete! Take a break.");
          }
        }, 1000);
      }
    }

    function pauseTimer() {
      isTimerRunning = false;
      clearInterval(timerInterval);
      const playIcon = document.getElementById('play-icon');
      playIcon.innerHTML = `<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"/>`;
    }

    function resetTimer() {
      pauseTimer();
      timerSeconds = totalSecondsMode;
      document.getElementById('timer-display').innerText = formatTimerDisplay(timerSeconds);
      updateTimerArc();
      showToast("Timer reset");
    }

    function setTimerMode(mode, btnEl) {
      pauseTimer();
      document.querySelectorAll('.timer-mode-btn').forEach(b => {
        b.className = "timer-mode-btn bg-stone-200/80 text-stone-700 text-[10px] font-semibold px-2 py-0.5 rounded-full hover:bg-stone-300 transition-all";
      });
      btnEl.className = "timer-mode-btn bg-stone-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-full transition-all";

      if (mode === 'focus') {
        totalSecondsMode = 1500;
        document.getElementById('timer-status-label').innerText = "Deep Work";
      } else {
        totalSecondsMode = 300;
        document.getElementById('timer-status-label').innerText = "Rest Break";
      }
      timerSeconds = totalSecondsMode;
      document.getElementById('timer-display').innerText = formatTimerDisplay(timerSeconds);
      updateTimerArc();
    }

    // Modal Control Functions
    function openNewTaskModal() {
      const modal = document.getElementById('new-task-modal');
      const box = document.getElementById('modal-box');
      modal.classList.remove('opacity-0', 'pointer-events-none');
      box.classList.remove('scale-95');
      box.classList.add('scale-100');
    }

    function closeNewTaskModal() {
      const modal = document.getElementById('new-task-modal');
      const box = document.getElementById('modal-box');
      modal.classList.add('opacity-0', 'pointer-events-none');
      box.classList.remove('scale-100');
      box.classList.add('scale-95');
    }

    // Habit Tracker Toggle
    function toggleHabit(el) {
      const badge = el.querySelector('.habit-badge');
      if (badge.innerText.includes('Done')) {
        badge.innerText = 'Pending';
        badge.className = 'habit-badge text-[10px] font-semibold bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full';
      } else {
        badge.innerText = '✓ Done';
        badge.className = 'habit-badge text-[10px] font-extrabold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full';
        showToast('Habit completed! +10 XP');
      }
    }

    // Accordion Expansion Handler
    function toggleAccordion(id) {
      const content = document.getElementById(id);
      const icon = document.getElementById(`icon-${id}`);
      if (!content) return;

      const isHidden = content.classList.contains('hidden');
      if (isHidden) {
        content.classList.remove('hidden');
        if (icon) icon.classList.add('rotate-180');
      } else {
        content.classList.add('hidden');
        if (icon) icon.classList.remove('rotate-180');
      }
    }

    // Toast Banner Handler
    function showToast(message) {
      const toast = document.getElementById('toast');
      const toastMsg = document.getElementById('toast-msg');
      toastMsg.innerText = message;
      toast.classList.remove('opacity-0', 'translate-y-4', 'pointer-events-none');
      
      setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-4', 'pointer-events-none');
      }, 2500);
    }
