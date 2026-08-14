(function () {
        const barsContainer = document.getElementById('bars-container');
        const chartWrapper = document.getElementById('chart-wrapper');
        const chartTooltip = document.getElementById('chart-tooltip');
        const tooltipText = document.getElementById('tooltip-text');
        const xaxis = document.getElementById('chart-xaxis');
        const metric1Val = document.getElementById('metric1-val');
        const metric1Badge = document.getElementById('metric1-badge');
        const metric2Val = document.getElementById('metric2-val');
        const metric2Badge = document.getElementById('metric2-badge');

        if (!barsContainer) return;

        let activeRange = 'daily';
        let activeTab = 'Tracker';
        let lastData = null;
        let activeStartedAt = null;
        let lastDataKey = '';
        let loadSeq = 0;

        const TAB_BASE =
          'tab-btn px-4 py-1.5 rounded-full text-xs transition-all duration-200 ';
        const RANGE_BASE =
          'range-btn px-3 py-1 rounded-full text-xs transition-all duration-200 ';

        function tabClass(active) {
          return (
            TAB_BASE +
            (active
              ? 'font-bold bg-[#F5C200] text-stone-900 shadow-sm'
              : 'font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-200/50')
          );
        }

        function rangeClass(active) {
          return (
            RANGE_BASE +
            (active
              ? 'font-bold bg-[#F5C200] text-stone-900 shadow-sm'
              : 'font-medium text-stone-600 hover:text-stone-900')
          );
        }

        function fmtHrs(secs) {
          if (!secs) return '0h';
          const h = secs / 3600;
          return h >= 10 ? Math.round(h) + 'h' : h.toFixed(1) + 'h';
        }

        function fetchJSON(url) {
          return fetch(url).then((r) => {
            if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
            return r.json();
          });
        }

        function chartToast(text) {
          const toast = document.getElementById('widget-toast-msg');
          if (!toast) return;
          toast.textContent = text;
          toast.classList.remove('opacity-0', 'translate-y-2', 'pointer-events-none');
          toast.classList.add('opacity-100', 'translate-y-0');
          setTimeout(() => {
            toast.classList.add('opacity-0', 'translate-y-2', 'pointer-events-none');
            toast.classList.remove('opacity-100', 'translate-y-0');
          }, 2000);
        }

        function renderXAxis(buckets) {
          if (!xaxis) return;
          const n = buckets.length;
          const idxs =
            n <= 4
              ? buckets.map((_, i) => i)
              : [0, Math.floor((n - 1) / 3), Math.floor((2 * (n - 1)) / 3), n - 1];
          xaxis.innerHTML = '';
          idxs.forEach((i) => {
            const s = document.createElement('span');
            s.textContent = buckets[i] ? buckets[i].label : '';
            xaxis.appendChild(s);
          });
        }

        function renderBars(buckets) {
          barsContainer.innerHTML = '';
          renderXAxis(buckets);
          buckets.forEach((bucket, idx) => {
            const isCurrent = idx === buckets.length - 1;
            const wrap = document.createElement('div');
            wrap.className = 'flex-1 h-full flex items-end justify-center group cursor-pointer px-0.5 relative';
            const bar = document.createElement('div');
            const bgClass = isCurrent ? 'bg-brandYellow shadow-sm' : 'bg-stone-800 hover:bg-stone-700';
            bar.className = 'w-full max-w-[14px] sm:max-w-[18px] rounded-full bar-transition ' + bgClass;
            bar.style.height = Math.max(6, Math.min(100, bucket.focus_score)) + '%';
            wrap.appendChild(bar);

            wrap.addEventListener('mouseenter', () => {
              tooltipText.textContent =
                'Created ' + bucket.tasks_created +
                ' · Done ' + bucket.tasks_completed +
                ' · Focus ' + bucket.focus_score + '%';
              const barRect = bar.getBoundingClientRect();
              const wrapperRect = chartWrapper.getBoundingClientRect();
              const barCenterX = barRect.left - wrapperRect.left + (barRect.width / 2);
              chartTooltip.style.left = barCenterX + 'px';
              chartTooltip.style.top = (barRect.top - wrapperRect.top) + 'px';
              chartTooltip.classList.remove('hidden', 'opacity-0');
              chartTooltip.classList.add('opacity-100');

              const tipRect = chartTooltip.getBoundingClientRect();
              const half = tipRect.width / 2;
              const minX = half + 2;
              const maxX = wrapperRect.width - half - 2;
              chartTooltip.style.left = Math.max(minX, Math.min(maxX, barCenterX)) + 'px';

              const above = barRect.top - wrapperRect.top;
              if (above - tipRect.height < 0) {
                chartTooltip.style.top = Math.max(tipRect.height, above) + 'px';
              }
            });
            wrap.addEventListener('mouseleave', () => {
              chartTooltip.classList.add('opacity-0');
              chartTooltip.classList.remove('opacity-100');
            });
            barsContainer.appendChild(wrap);
          });
        }

        function renderMetrics(data, elapsedMs) {
          const buckets = (data && data.buckets) || [];
          const last = buckets[buckets.length - 1];
          if (!last) {
            metric1Val.textContent = '0';
            metric1Badge.textContent = 'of 0 created';
            metric2Val.textContent = '0';
            metric2Badge.textContent = '0h deep work';
            return;
          }
          metric1Val.textContent = String(last.tasks_completed);
          metric1Badge.textContent = 'of ' + last.tasks_created + ' created';
          let focus = last.focus_score;
          let workSecs = last.work_seconds;
          if (elapsedMs > 0) {
            const wakeSecs = ((data.waking_hours || 16) * 3600) || 1;
            workSecs += elapsedMs / 1000;
            focus = Math.min(100, Math.round((workSecs / wakeSecs) * 1000) / 10);
          }
          metric2Val.textContent = String(Math.round(focus));
          metric2Badge.textContent = fmtHrs(workSecs) + ' deep work';
        }

        function renderWithData(data, elapsedMs) {
          renderBars((data && data.buckets) || []);
          renderMetrics(data, elapsedMs);
        }

        function renderPlaceholder() {
          barsContainer.innerHTML = '';
          if (xaxis) xaxis.innerHTML = '';
          lastDataKey = '';
          metric1Val.textContent = '—';
          metric1Badge.textContent = 'no data';
          metric2Val.textContent = '—';
          metric2Badge.textContent = 'no data';
          const msg = document.createElement('div');
          msg.className = 'w-full h-full flex items-center justify-center text-[11px] font-semibold text-stone-400 select-none';
          msg.textContent = 'No data for ' + activeTab + ' yet — track tasks to see this page populate.';
          barsContainer.appendChild(msg);
        }

        async function loadChart() {
          const seq = ++loadSeq;
          try {
            const [data, active] = await Promise.all([
              fetchJSON('/api/analytics?range=' + activeRange),
              fetchJSON('/api/sessions/active'),
            ]);
            if (seq !== loadSeq) return;
            lastData = data;
            if (active && active.session) {
              activeStartedAt = new Date(active.session.started_at).getTime();
            } else {
              activeStartedAt = null;
            }
            const elapsed =
              activeRange === 'daily' && activeStartedAt
                ? Math.max(0, Date.now() - activeStartedAt)
                : 0;
            const key = JSON.stringify(data);
            if (key !== lastDataKey) {
              lastDataKey = key;
              renderBars(data.buckets || []);
            }
            renderMetrics(data, elapsed);
          } catch (err) {
            if (seq !== loadSeq) return;
            chartToast('Failed to load chart data: ' + err.message);
          }
        }

        const chartEl = document.getElementById('widget-chart');
        const tabBtns = chartEl ? chartEl.querySelectorAll('.tab-btn') : [];
        tabBtns.forEach((btn) => {
          btn.addEventListener('click', () => {
            tabBtns.forEach((b) => { b.className = tabClass(b === btn); });
            chartToast('Switched to ' + btn.dataset.tab);
            activeTab = btn.dataset.tab;
            if (activeTab === 'Tracker') {
              loadChart();
            } else {
              renderPlaceholder();
            }
          });
        });

        const rangeButtons = document.querySelectorAll('#range-nav .range-btn');
        rangeButtons.forEach((btn) => {
          btn.addEventListener('click', () => {
            activeRange = btn.dataset.range;
            rangeButtons.forEach((b) => { b.className = rangeClass(b.dataset.range === activeRange); });
            if (activeTab === 'Tracker') loadChart();
          });
        });

        loadChart();

        const tabsScroller = document.getElementById('tabs-scroller');
        const tabsLeftBtn = document.getElementById('tabs-scroll-left');
        const tabsRightBtn = document.getElementById('tabs-scroll-right');

        function updateTabScroll() {
          if (!tabsScroller) return;
          const maxScroll = tabsScroller.scrollWidth - tabsScroller.clientWidth;
          const hasOverflow = maxScroll > 4;
          if (tabsLeftBtn) tabsLeftBtn.classList.toggle('show', hasOverflow && tabsScroller.scrollLeft > 4);
          if (tabsRightBtn) tabsRightBtn.classList.toggle('show', hasOverflow && tabsScroller.scrollLeft < maxScroll - 4);
        }

        if (tabsScroller) {
          tabsScroller.addEventListener('scroll', updateTabScroll, { passive: true });
          if (tabsLeftBtn) {
            tabsLeftBtn.addEventListener('click', () => tabsScroller.scrollBy({ left: -180, behavior: 'smooth' }));
          }
          if (tabsRightBtn) {
            tabsRightBtn.addEventListener('click', () => tabsScroller.scrollBy({ left: 180, behavior: 'smooth' }));
          }
        }

        window.addEventListener('resize', () => {
          chartTooltip.classList.add('opacity-0');
          updateTabScroll();
        });

        updateTabScroll();

        setInterval(() => {
          if (activeTab !== 'Tracker') return;
          if (activeRange === 'daily' && activeStartedAt && lastData) {
            renderMetrics(lastData, Math.max(0, Date.now() - activeStartedAt));
          } else {
            loadChart();
          }
        }, 30000);
      })();