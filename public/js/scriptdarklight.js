(() => {
  const saved = localStorage.getItem("theme");
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.setAttribute(
    "data-bs-theme",
    saved || (systemDark ? "dark" : "light"),
  );
})();

document.addEventListener("DOMContentLoaded", () => {
  const html = document.documentElement;
  const toggle = document.getElementById("darkModeSwitch");
  const sun = document.getElementById("theme-icon-light");
  const moon = document.getElementById("theme-icon-dark");

  const isDark = html.getAttribute("data-bs-theme") === "dark";
  toggle.checked = isDark;
  updateIcons(isDark);

  toggle.addEventListener("change", () => {
    const theme = toggle.checked ? "dark" : "light";
    html.setAttribute("data-bs-theme", theme);
    localStorage.setItem("theme", theme);
    updateIcons(toggle.checked);
  });

  function updateIcons(dark) {
    sun.className = `bi bi-sun-fill ${dark ? "text-muted" : "text-warning"}`;
    moon.className = `bi bi-moon-stars-fill ${dark ? "text-primary" : "text-muted"}`;
  }
});
