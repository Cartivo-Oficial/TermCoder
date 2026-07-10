(function () {
  var data = window.HERO_SESSION;
  var body = document.getElementById("termBody");
  if (!data || !body) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function render(line, text) {
    var el = document.createElement("div");
    el.className = "tline " + line.kind;
    if (line.kind === "prompt") {
      var p = document.createElement("span");
      p.className = "p";
      p.textContent = "❯";
      el.appendChild(p);
      el.appendChild(document.createTextNode(" " + text));
    } else if (line.kind === "tool") {
      var t = document.createElement("span");
      t.className = "tk";
      t.textContent = "✓";
      el.appendChild(t);
      el.appendChild(document.createTextNode(" " + text));
    } else {
      el.textContent = text;
    }
    body.appendChild(el);
    return el;
  }

  if (reduced) {
    data.lines.forEach(function (line) {
      render(line, line.text);
    });
    return;
  }

  var i = 0;
  (function next() {
    if (i >= data.lines.length) return;
    var line = data.lines[i++];
    if (line.kind !== "prompt") {
      render(line, line.text);
      setTimeout(next, 420);
      return;
    }
    var el = render(line, "");
    var j = 0;
    (function type() {
      if (j < line.text.length) {
        el.appendChild(document.createTextNode(line.text[j++]));
        setTimeout(type, 32);
      } else {
        setTimeout(next, 520);
      }
    })();
  })();
})();
