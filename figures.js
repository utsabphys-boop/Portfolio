const gallery = document.querySelector("[data-figure-gallery]");
const stage = gallery.querySelector(".gallery-stage");
const slides = [...gallery.querySelectorAll(".gallery-slide")];
const controls = gallery.querySelector(".gallery-controls");
const navigation = gallery.querySelector(".gallery-navigation");
const playbackSwitch = gallery.querySelector(".gallery-playback-switch");
const progress = gallery.querySelector(".gallery-progress");
const progressFill = progress.querySelector(".gallery-progress-fill");
const status = gallery.querySelector('[role="status"]');
const reducedMotion = portfolioMotionPreference;

let active = 0;
let playing = !reducedMotion.matches;
let hovering = false;
let visible = !("IntersectionObserver" in window);
let timer;
let touchStart;
let clearTransition;

function prepareAdjacentFigures() {
  for (const step of [-1, 1]) {
    const adjacent = (active + step + slides.length) % slides.length;
    slides[adjacent].querySelector("img").loading = "eager";
  }
}

function schedule() {
  window.clearTimeout(timer);
  if (playing && visible && !hovering && !document.hidden) {
    timer = window.setTimeout(() => showFigure(1), 8500);
  }
}

function setPlayback(shouldPlay) {
  playing = shouldPlay;
  playbackSwitch.setAttribute("aria-checked", String(playing));
  playbackSwitch.title = playing ? "Pause slideshow" : "Play slideshow";
  schedule();
}

function updateProgress() {
  const number = active + 1;
  const position = `${number} of ${slides.length}`;
  progress.setAttribute("aria-valuenow", String(number));
  progress.setAttribute("aria-valuetext", position);
  progressFill.style.width = `${number / slides.length * 100}%`;
  return position;
}

function showFigure(step, announce = false) {
  clearTransition?.();

  const previous = slides[active];
  const focusWasOnSlide = previous.contains(document.activeElement);
  active = (active + step + slides.length) % slides.length;
  const current = slides[active];
  current.hidden = false;
  if (focusWasOnSlide) stage.focus({ preventScroll: true });

  if (!reducedMotion.matches && typeof current.animate === "function") {
    previous.classList.add("gallery-slide-outgoing");
    previous.inert = true;
    const options = { duration: 420 };
    const leave = playPortfolioAnimation(previous, [
      { transform: "translateX(0)" },
      { transform: `translateX(${-step * 100}%)` },
    ], options);
    const enter = playPortfolioAnimation(current, [
      { transform: `translateX(${step * 100}%)` },
      { transform: "translateX(0)" },
    ], options);
    const cleanup = () => {
      if (clearTransition !== cleanup) return;
      clearTransition = undefined;
      previous.hidden = true;
      previous.inert = false;
      previous.classList.remove("gallery-slide-outgoing");
      leave.cancel();
      enter.cancel();
    };
    clearTransition = cleanup;
    leave.addEventListener("finish", cleanup, { once: true });
    leave.addEventListener("cancel", cleanup, { once: true });
  } else {
    previous.hidden = true;
  }

  const position = updateProgress();
  prepareAdjacentFigures();

  if (announce) {
    const title = current.querySelector(".gallery-figure-title").textContent;
    status.textContent = `Slide ${position}. ${title}.`;
  }
  schedule();
}

progress.setAttribute("aria-valuemax", String(slides.length));
updateProgress();
setPlayback(playing);
controls.hidden = false;
navigation.hidden = false;
stage.tabIndex = 0;
prepareAdjacentFigures();

playbackSwitch.addEventListener("click", () => {
  setPlayback(!playing);
});

for (const arrow of navigation.querySelectorAll("button")) {
  arrow.addEventListener("click", () => showFigure(Number(arrow.dataset.galleryDirection), true));
}

gallery.addEventListener("keydown", (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    showFigure(event.key === "ArrowRight" ? 1 : -1, true);
  }
});

gallery.addEventListener("focusin", (event) => {
  if (event.target !== playbackSwitch && event.target.matches(":focus-visible")) {
    setPlayback(false);
  }
});

stage.addEventListener("pointerenter", (event) => {
  if (event.pointerType === "mouse") {
    hovering = true;
    schedule();
  }
});

stage.addEventListener("pointerleave", (event) => {
  if (event.pointerType === "mouse") {
    hovering = false;
    schedule();
  }
});

stage.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "touch" && !event.target.closest("a, button")) {
    touchStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }
});

stage.addEventListener("pointerup", (event) => {
  if (!touchStart || touchStart.id !== event.pointerId) return;
  const dx = event.clientX - touchStart.x;
  const dy = event.clientY - touchStart.y;
  touchStart = undefined;
  if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.4) {
    showFigure(dx < 0 ? 1 : -1, true);
  }
});

stage.addEventListener("pointercancel", () => { touchStart = undefined; });
document.addEventListener("visibilitychange", schedule);
reducedMotion.addEventListener("change", (event) => {
  if (event.matches) {
    setPlayback(false);
  }
});

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    schedule();
  }, { threshold: .2 });
  observer.observe(stage);
}
