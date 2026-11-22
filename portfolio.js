const phoneLayout = window.matchMedia("(max-width: 680px)");
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
  let arrowRotation;
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
    let startAngle = card.open ? 180 : 0;
    if (arrowRotation) {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(arrow).transform);
      startAngle = Math.abs(Math.atan2(matrix.b, matrix.a) * 180 / Math.PI);
    }

    const previousAnimation = animation;
    animation = undefined;
    previousAnimation?.cancel();
    arrowRotation?.cancel();
    arrowRotation = undefined;

    if (portfolioMotionPreference.matches) {
      card.open = targetOpen;
      card.removeAttribute("data-closing");
      return;
    }

    card.toggleAttribute("data-closing", !open);
    let endHeight;
    if (targetOpen) {
      card.open = true;
      endHeight = card.getBoundingClientRect().height;
    } else {
      const style = getComputedStyle(card);
      endHeight = summary.getBoundingClientRect().height +
        parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    }

    const timing = {
      duration: open ? 320 : 420,
      easing: open ? "cubic-bezier(.2,.65,.3,1)" : "cubic-bezier(.45,0,.25,1)",
      fill: "both",
    };
    const resize = playPortfolioAnimation(card, [
      { height: `${startHeight}px`, overflow: "hidden" },
      { height: `${endHeight}px`, overflow: "hidden" },
    ], timing);
    const turn = playPortfolioAnimation(arrow, [
      { transform: `rotate(${startAngle}deg)` },
      { transform: `rotate(${open ? 180 : 0}deg)` },
    ], timing);
    animation = resize;
    arrowRotation = turn;

    const settle = () => {
      if (animation !== resize) return;
      animation = undefined;
      card.open = targetOpen;
      card.removeAttribute("data-closing");
      arrowRotation = undefined;
      turn?.cancel();
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
    if (event.pointerType === "mouse" && !phoneLayout.matches) setOpen(true);
  });

  hoverBoundary.addEventListener("pointerleave", (event) => {
    if (event.pointerType !== "mouse" || phoneLayout.matches) return;
    const focused = document.activeElement;
    if (card.contains(focused) && !summary.contains(focused)) return;
    setOpen(false);
  });
}

