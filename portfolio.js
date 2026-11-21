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
    let delay = 0;

    for (const { target, isIntersecting, boundingClientRect, rootBounds } of entries) {
      if (!isIntersecting) continue;
      observer.unobserve(target);

      if (!rootBounds || boundingClientRect.top < rootBounds.top ||
          target.matches(":focus-within")) continue;

      const animation = playPortfolioAnimation(target, [
        { opacity: .86, transform: "translateY(8px)" },
        { opacity: 1, transform: "translateY(0)" },
      ], { duration: 420, delay, fill: "backwards" });

      if (animation) delay = Math.min(delay + 35, 105);
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

for (const card of document.querySelectorAll("details")) {
  const summary = card.querySelector("summary");
  const arrow = summary?.querySelector(".card-arrow, .disclosure-arrow");
  if (!arrow) continue;

  const hoverBoundary = card.closest(".research-intro, .profile-panel") ?? card;
  let animation;
  let targetOpen;

  const isOpeningOrOpen = () => animation ? targetOpen : card.open;

  const setOpen = (open) => {
    if (open === isOpeningOrOpen()) return;
    targetOpen = open;
    if (!animation && (portfolioMotionPreference.matches || typeof card.animate !== "function")) {
      card.open = open;
      return;
    }

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
    ], {
      duration: open ? 320 : 420,
      easing: open ? "cubic-bezier(.2,.65,.3,1)" : "cubic-bezier(.45,0,.25,1)",
      fill: "both",
    });
    animation = resize;

    const settle = () => {
      if (animation !== resize) return;
      animation = undefined;
      card.open = targetOpen;
      resize.cancel();
    };
    resize.addEventListener("finish", settle, { once: true });
    resize.addEventListener("cancel", settle, { once: true });
  };

  summary.addEventListener("click", (event) => {
    if (event.defaultPrevented) return;
    event.preventDefault();
    setOpen(!isOpeningOrOpen());
  });

  arrow.addEventListener("pointerenter", (event) => {
    if (event.pointerType === "mouse") setOpen(true);
  });

  hoverBoundary.addEventListener("pointerleave", (event) => {
    if (event.pointerType !== "mouse") return;
    const focused = document.activeElement;
    if (card.contains(focused) && !summary.contains(focused)) return;
    setOpen(false);
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

const researchCards = document.getElementById("research-cards");
const researchScrollControls = document.querySelector(".research-scroll-controls");

if (researchCards && researchScrollControls) {
  const firstArrow = researchScrollControls.querySelector('[data-research-scroll="start"]');
  const lastArrow = researchScrollControls.querySelector('[data-research-scroll="end"]');

  const updateArrows = () => {
    const end = researchCards.scrollWidth - researchCards.clientWidth;
    firstArrow.setAttribute("aria-disabled", String(researchCards.scrollLeft <= 1));
    lastArrow.setAttribute("aria-disabled", String(end - researchCards.scrollLeft <= 1));
  };

  for (const arrow of [firstArrow, lastArrow]) {
    const scroll = () => {
      if (arrow.getAttribute("aria-disabled") === "true") return;

      researchCards.scrollTo({
        left: arrow === lastArrow ? researchCards.scrollWidth - researchCards.clientWidth : 0,
        behavior: portfolioMotionPreference.matches ? "instant" : "smooth",
      });
    };

    arrow.addEventListener("click", scroll);
    arrow.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "mouse") scroll();
    });
  }

  researchScrollControls.hidden = false;
  updateArrows();
  researchCards.addEventListener("scroll", updateArrows, { passive: true });
  window.addEventListener("resize", updateArrows);
}
