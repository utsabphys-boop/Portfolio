const portfolioMotionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
const runningPortfolioAnimations = new Set();

function playPortfolioAnimation(element, frames, options) {
  if (portfolioMotionPreference.matches || typeof element.animate !== "function") return;

  const animation = element.animate(frames, {
    easing: "cubic-bezier(.2,.65,.3,1)",
    ...options,
  });
  runningPortfolioAnimations.add(animation);

  const forget = () => runningPortfolioAnimations.delete(animation);
  animation.addEventListener("finish", forget, { once: true });
  animation.addEventListener("cancel", forget, { once: true });
  return animation;
}

portfolioMotionPreference.addEventListener?.("change", (event) => {
  if (event.matches) {
    for (const animation of runningPortfolioAnimations) animation.cancel();
  }
});

if ("IntersectionObserver" in window) {
  const entranceObserver = new IntersectionObserver((entries, observer) => {
    for (const { target, isIntersecting } of entries) {
      if (!isIntersecting) continue;
      observer.unobserve(target);

      if (!target.matches(":focus-within")) {
        playPortfolioAnimation(target, [
          { opacity: .45, transform: "translateY(14px)" },
          { opacity: 1, transform: "translateY(0)" },
        ], { duration: 440 });
      }
    }
  }, { rootMargin: "0px 0px -24px" });

  const revealAreas = ".hero, .section-heading, .research-intro, .research-gallery, .research-card, " +
    ".statement-panel, [data-year-viewport], .profile-panel";
  for (const area of document.querySelectorAll(revealAreas)) entranceObserver.observe(area);

  const destinationObserver = new IntersectionObserver((entries, observer) => {
    for (const { target, intersectionRatio } of entries) {
      if (intersectionRatio < .65) continue;
      observer.unobserve(target);
      playPortfolioAnimation(target, [
        { opacity: .62, transform: "translateX(-10px)" },
        { opacity: 1, transform: "translateX(0)" },
      ], { duration: 480 });
    }
  }, { threshold: .65 });

  const animateDestination = () => {
    destinationObserver.disconnect();
    const section = document.getElementById(window.location.hash.slice(1));
    const heading = section?.querySelector("h2");
    if (heading && !portfolioMotionPreference.matches) destinationObserver.observe(heading);
  };

  window.addEventListener("hashchange", animateDestination);
  document.querySelector(".nav").addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (link && link.hash === window.location.hash) animateDestination();
  });
}

for (const card of document.querySelectorAll("details.research-card, details.research-overview")) {
  const summary = card.querySelector("summary");
  let animation;
  let targetOpen;

  summary.addEventListener("click", (event) => {
    if (event.defaultPrevented || typeof card.animate !== "function") return;
    if (portfolioMotionPreference.matches && !animation) return;

    event.preventDefault();
    targetOpen = animation ? !targetOpen : !card.open;
    const startHeight = card.getBoundingClientRect().height;
    const previousAnimation = animation;
    animation = undefined;
    previousAnimation?.cancel();

    if (portfolioMotionPreference.matches) {
      card.open = targetOpen;
      return;
    }

    let endHeight;
    if (targetOpen) {
      card.open = true;
      endHeight = card.getBoundingClientRect().height;
    } else {
      const style = getComputedStyle(card);
      endHeight = summary.getBoundingClientRect().height +
        parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    }

    const resize = playPortfolioAnimation(card, [
      { height: `${startHeight}px`, overflow: "hidden" },
      { height: `${endHeight}px`, overflow: "hidden" },
    ], { duration: 320, fill: "both" });
    animation = resize;

    const settle = () => {
      if (animation !== resize) return;
      animation = undefined;
      card.open = targetOpen;
      resize.cancel();
    };
    resize.addEventListener("finish", settle, { once: true });
    resize.addEventListener("cancel", settle, { once: true });
  });
}

for (const section of document.querySelectorAll("[data-year-filter]")) {
  const filters = section.querySelector(".filters");
  const buttons = [...filters.querySelectorAll("button[data-filter]")];
  const entries = section.querySelectorAll("[data-year]");
  const results = section.querySelector("[data-year-results]");
  const viewport = results.parentElement;
  const status = section.querySelector('[role="status"]');
  const itemName = section.dataset.yearFilter;

  let transition = [];
  filters.hidden = false;

  filters.addEventListener("click", (event) => {
    const selected = event.target.closest("button[data-filter]");
    if (!selected || selected.getAttribute("aria-pressed") === "true") return;

    const animate = !portfolioMotionPreference.matches && typeof results.animate === "function";
    const heightBefore = animate ? viewport.getBoundingClientRect().height : 0;
    for (const animation of transition) animation.cancel();
    transition = [];

    const previous = buttons.findIndex((button) => button.getAttribute("aria-pressed") === "true");
    const direction = buttons.indexOf(selected) > previous ? 1 : -1;
    const outgoing = animate ? results.cloneNode(true) : null;

    for (const button of buttons) {
      button.setAttribute("aria-pressed", String(button === selected));
    }

    const year = selected.dataset.filter;
    const visible = [];
    for (const entry of entries) {
      entry.hidden = year !== "all" && entry.dataset.year !== year;
      if (!entry.hidden) visible.push(entry);
    }
    const noun = visible.length === 1 ? itemName : `${itemName}s`;
    status.textContent = `Showing ${visible.length} ${noun}.`;

    if (!outgoing) return;

    const heightAfter = viewport.getBoundingClientRect().height;
    outgoing.removeAttribute("data-year-results");
    outgoing.setAttribute("aria-hidden", "true");
    outgoing.inert = true;
    outgoing.classList.add("year-results-outgoing");
    viewport.append(outgoing);

    const options = { duration: 360 };
    const leave = playPortfolioAnimation(outgoing, [
      { transform: "translateX(0)" },
      { transform: `translateX(${-direction * 100}%)` },
    ], options);
    const removeOutgoing = () => outgoing.remove();
    leave.addEventListener("finish", removeOutgoing, { once: true });
    leave.addEventListener("cancel", removeOutgoing, { once: true });
    transition = [
      leave,
      playPortfolioAnimation(results, [
        { transform: `translateX(${direction * 100}%)` },
        { transform: "translateX(0)" },
      ], options),
      playPortfolioAnimation(viewport, [
        { height: `${heightBefore}px`, overflow: "hidden" },
        { height: `${heightAfter}px`, overflow: "hidden" },
      ], options),
    ];
  });
}
