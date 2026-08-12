(function () {
  App.register("notes", {
    bind(el) {
      const area = el.querySelector("#notes-textarea");
      const btn = el.querySelector("#btn-save-notes");

      if (area) {
        area.value = localStorage.getItem("checkbox_quick_note") || "";
      }

      if (btn && area) {
        btn.addEventListener("click", async () => {
          const content = area.value.trim();
          if (!content) {
            if (typeof toast === "function") toast("Nothing to save", "info");
            return;
          }
          try {
            await fetchJSON("/api/journal", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type: "note", content, date: todayISO() }),
            });
            localStorage.removeItem("checkbox_quick_note");
            area.value = "";
            if (typeof toast === "function") toast("Note saved to journal", "success");
          } catch (err) {
            if (typeof toast === "function") toast("Failed: " + err.message, "error");
          }
        });
      }
    },
  });
})();