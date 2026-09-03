(() => {
  const base = document.createElement("base");
  base.href = "../";
  document.head.prepend(base);
  const script = document.createElement("script");
  script.src = "../ops.js";
  document.head.appendChild(script);
})();
