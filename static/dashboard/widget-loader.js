/* =====================================================================
 * Check Box — New Dashboard widget loader
 *
 * The dashboard widgets (hero, timer, task-list, chart, empty-slot) are
 * stored as markup in static/widgets/<name>/index.html. Each is mounted
 * in the dashboard HTML via an empty container:
 *
 *     <div id="widget-hero" data-dashboard-widget="hero"></div>
 *
 * This loader fetches those templates, injects them (re-applying the
 * mount's id to the widget root so the drag/reorder + analytics code can
 * still find them), and only then boots the dashboard engine scripts:
 * interactions.js -> analytics-chart.js -> app.js.
 *
 * ===================================================================== */
(function () {
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error("Failed to load " + src)); };
      document.head.appendChild(s);
    });
  }

  function injectWidgets() {
    var mounts = Array.prototype.slice.call(
      document.querySelectorAll("[data-dashboard-widget]")
    );
    return Promise.all(
      mounts.map(function (mount) {
        var name = mount.getAttribute("data-dashboard-widget");
        var url = "/widgets/" + name + "/index.html";
        return fetch(url)
          .then(function (res) {
            if (!res.ok) throw new Error(res.status + " " + res.statusText);
            return res.text();
          })
          .then(function (html) {
            var tmp = document.createElement("div");
            tmp.innerHTML = html;
            var node = tmp.firstElementChild;
            if (!node) throw new Error("Empty widget template: " + name);
            if (mount.id) node.id = mount.id; // e.g. widget-hero, widget-empty-1/2/3
            mount.replaceWith(node);
          })
          .catch(function (err) {
            mount.outerHTML =
              '<div class="p-5 text-xs font-semibold text-red-500">Failed to load widget "' +
              name + '": ' + err.message + "</div>";
          });
      })
    );
  }

  window.loadDashboardWidgets = injectWidgets;

  // Boot the engine scripts only after every widget is in the DOM, since
  // app.js renderAll()/analytics-chart.js query the widget elements by id.
  window.dashboardReady = injectWidgets()
    .then(function () {
      return ["dashboard/interactions.js", "dashboard/analytics-chart.js", "dashboard/app.js"].reduce(
        function (chain, src) {
          return chain.then(function () { return loadScript(src); });
        },
        Promise.resolve()
      );
    })
    .catch(function (err) {
      console.error("[widget-loader]", err);
    });
})();