for (const section of document.querySelectorAll("[data-year-filter]")) {
  const filters = section.querySelector(".filters");
  const buttons = [...filters.querySelectorAll("button[data-filter]")];
  const results = section.querySelector("[data-year-results]");
  const viewport = results.parentElement;
  const status = section.querySelector('[role="status"]');
  const itemName = section.dataset.yearFilter;

  let transition = [];
  let drag;
  filters.hidden = false;

  const selectedIndex = () => buttons.findIndex((button) => button.getAttribute("aria-pressed") === "true");
  const positionYearPill = (next, progress = 0) => {
    const current = buttons[selectedIndex()];
    next ??= current;
    const left = current.offsetLeft + (next.offsetLeft - current.offsetLeft) * progress;
    const top = current.offsetTop + (next.offsetTop - current.offsetTop) * progress;
    const width = current.offsetWidth + (next.offsetWidth - current.offsetWidth) * progress;
    const height = current.offsetHeight + (next.offsetHeight - current.offsetHeight) * progress;
    filters.style.setProperty("--year-pill-x", `${left}px`);
    filters.style.setProperty("--year-pill-y", `${top}px`);
    filters.style.setProperty("--year-pill-width", `${width}px`);
    filters.style.setProperty("--year-pill-height", `${height}px`);
  };

  positionYearPill();
  window.addEventListener("resize", () => positionYearPill());
  document.fonts?.ready.then(() => { if (!drag?.direction) positionYearPill(); });
  const canAnimate = () => !portfolioMotionPreference.matches && typeof results.animate === "function";
  const stopTransition = () => {
    for (const animation of transition) animation.cancel();
    transition = [];
  };

  const filterEntries = (list, year) => {
    let count = 0;
    for (const entry of list) {
      entry.hidden = year !== "all" && entry.dataset.year !== year;
      if (!entry.hidden) count++;
    }
    return count;
  };

  const placeCopy = (copy) => {
    copy.removeAttribute("data-year-results");
    copy.setAttribute("aria-hidden", "true");
    copy.inert = true;
    copy.classList.add("year-results-outgoing");
    viewport.append(copy);
  };

  const slideFrom = (element, start, end, options) => playPortfolioAnimation(element, [
    { transform: `translateX(${start})` },
    { transform: `translateX(${end})` },
  ], options);

  const removeAfter = (copy, animation) => {
    const remove = () => copy.remove();
    animation.addEventListener("finish", remove, { once: true });
    animation.addEventListener("cancel", remove, { once: true });
  };

  const selectYear = (selected, offset = 0) => {
    if (!selected || selected.getAttribute("aria-pressed") === "true") return;

    const animate = canAnimate();
    const heightBefore = animate ? viewport.getBoundingClientRect().height : 0;
    stopTransition();

    const previous = selectedIndex();
    const direction = buttons.indexOf(selected) > previous ? 1 : -1;
    const outgoing = animate ? results.cloneNode(true) : null;

    for (const button of buttons) {
      button.setAttribute("aria-pressed", String(button === selected));
    }
    positionYearPill();

    const count = filterEntries(results.querySelectorAll("[data-year]"), selected.dataset.filter);
    const noun = count === 1 ? itemName : `${itemName}s`;
    status.textContent = `Showing ${count} ${noun}.`;

    if (!outgoing) return;

    const heightAfter = viewport.getBoundingClientRect().height;
    placeCopy(outgoing);
    const options = { duration: offset ? 260 : 360 };
    const leave = slideFrom(outgoing, `${offset}px`, `${-direction * 100}%`, options);
    removeAfter(outgoing, leave);
    transition = [
      leave,
      slideFrom(results, `calc(${direction * 100}% + ${offset}px)`, "0px", options),
      playPortfolioAnimation(viewport, [
        { height: `${heightBefore}px`, overflow: "hidden" },
        { height: `${heightAfter}px`, overflow: "hidden" },
      ], options),
    ];
  };

  const finishDrag = (commit) => {
    const current = drag;
    drag = undefined;
    if (!current?.direction) return;

    const { offset, preview, direction, next } = current;
    results.style.transform = "";
    filters.removeAttribute("data-dragging");
    if (!offset) {
      positionYearPill();
      preview?.remove();
      return;
    }
    if (commit && next) {
      preview?.remove();
      selectYear(next, offset);
      return;
    }

    positionYearPill();
    if (canAnimate()) {
      const options = { duration: 200 };
      transition = [slideFrom(results, `${offset}px`, "0px", options)];
      if (preview) {
        const exit = slideFrom(preview, `calc(${direction * 100}% + ${offset}px)`, `${direction * 100}%`, options);
        removeAfter(preview, exit);
        transition.push(exit);
      }
    } else {
      preview?.remove();
    }
  };

  section.addEventListener("touchstart", (event) => {
    if (drag) finishDrag(false);
    if (phoneLayout.matches && event.touches.length === 1) {
      const touch = event.touches[0];
      drag = { id: touch.identifier, x: touch.clientX, y: touch.clientY, offset: 0 };
    }
  }, { passive: true });

  section.addEventListener("touchmove", (event) => {
    if (!drag || event.touches.length !== 1) return;
    const touch = event.touches[0];
    if (touch.identifier !== drag.id) return;
    const dx = touch.clientX - drag.x;
    const dy = touch.clientY - drag.y;

    if (!drag.direction) {
      if (Math.abs(dy) >= 10 && Math.abs(dx) <= Math.abs(dy) * 1.4) {
        drag = undefined;
        return;
      }
      if (Math.abs(dx) < 10) return;
      stopTransition();
      if (canAnimate()) filters.setAttribute("data-dragging", "");
    }

    const direction = dx < 0 ? 1 : -1;
    if (direction !== drag.direction) {
      drag.preview?.remove();
      drag.preview = undefined;
      drag.direction = direction;
      drag.next = buttons[selectedIndex() + direction];
      if (drag.next && canAnimate()) {
        drag.preview = results.cloneNode(true);
        filterEntries(drag.preview.querySelectorAll("[data-year]"), drag.next.dataset.filter);
        placeCopy(drag.preview);
      }
    }

    const width = viewport.clientWidth;
    drag.offset = Math.max(-width, Math.min(width, drag.next ? dx : dx * .22));
    if (canAnimate()) {
      positionYearPill(drag.next, Math.min(1, Math.abs(drag.offset) / width));
      results.style.transform = `translateX(${drag.offset}px)`;
      if (drag.preview) drag.preview.style.transform = `translateX(calc(${direction * 100}% + ${drag.offset}px))`;
    }
  }, { passive: true });

  section.addEventListener("touchend", (event) => {
    if (!drag?.direction || event.touches.length) {
      finishDrag(false);
      return;
    }
    if (event.cancelable) event.preventDefault();
    finishDrag(Math.abs(drag.offset) >= Math.max(45, viewport.clientWidth * .16));
  }, { passive: false });

  section.addEventListener("touchcancel", () => finishDrag(false), { passive: true });
  phoneLayout.addEventListener("change", () => finishDrag(false));

  filters.addEventListener("click", (event) => {
    finishDrag(false);
    selectYear(event.target.closest("button[data-filter]"));
  });

  section.addEventListener("literature-updated", () => {
    finishDrag(false);
    stopTransition();
    buttons.splice(0, buttons.length, ...filters.querySelectorAll("button[data-filter]"));
    const selected = buttons[selectedIndex()] ?? buttons[0];
    selected.setAttribute("aria-pressed", "true");
    filterEntries(results.querySelectorAll("[data-year]"), selected.dataset.filter);
    positionYearPill();
  });
}

const mobileMenu = document.querySelector(".mobile-menu");
const siteNavigation = document.getElementById("site-navigation");

if (mobileMenu && siteNavigation) {
  const menuPanel = siteNavigation.parentElement;
  let menuAnimation;

  const setMenuOpen = (open, animate = false) => {
    const heightBefore = menuPanel.getBoundingClientRect().height;
    const opacityBefore = heightBefore ? getComputedStyle(menuPanel).opacity : ".25";
    const previous = menuAnimation;
    menuAnimation = undefined;
    previous?.cancel();

    mobileMenu.setAttribute("aria-expanded", String(open));
    const useMotion = animate && phoneLayout.matches && !portfolioMotionPreference.matches &&
      typeof menuPanel.animate === "function";
    menuPanel.toggleAttribute("data-collapsed", phoneLayout.matches && !open && !useMotion);
    siteNavigation.inert = phoneLayout.matches && !open;
    if (!useMotion) return;

    const heightAfter = open ? menuPanel.offsetHeight : 0;
    const resize = playPortfolioAnimation(menuPanel, [
      { height: `${heightBefore}px`, opacity: opacityBefore, overflow: "clip" },
      { height: `${heightAfter}px`, opacity: open ? 1 : .15, overflow: "clip" },
    ], { duration: 300, easing: "cubic-bezier(.4,0,.2,1)", fill: "both" });
    menuAnimation = resize;
    const settle = () => {
      if (menuAnimation !== resize) return;
      menuAnimation = undefined;
      menuPanel.toggleAttribute("data-collapsed", !open);
      resize.cancel();
    };
    resize.addEventListener("finish", settle, { once: true });
    resize.addEventListener("cancel", settle, { once: true });
  };

  const updateMenu = () => {
    if (phoneLayout.matches && siteNavigation.contains(document.activeElement)) mobileMenu.focus();
    setMenuOpen(false);
  };

  mobileMenu.hidden = false;
  updateMenu();
  phoneLayout.addEventListener("change", updateMenu);
  mobileMenu.addEventListener("click", () => setMenuOpen(mobileMenu.getAttribute("aria-expanded") !== "true", true));

  siteNavigation.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!phoneLayout.matches || !link) return;

    const destination = document.getElementById(link.hash.slice(1));
    if (destination) {
      destination.tabIndex = -1;
      destination.focus({ preventScroll: true });
    }
    setMenuOpen(false);
  });

  mobileMenu.parentElement.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || mobileMenu.getAttribute("aria-expanded") !== "true") return;
    setMenuOpen(false);
    mobileMenu.focus();
  });
}

const researchCards = document.getElementById("research-cards");
const researchScrollControls = document.querySelector(".research-scroll-controls");

if (researchCards && researchScrollControls) {
  const firstArrow = researchScrollControls.querySelector('[data-research-scroll="start"]');
  const lastArrow = researchScrollControls.querySelector('[data-research-scroll="end"]');

  const researchViewport = researchCards.parentElement;
  const projects = [...researchCards.querySelectorAll(".research-card")];
  const position = researchScrollControls.querySelector(".research-card-position");
  const cardStep = () => projects[1].offsetLeft - projects[0].offsetLeft;
  const currentCard = () => Math.round(researchCards.scrollLeft / cardStep());

  const updateCarouselLayout = () => {
    position.hidden = !phoneLayout.matches;
    firstArrow.setAttribute("aria-label", phoneLayout.matches ? "Previous research card" : "Show first research projects");
    lastArrow.setAttribute("aria-label", phoneLayout.matches ? "Next research card" : "Show Future Directions");
  };
  const updateArrows = () => {
    const end = researchCards.scrollWidth - researchCards.clientWidth;
    const canScrollLeft = researchCards.scrollLeft > 1;
    const canScrollRight = end - researchCards.scrollLeft > 1;
    firstArrow.setAttribute("aria-disabled", String(!canScrollLeft));
    lastArrow.setAttribute("aria-disabled", String(!canScrollRight));
    researchViewport.classList.toggle("can-scroll-left", canScrollLeft);
    researchViewport.classList.toggle("can-scroll-right", canScrollRight);
    if (phoneLayout.matches) position.textContent = `${currentCard() + 1} / ${projects.length}`;
  };

  for (const arrow of [firstArrow, lastArrow]) {
    const scroll = () => {
      if (arrow.getAttribute("aria-disabled") === "true") return;

      const direction = arrow === lastArrow ? 1 : -1;
      const left = phoneLayout.matches
        ? (currentCard() + direction) * cardStep()
        : direction === 1 ? researchCards.scrollWidth - researchCards.clientWidth : 0;
      researchCards.scrollTo({
        left,
        behavior: portfolioMotionPreference.matches ? "instant" : "smooth",
      });
    };

    arrow.addEventListener("click", scroll);
    arrow.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "mouse" && !phoneLayout.matches) scroll();
    });
  }

  researchScrollControls.hidden = false;
  updateCarouselLayout();
  updateArrows();
  phoneLayout.addEventListener("change", updateCarouselLayout);
  researchCards.addEventListener("scroll", updateArrows, { passive: true });
  window.addEventListener("resize", updateArrows);
}

const preprintSection = document.getElementById("preprints");
const conferencePaperSection = document.getElementById("conference-papers");

const journalSection = document.getElementById("publications");

if (preprintSection && conferencePaperSection && journalSection) {
  const journalList = journalSection.querySelector("[data-year-results]");
  const journalFilters = journalSection.querySelector(".filters");
  const publishedDois = new Set(
    [...journalList.querySelectorAll('a[href^="https://doi.org/"]')]
      .map((link) => decodeURIComponent(link.pathname.slice(1)).toLowerCase()),
  );
  const publishedArxivIds = new Set(
    [...document.querySelectorAll('#publications a[href^="https://arxiv.org/abs/"]')]
      .map((link) => link.pathname.slice("/abs/".length).replace(/v\d+$/, "")),
  );

  const arxivId = (record) => {
    const id = record.arxiv_eprints?.[0]?.value?.replace(/v\d+$/, "");
    return /^(?:\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})$/.test(id) ? id : undefined;
  };
  const isPublished = (record) => record.publication_info?.some(
    (entry) => entry.journal_title || entry.journal_record ||
      (entry.material === "publication" && entry.pubinfo_freetext),
  );
  const isConferencePaper = (record) => record.document_type?.includes("conference paper");

  const loadLiterature = async () => {
    const endpoint = new URL("https://inspirehep.net/api/literature");
    endpoint.search = new URLSearchParams({
      q: "authors.recid:2896573",
      size: "100",
      sort: "mostrecent",
      fields: "titles,arxiv_eprints,publication_info,document_type,dois,earliest_date",
    });

    const records = [];
    let total;
    for (let page = 1; total === undefined || records.length < total; page++) {
      endpoint.searchParams.set("page", String(page));
      const response = await fetch(endpoint, { cache: "no-cache" });
      if (!response.ok) throw new Error("Unable to load INSPIRE literature records");
      const { hits } = await response.json();
      total = hits.total;
      if (!hits.hits.length) break;
      records.push(...hits.hits);
    }
    return records;
  };

  const createPaperRow = ({ title, label, href, linkText, citation }) => {
    const row = document.createElement("article");
    row.className = "publication";
    const type = document.createElement("span");
    type.className = "publication-type";
    type.textContent = label;
    const heading = document.createElement("h3");
    heading.textContent = title;
    const links = document.createElement("div");
    links.className = "publication-links";
    const link = document.createElement("a");
    link.className = "text-link";
    link.href = href;
    link.textContent = linkText;
    link.setAttribute("aria-label", `${linkText}: ${title}`);
    links.append(link);
    const description = document.createElement("div");
    description.append(heading);
    if (citation) {
      const detail = document.createElement("p");
      detail.textContent = citation;
      description.append(detail);
    }
    row.append(type, description, links);
    return row;
  };

  const renderPapers = (section, selector, papers) => {
    section.querySelector(selector).replaceChildren(...papers.map(createPaperRow));
    section.hidden = !papers.length;
  };

  const renderJournalPapers = (papers) => {
    journalList.querySelectorAll("[data-inspire-journal]").forEach((row) => row.remove());
    for (const paper of papers.slice().reverse()) {
      const row = createPaperRow(paper);
      row.dataset.year = paper.year;
      row.dataset.inspireJournal = "";
      const firstOlder = [...journalList.children].find((item) => item.dataset.year <= paper.year);
      journalList.insertBefore(row, firstOlder ?? null);
    }

    const years = [...new Set([...journalList.children].map((row) => row.dataset.year).filter(Boolean))]
      .sort((a, b) => Number(b) - Number(a));
    for (const button of journalFilters.querySelectorAll("button[data-inspire-year]")) {
      if (!years.includes(button.dataset.filter)) button.remove();
    }
    for (const year of years) {
      if (journalFilters.querySelector(`[data-filter="${year}"]`)) continue;
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.filter = year;
      button.dataset.inspireYear = "";
      button.setAttribute("aria-pressed", "false");
      button.textContent = year;
      const firstOlder = [...journalFilters.querySelectorAll('button[data-filter]:not([data-filter="all"])')]
        .find((item) => Number(item.dataset.filter) < Number(year));
      journalFilters.insertBefore(button, firstOlder ?? null);
    }
    journalSection.dispatchEvent(new Event("literature-updated"));
  };

  let previousSnapshot;
  let previousJournals = "[]";
  const updateLiteratureSections = async () => {
    const records = await loadLiterature();
    const seenPreprints = new Set(publishedArxivIds);
    const seenConferencePapers = new Set();
    const preprints = [];
    const conferencePapers = [];
    const journalPapers = [];
    const seenJournalIds = new Set(publishedArxivIds);
    const seenJournalDois = new Set(publishedDois);

    for (const { metadata } of records) {
      const id = arxivId(metadata);
      if (id && (isPublished(metadata) || isConferencePaper(metadata))) seenPreprints.add(id);
    }

    for (const { id: recordId, metadata } of records) {
      const title = metadata.titles?.[0]?.title;
      if (!title) continue;
      const id = arxivId(metadata);
      const arxivUrl = id && `https://arxiv.org/abs/${id}`;

      const doi = metadata.dois?.find(({ value }) => /^10\.(?!48550\/)\d{4,9}\/.+/.test(value))?.value;
      const doiUrl = doi && `https://doi.org/${encodeURI(doi).replaceAll("#", "%23").replaceAll("?", "%3F")}`;
      const inspireUrl = /^\d+$/.test(recordId) && `https://inspirehep.net/literature/${recordId}`;

      if (isConferencePaper(metadata)) {
        const key = id || recordId;
        if (seenConferencePapers.has(key)) continue;
        const href = doiUrl || arxivUrl || inspireUrl;
        if (!href) continue;

        seenConferencePapers.add(key);
        conferencePapers.push({
          title,
          label: metadata.publication_info?.find(({ year }) => year)?.year ?? "Paper",
          href,
          linkText: doiUrl ? "Proceedings" : arxivUrl ? "arXiv" : "INSPIRE-HEP",
        });
      } else if (isPublished(metadata)) {
        const key = id || recordId;
        const doiKey = doi?.toLowerCase();
        if (seenJournalIds.has(key) || (doiKey && seenJournalDois.has(doiKey))) continue;
        const href = doiUrl || inspireUrl || arxivUrl;
        if (!href) continue;
        seenJournalIds.add(key);
        if (doiKey) seenJournalDois.add(doiKey);

        const journal = metadata.publication_info.find((entry) => entry.journal_title || entry.journal_record) ??
          metadata.publication_info[0];
        const year = String(journal.year ?? metadata.earliest_date?.slice(0, 4) ?? "");
        const validYear = /^\d{4}$/.test(year) ? year : "";
        const citation = journal.journal_title
          ? [journal.journal_title, journal.journal_volume, validYear && `(${validYear})`, journal.artid || journal.page_start].filter(Boolean).join(" ")
          : journal.pubinfo_freetext;
        journalPapers.push({ title, label: validYear || "Paper", year: validYear, citation, href,
          linkText: doiUrl ? "Journal" : inspireUrl ? "INSPIRE-HEP" : "arXiv" });
      } else if (id && !seenPreprints.has(id)) {
        seenPreprints.add(id);
        preprints.push({ title, label: "arXiv", href: arxivUrl, linkText: "arXiv" });
      }
    }

    const snapshot = JSON.stringify([preprints, conferencePapers]);
    if (snapshot !== previousSnapshot) {
      renderPapers(preprintSection, "[data-preprint-results]", preprints);
      renderPapers(conferencePaperSection, "[data-conference-paper-results]", conferencePapers);
      previousSnapshot = snapshot;
    }
    const journalSnapshot = JSON.stringify(journalPapers);
    if (journalSnapshot !== previousJournals) {
      renderJournalPapers(journalPapers);
      previousJournals = journalSnapshot;
    }
  };

  const refreshInterval = 5 * 60 * 1000;
  let lastCheck = 0;
  let refreshPending = false;
  const refreshLiterature = async () => {
    if (document.hidden || refreshPending || Date.now() - lastCheck < refreshInterval) return;
    lastCheck = Date.now();
    refreshPending = true;
    try {
      await updateLiteratureSections();
    } catch {
      // Keep the last successful results if INSPIRE is temporarily unavailable.
    } finally {
      refreshPending = false;
    }
  };

  refreshLiterature();
  window.setInterval(refreshLiterature, refreshInterval);
  document.addEventListener("visibilitychange", refreshLiterature);
}
