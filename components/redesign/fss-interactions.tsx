"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import {
  getShowcaseLayoutState,
  getShowcaseScrollState,
} from "@/components/redesign/showcase-progress";
import { bindMagneticControls } from "@/components/redesign/magnetic-controls";
import {
  bindMotionReveals,
  bindScrollScenes,
} from "@/components/redesign/motion-scenes";
import {
  getMotionCapabilities,
  getParticleNodeCount,
} from "@/components/redesign/motion-values";

type FssInteractionsProps = {
  motion?: "full" | "calm" | "off";
  nodeDensity?: number;
};

type Point = {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

function query<T extends Element>(
  scope: ParentNode,
  selector: string,
): T | null {
  return scope.querySelector(selector) as T | null;
}

function queryAll<T extends Element>(scope: ParentNode, selector: string): T[] {
  return Array.from(scope.querySelectorAll(selector)) as T[];
}

function bind(
  target: EventTarget,
  type: string,
  listener: EventListener,
  cleanups: Array<() => void>,
  options?: AddEventListenerOptions,
) {
  target.addEventListener(type, listener, options);
  cleanups.push(() => target.removeEventListener(type, listener, options));
}

function scheduleStep(callback: () => void): () => void {
  if ("requestIdleCallback" in window) {
    const handle = window.requestIdleCallback(callback, { timeout: 50 });
    return () => window.cancelIdleCallback(handle);
  }
  const handle = globalThis.setTimeout(callback, 0);
  return () => globalThis.clearTimeout(handle);
}

// Runs `steps` one per scheduled task instead of as a single synchronous
// block, so initial setup never shows up as one long main-thread task.
function runInStages(steps: Array<() => void>, cleanups: Array<() => void>) {
  let cancelled = false;
  let cancelPending: (() => void) | null = null;

  const runNext = (index: number) => {
    if (cancelled || index >= steps.length) return;
    cancelPending = scheduleStep(() => {
      cancelPending = null;
      steps[index]();
      runNext(index + 1);
    });
  };

  runNext(0);

  cleanups.push(() => {
    cancelled = true;
    cancelPending?.();
  });
}

function setRevealed(element: HTMLElement) {
  element.style.opacity = "1";
  element.style.transform = "none";

  const inner = query<HTMLElement>(element, "[data-reveal-inner]");
  if (inner) {
    inner.style.opacity = "1";
    inner.style.transform = "none";
  }
}

function setChoiceState(button: HTMLElement, active: boolean) {
  button.style.background = active ? "#0a1a2e" : "#f7f8f9";
  button.style.borderColor = active ? "#0a1a2e" : "rgba(10,26,46,.14)";
  button.style.color = active ? "#fff" : "#41506a";
}

function setFaqState(button: HTMLElement, open: boolean) {
  const host = button.parentElement;
  const body = host ? query<HTMLElement>(host, "[data-faq-body]") : null;
  const icon = query<HTMLElement>(button, "[data-faq-icon]");

  if (!body) return;

  body.style.maxHeight = open ? `${body.scrollHeight}px` : "0";

  if (icon) {
    icon.textContent = open ? "-" : "+";
    icon.style.transform = open ? "rotate(180deg)" : "none";
    icon.style.background = open ? "#0a1a2e" : "transparent";
    icon.style.color = open ? "#fff" : "#0f7a83";
  }
}

function buildMailto(form: HTMLFormElement, selectedNeed: string) {
  const values = new FormData(form);
  const name = String(values.get("name") ?? "").trim();
  const email = String(values.get("email") ?? "").trim();
  const organisation = String(values.get("org") ?? "").trim();
  const message = String(values.get("message") ?? "").trim();
  const emailSeparators = String.fromCharCode(64, 46);
  const contactAddress = `info${emailSeparators[0]}faithfulsoftware${emailSeparators[1]}dev`;
  const subject = `Project enquiry from ${name || "FSS website"}`;
  const body = [
    `Name: ${name}`,
    `Email: ${email}`,
    `Organisation: ${organisation || "Not provided"}`,
    `Need: ${selectedNeed || "Not selected"}`,
    "",
    message,
  ].join("\n");

  return `mailto:${contactAddress}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function FssInteractions({
  motion = "full",
  nodeDensity = 120,
}: FssInteractionsProps) {
  const pathname = usePathname();
  const [preferenceVersion, setPreferenceVersion] = useState(0);

  useEffect(() => {
    const preferences = [
      window.matchMedia("(prefers-reduced-motion: reduce)"),
      window.matchMedia("(hover:hover) and (pointer:fine)"),
    ];
    const update = () => setPreferenceVersion((version) => version + 1);
    preferences.forEach((preference) =>
      preference.addEventListener("change", update),
    );
    return () =>
      preferences.forEach((preference) =>
        preference.removeEventListener("change", update),
      );
  }, []);

  useEffect(() => {
    const scope = document.getElementById("fssroot") ?? document;
    const cleanups: Array<() => void> = [];
    const finePointer = window.matchMedia(
      "(hover:hover) and (pointer:fine)",
    ).matches;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const noMotion = reducedMotion || motion === "off";
    const motionCapabilities = getMotionCapabilities({
      reducedMotion: noMotion,
      finePointer,
    });
    const calmMotion = motion === "calm";
    const initialGridColumns = new WeakMap<HTMLElement, string>();
    const initialTransforms = new WeakMap<HTMLElement, string>();
    const initialBorders = new WeakMap<HTMLElement, string>();
    let intersectionObserver: IntersectionObserver | null = null;
    let scrollFrame = 0;
    let ticking = false;

    queryAll<HTMLElement>(scope, "[data-bento] article").forEach((element) => {
      initialGridColumns.set(element, element.style.gridColumn);
    });
    queryAll<HTMLElement>(scope, "[data-parallax]").forEach((element) => {
      initialTransforms.set(element, element.style.transform);
    });
    queryAll<HTMLElement>(scope, ".fss-card").forEach((element) => {
      initialBorders.set(element, element.style.borderColor);
    });

    const revealAll = () => {
      queryAll<HTMLElement>(scope, "[data-reveal]").forEach(setRevealed);
      queryAll<HTMLElement>(
        scope,
        "[data-entrance], #fssroot h1 span span",
      ).forEach((element) => {
        element.style.animation = "none";
        element.style.opacity = "1";
        element.style.transform = "none";
        element.style.clipPath = "none";
      });
    };

    const initReveals = () => {
      if (noMotion || !("IntersectionObserver" in window)) {
        revealAll();
        return;
      }

      intersectionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting || !(entry.target instanceof HTMLElement))
              return;
            setRevealed(entry.target);
            intersectionObserver?.unobserve(entry.target);
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
      );

      queryAll<HTMLElement>(scope, "[data-reveal]").forEach((element) => {
        intersectionObserver?.observe(element);
      });
    };

    const initCounters = () => {
      const counters = queryAll<HTMLElement>(scope, "[data-count]");
      if (!counters.length || !("IntersectionObserver" in window)) return;

      const counterObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting || !(entry.target instanceof HTMLElement))
              return;

            const element = entry.target;
            const raw = element.getAttribute("data-count") ?? "0";
            const target = Number.parseFloat(raw);
            const decimals = raw.includes(".")
              ? (raw.split(".")[1]?.length ?? 0)
              : 0;

            if (noMotion || Number.isNaN(target)) {
              element.textContent = raw;
              counterObserver.unobserve(element);
              return;
            }

            const start = performance.now();
            const duration = 1200;
            const tick = (now: number) => {
              const progress = Math.min(1, (now - start) / duration);
              const eased = 1 - Math.pow(1 - progress, 3);
              const value = target * eased;
              element.textContent = decimals
                ? value.toFixed(decimals)
                : String(Math.round(value));
              if (progress < 1) window.requestAnimationFrame(tick);
            };

            window.requestAnimationFrame(tick);
            counterObserver.unobserve(element);
          });
        },
        { threshold: 0.6 },
      );

      counters.forEach((counter) => counterObserver.observe(counter));
      cleanups.push(() => counterObserver.disconnect());
    };

    const initMenu = () => {
      const button = query<HTMLButtonElement>(scope, "[data-menu-btn]");
      const menu = query<HTMLElement>(scope, "[data-menu]");
      if (!button || !menu) return;

      let open = false;
      const setOpen = (next: boolean) => {
        open = next;
        menu.style.display = open ? "block" : "none";
        button.setAttribute("aria-expanded", String(open));
      };
      const toggle: EventListener = () => setOpen(!open);

      bind(button, "click", toggle, cleanups);
      queryAll<HTMLAnchorElement>(menu, "a").forEach((link) => {
        bind(link, "click", () => setOpen(false), cleanups);
      });
    };

    const bindHover = (
      selector: string,
      enter: (element: HTMLElement) => void,
      leave: (element: HTMLElement) => void,
    ) => {
      queryAll<HTMLElement>(scope, selector).forEach((element) => {
        bind(element, "mouseenter", () => enter(element), cleanups);
        bind(element, "mouseleave", () => leave(element), cleanups);
      });
    };

    const initHovers = () => {
      if (!finePointer) return;

      bindHover(
        "[data-navlink]",
        (element) => {
          element.style.color = "#0a1a2e";
          element.style.background = "rgba(10,26,46,.05)";
        },
        (element) => {
          element.style.color = "#41506a";
          element.style.background = "transparent";
        },
      );
      bindHover(
        "[data-ghost]",
        (element) => {
          element.style.background = "#fff";
          element.style.borderColor = "rgba(10,26,46,.28)";
        },
        (element) => {
          element.style.background = "rgba(255,255,255,.7)";
          element.style.borderColor = "rgba(10,26,46,.14)";
        },
      );
      bindHover(
        "[data-ghost-dark]",
        (element) => {
          element.style.background = "rgba(255,255,255,.14)";
        },
        (element) => {
          element.style.background =
            element.getAttribute("data-keep-bg") ?? "transparent";
        },
      );
      bindHover(
        "[data-foot]",
        (element) => {
          element.style.color = "#46c7d8";
        },
        (element) => {
          element.style.color = "#9fb1c6";
        },
      );
      bindHover(
        "[data-lift]",
        (element) => {
          element.style.transform = "translateY(-5px)";
          element.style.boxShadow = "0 24px 48px -28px rgba(10,26,46,.4)";
        },
        (element) => {
          element.style.transform = "none";
          element.style.boxShadow =
            element.getAttribute("data-keep-shadow") ?? "none";
        },
      );
      bindHover(
        "[data-lift-light]",
        (element) => {
          element.style.transform = "translateY(-5px)";
          element.style.borderColor = "rgba(20,152,158,.4)";
          element.style.boxShadow = "0 26px 50px -30px rgba(10,26,46,.35)";
        },
        (element) => {
          element.style.transform = "none";
          element.style.borderColor = "rgba(10,26,46,.08)";
          element.style.boxShadow = "none";
        },
      );
      bindHover(
        "[data-chip]",
        (element) => {
          element.style.transform = "translateY(-3px)";
          element.style.borderColor = "rgba(20,152,158,.35)";
        },
        (element) => {
          element.style.transform = "none";
          element.style.borderColor = "rgba(10,26,46,.1)";
        },
      );
      bindHover(
        ".fss-card",
        (element) => {
          element.style.borderColor = "rgba(70,199,216,.4)";
        },
        (element) => {
          element.style.borderColor =
            initialBorders.get(element) || "rgba(255,255,255,.1)";
        },
      );
    };

    const initMagnetic = () => {
      if (!motionCapabilities.magnetic) return;
      cleanups.push(bindMagneticControls(scope));
    };

    const initMotionScenes = () => {
      if (!motionCapabilities.scroll) return;
      cleanups.push(bindMotionReveals(scope), bindScrollScenes(scope));
    };

    const initSpotlight = () => {
      if (!finePointer || noMotion) return;

      queryAll<HTMLElement>(scope, "[data-spot]").forEach((card) => {
        const glow = query<HTMLElement>(card, "[data-glow]");
        if (!glow) return;

        bind(
          card,
          "mousemove",
          (event) => {
            const mouse = event as MouseEvent;
            const rect = card.getBoundingClientRect();
            glow.style.background = `radial-gradient(220px circle at ${mouse.clientX - rect.left}px ${mouse.clientY - rect.top}px, rgba(70,199,216,.16), transparent 68%)`;
          },
          cleanups,
        );
        bind(
          card,
          "mouseenter",
          () => {
            glow.style.opacity = "1";
          },
          cleanups,
        );
        bind(
          card,
          "mouseleave",
          () => {
            glow.style.opacity = "0";
          },
          cleanups,
        );
      });
    };

    const initCanvas = () => {
      const canvases = queryAll<HTMLCanvasElement>(scope, "[data-hero-canvas]");
      if (!canvases.length || !motionCapabilities.showParticles) return;

      canvases.forEach((canvas) => {
        const context = canvas.getContext("2d");
        if (!context) return;

        let width = 0;
        let height = 0;
        let nodes: Point[] = [];
        let running = true;
        let inViewport = true;
        let frameId = 0;
        const mouse = { x: -9999, y: -9999 };
        const baseNodeCount = Math.round(nodeDensity * (calmMotion ? 0.6 : 1));
        const maxDistance = 132;

        const buildNodes = () => {
          const count = getParticleNodeCount({
            baseCount: baseNodeCount,
            width,
            height,
            finePointer,
          });
          nodes = Array.from({ length: count }, () => ({
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * 0.16,
            vy: (Math.random() - 0.5) * 0.16,
          }));
        };

        const resize = () => {
          const rect = canvas.getBoundingClientRect();
          const dpr = Math.min(2, window.devicePixelRatio || 1);
          width = rect.width;
          height = rect.height;
          canvas.width = Math.round(width * dpr);
          canvas.height = Math.round(height * dpr);
          context.setTransform(dpr, 0, 0, dpr, 0, 0);
          buildNodes();
        };

        const frame = () => {
          if (!running) return;

          context.clearRect(0, 0, width, height);

          nodes.forEach((point) => {
            if (motionCapabilities.animateParticles) {
              point.x += point.vx;
              point.y += point.vy;
            }
            if (point.x < 0 || point.x > width) point.vx *= -1;
            if (point.y < 0 || point.y > height) point.vy *= -1;

            const dx = point.x - mouse.x;
            const dy = point.y - mouse.y;
            const distance = Math.hypot(dx, dy);
            if (
              motionCapabilities.animateParticles &&
              distance > 0 &&
              distance < 150
            ) {
              point.x += (dx / distance) * 0.5;
              point.y += (dy / distance) * 0.5;
            }
          });

          for (let i = 0; i < nodes.length; i += 1) {
            for (let j = i + 1; j < nodes.length; j += 1) {
              const first = nodes[i];
              const second = nodes[j];
              const distance = Math.hypot(
                first.x - second.x,
                first.y - second.y,
              );

              if (distance < maxDistance) {
                const midX = (first.x + second.x) / 2;
                const midY = (first.y + second.y) / 2;
                const nearMouse =
                  Math.hypot(midX - mouse.x, midY - mouse.y) < 170;
                context.strokeStyle = `rgba(20,152,158,${(1 - distance / maxDistance) * (nearMouse ? 0.5 : 0.14)})`;
                context.lineWidth = nearMouse ? 1.1 : 0.7;
                context.beginPath();
                context.moveTo(first.x, first.y);
                context.lineTo(second.x, second.y);
                context.stroke();
              }
            }
          }

          nodes.forEach((point) => {
            const nearMouse =
              Math.hypot(point.x - mouse.x, point.y - mouse.y) < 150;
            context.fillStyle = nearMouse
              ? "rgba(15,122,131,.85)"
              : "rgba(20,152,158,.32)";
            context.beginPath();
            context.arc(
              point.x,
              point.y,
              nearMouse ? 2.4 : 1.5,
              0,
              Math.PI * 2,
            );
            context.fill();
          });

          if (motionCapabilities.animateParticles) {
            frameId = window.requestAnimationFrame(frame);
          }
        };

        const resizeAndRender = () => {
          resize();
          if (!motionCapabilities.animateParticles) frame();
        };

        resize();
        bind(window, "resize", resizeAndRender, cleanups);

        bind(
          window,
          "pointermove",
          (event) => {
            if (!finePointer || !motionCapabilities.animateParticles) return;
            const pointer = event as PointerEvent;
            const rect = canvas.getBoundingClientRect();
            mouse.x = pointer.clientX - rect.left;
            mouse.y = pointer.clientY - rect.top;
          },
          cleanups,
        );
        bind(
          window,
          "blur",
          () => {
            mouse.x = -9999;
            mouse.y = -9999;
          },
          cleanups,
        );

        frame();

        const syncDocumentVisibility = () => {
          if (document.hidden) {
            running = false;
            window.cancelAnimationFrame(frameId);
            return;
          }

          if (inViewport && !running) {
            running = true;
            if (motionCapabilities.animateParticles) {
              frameId = window.requestAnimationFrame(frame);
            } else {
              frame();
            }
          }
        };
        bind(document, "visibilitychange", syncDocumentVisibility, cleanups);

        if ("IntersectionObserver" in window) {
          const visibilityObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
              inViewport = entry.isIntersecting;
              if (entry.isIntersecting && !document.hidden && !running) {
                running = true;
                if (motionCapabilities.animateParticles) {
                  frameId = window.requestAnimationFrame(frame);
                } else {
                  frame();
                }
              } else if (!entry.isIntersecting) {
                running = false;
              }
            });
          });
          visibilityObserver.observe(canvas);
          cleanups.push(() => visibilityObserver.disconnect());
        }

        cleanups.push(() => {
          running = false;
          window.cancelAnimationFrame(frameId);
        });
      });
    };

    const applyResponsive = () => {
      const width = window.innerWidth;
      const narrow = width < 880;

      const nav = query<HTMLElement>(scope, "[data-nav]");
      const menuButton = query<HTMLElement>(scope, "[data-menu-btn]");
      const wordmark = query<HTMLElement>(scope, "[data-wordmark]");
      const headerCta = query<HTMLElement>(scope, "[data-cta-head]");

      if (nav) nav.style.display = narrow ? "none" : "flex";
      if (menuButton) menuButton.style.display = narrow ? "flex" : "none";
      if (headerCta) headerCta.style.display = narrow ? "none" : "inline-flex";
      if (wordmark) wordmark.style.display = width > 1080 ? "flex" : "none";

      queryAll<HTMLElement>(
        scope,
        "[data-hero-canvas], [data-hero-traces]",
      ).forEach((element) => {
        element.setAttribute("aria-hidden", "true");
      });

      const heroGrid = query<HTMLElement>(scope, "[data-hero-grid]");
      if (heroGrid)
        heroGrid.style.gridTemplateColumns =
          width < 940 ? "1fr" : "1.05fr .95fr";

      const heroMono = query<HTMLElement>(scope, "[data-hero-mono-wrap]");
      if (heroMono) heroMono.style.display = width < 940 ? "none" : "flex";

      queryAll<HTMLElement>(scope, "[data-bento] article").forEach(
        (article) => {
          if (width < 720) article.style.gridColumn = "span 12";
          else if (width < 1000) article.style.gridColumn = "span 6";
          else article.style.gridColumn = initialGridColumns.get(article) || "";
        },
      );

      queryAll<HTMLElement>(scope, "[data-stats]").forEach((grid) => {
        const count = grid.children.length;
        grid.style.gridTemplateColumns =
          width < 680 ? "1fr" : `repeat(${count},1fr)`;
      });

      queryAll<HTMLElement>(scope, "[data-2col]").forEach((grid) => {
        grid.style.gridTemplateColumns = width < 940 ? "1fr" : "1fr 1fr";
      });

      queryAll<HTMLElement>(scope, "[data-caps]").forEach((grid) => {
        grid.style.gridTemplateColumns = width < 560 ? "1fr" : "1fr 1fr";
      });

      queryAll<HTMLElement>(scope, "[data-eng], [data-triad]").forEach(
        (grid) => {
          grid.style.gridTemplateColumns =
            width < 760 ? "1fr" : "repeat(3,1fr)";
        },
      );

      queryAll<HTMLElement>(scope, "[data-sectors]").forEach((grid) => {
        grid.style.gridTemplateColumns =
          width < 720
            ? "1fr"
            : width < 1040
              ? "repeat(2,1fr)"
              : "repeat(4,1fr)";
      });

      queryAll<HTMLElement>(scope, "[data-foot-grid]").forEach((grid) => {
        grid.style.gridTemplateColumns = width < 760 ? "1fr" : "1.4fr 1fr 1fr";
      });

      queryAll<HTMLElement>(scope, "[data-contact-grid]").forEach((grid) => {
        grid.style.gridTemplateColumns = width < 900 ? "1fr" : "1.35fr .9fr";
      });

      queryAll<HTMLElement>(scope, "[data-form-row]").forEach((grid) => {
        grid.style.gridTemplateColumns = width < 620 ? "1fr" : "1fr 1fr";
      });

      const showcase = query<HTMLElement>(scope, "[data-showcase]");
      const stage = query<HTMLElement>(scope, "[data-sc-stage]");
      const stageGrid = stage?.parentElement;
      const sticky = query<HTMLElement>(scope, "[data-sc-sticky]");
      const spacer = query<HTMLElement>(scope, "[data-sc-spacer]");
      const mobileVisual = query<HTMLElement>(scope, "[data-sc-mobile-visual]");
      const showcaseLayout = getShowcaseLayoutState(width);

      if (showcase) showcase.style.minHeight = showcaseLayout.sectionMinHeight;
      if (stageGrid)
        stageGrid.style.gridTemplateColumns =
          showcaseLayout.stageGridTemplateColumns;
      if (stage) stage.style.display = showcaseLayout.stageDisplay;
      if (sticky) {
        sticky.style.position = showcaseLayout.stickyPosition;
        sticky.style.height = showcaseLayout.stickyHeight;
      }
      if (spacer) spacer.style.height = showcaseLayout.spacerHeight;
      if (mobileVisual)
        mobileVisual.style.display = showcaseLayout.mobileVisualDisplay;
    };

    const updateShowcase = () => {
      const section = query<HTMLElement>(scope, "[data-showcase]");
      if (!section) return;

      const total = section.offsetHeight - window.innerHeight;
      if (total <= 0) return;

      const rect = section.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, -rect.top / total));
      const browser = query<HTMLElement>(scope, "[data-sc-browser]");
      const phone = query<HTMLElement>(scope, "[data-sc-phone]");
      const features = queryAll<HTMLElement>(scope, "[data-feat]");
      const showcaseState = getShowcaseScrollState(progress, features.length);

      if (browser && !noMotion) {
        browser.style.transform = `translateY(${(1 - progress) * 36}px) scale(${1.05 - progress * 0.05})`;
      }

      if (phone) {
        const phoneProgress = showcaseState.phoneProgress;
        phone.style.opacity = String(phoneProgress);
        if (!noMotion)
          phone.style.transform = `translateY(${(1 - phoneProgress) * 90}px)`;
      }

      if (features.length) {
        features.forEach((feature, index) => {
          const active = index === showcaseState.activeFeatureIndex;
          feature.style.opacity = active ? "1" : "0.4";
          const number = feature.children[0];
          if (number instanceof HTMLElement)
            number.style.color = active ? "#0f7a83" : "#9fb1c6";
        });
      }
    };

    const updateProcess = () => {
      const svg = query<SVGSVGElement>(scope, "[data-process-svg]");
      const line = query<SVGLineElement>(scope, "[data-process-line]");
      if (!svg || !line) return;
      if (noMotion) {
        line.style.transform = "scaleX(1)";
        return;
      }

      const host = svg.closest("section");
      if (!(host instanceof HTMLElement)) return;

      const rect = host.getBoundingClientRect();
      const progress = Math.min(
        1,
        Math.max(
          0,
          (window.innerHeight * 0.7 - rect.top) / (host.offsetHeight * 0.62),
        ),
      );
      line.style.transformOrigin = "left center";
      line.style.transform = `scaleX(${progress})`;

      queryAll<HTMLElement>(scope, "[data-step]").forEach((step) => {
        const dot = query<HTMLElement>(step, "[data-step-dot]");
        if (!dot) return;

        const active =
          step.getBoundingClientRect().top < window.innerHeight * 0.62;
        dot.style.borderColor = active ? "#14989e" : "rgba(255,255,255,.2)";
        dot.style.boxShadow = active
          ? "0 0 0 5px rgba(20,152,158,.18)"
          : "none";
        dot.style.background = active ? "#14989e" : "#0a1a2e";
      });
    };

    const initScroll = () => {
      const header = query<HTMLElement>(scope, "[data-header]");
      const processLine = query<SVGLineElement>(scope, "[data-process-line]");
      if (processLine) {
        processLine.style.transformOrigin = "left center";
        processLine.style.transform = noMotion ? "scaleX(1)" : "scaleX(0)";
      }

      const updateHeader = () => {
        if (!header) return;
        const scrollY = window.scrollY || window.pageYOffset;
        const scrolled = scrollY > 12;
        header.style.background = scrolled
          ? "rgba(242,243,245,.82)"
          : "rgba(242,243,245,.55)";
        header.style.borderBottomColor = scrolled
          ? "rgba(10,26,46,.08)"
          : "transparent";
        header.style.boxShadow = scrolled
          ? "0 10px 30px -22px rgba(10,26,46,.35)"
          : "none";
      };

      const updateParallax = () => {
        if (noMotion) return;
        const scrollY = window.scrollY || window.pageYOffset;
        queryAll<HTMLElement>(scope, "[data-parallax]").forEach((element) => {
          const speed =
            Number.parseFloat(
              element.getAttribute("data-parallax") ?? "0.08",
            ) || 0.08;
          const baseTransform = initialTransforms.get(element) ?? "";
          if (scrollY < window.innerHeight * 1.5) {
            element.style.transform =
              `${baseTransform} translateY(${scrollY * speed}px)`.trim();
          }
        });
      };

      const handle = () => {
        updateHeader();
        updateParallax();
        updateShowcase();
        updateProcess();
      };

      const onScroll: EventListener = () => {
        if (ticking) return;
        ticking = true;
        scrollFrame = window.requestAnimationFrame(() => {
          ticking = false;
          handle();
        });
      };

      bind(window, "scroll", onScroll, cleanups, { passive: true });
      bind(window, "resize", onScroll, cleanups);

      // The initial paint forces layout reads (getBoundingClientRect,
      // offsetHeight, getTotalLength) that are cheap individually but add up
      // to a single long task if run synchronously in one go on mount. Later
      // scroll/resize-driven updates still call `handle()` atomically so the
      // scroll-linked visuals stay in sync frame-to-frame.
      runInStages(
        [updateHeader, updateParallax, updateShowcase, updateProcess],
        cleanups,
      );
    };

    const initContact = () => {
      let selectedNeed = "";

      queryAll<HTMLButtonElement>(scope, "[data-choice]").forEach((button) => {
        bind(
          button,
          "click",
          () => {
            selectedNeed = button.getAttribute("data-choice") ?? "";
            queryAll<HTMLElement>(scope, "[data-choice]").forEach((choice) => {
              setChoiceState(choice, choice === button);
            });
          },
          cleanups,
        );
      });

      queryAll<HTMLElement>(scope, "input, textarea").forEach((field) => {
        bind(
          field,
          "focus",
          () => {
            field.style.borderColor = "#14989e";
            field.style.background = "#fff";
            field.style.boxShadow = "0 0 0 4px rgba(20,152,158,.12)";
          },
          cleanups,
        );
        bind(
          field,
          "blur",
          () => {
            field.style.borderColor = "rgba(10,26,46,.14)";
            field.style.background = "#f7f8f9";
            field.style.boxShadow = "none";
          },
          cleanups,
        );
      });

      const form = query<HTMLFormElement>(scope, "[data-form]");
      const success = query<HTMLElement>(scope, "[data-success]");
      if (form && success) {
        bind(
          form,
          "submit",
          (event) => {
            event.preventDefault();
            if (!form.reportValidity()) return;

            window.location.href = buildMailto(form, selectedNeed);
            form.style.display = "none";
            success.style.display = "flex";
          },
          cleanups,
        );
      }

      queryAll<HTMLElement>(scope, "[data-faq-btn]").forEach((button) => {
        let open = false;
        setFaqState(button, open);
        bind(
          button,
          "click",
          () => {
            open = !open;
            setFaqState(button, open);
          },
          cleanups,
        );
      });
    };

    const guardTimeline = () => {
      let done = false;
      const probe =
        query<HTMLElement>(scope, "#fssroot h1 span span") ??
        query<HTMLElement>(scope, "[data-entrance]") ??
        query<HTMLElement>(scope, "[data-reveal]");
      const check = () => {
        if (done || !probe) return;

        const animations = probe.getAnimations ? probe.getAnimations() : [];
        const progressed = animations.some(
          (animation) =>
            (animation.currentTime ? Number(animation.currentTime) : 0) > 4,
        );
        const visible =
          Number.parseFloat(window.getComputedStyle(probe).opacity || "0") >
          0.02;

        if (progressed || visible) {
          done = true;
          return;
        }

        revealAll();
        done = true;
      };

      const firstTimeout = window.setTimeout(check, 260);
      const secondTimeout = window.setTimeout(check, 850);
      cleanups.push(() => {
        window.clearTimeout(firstTimeout);
        window.clearTimeout(secondTimeout);
      });
    };

    applyResponsive();
    bind(window, "resize", applyResponsive, cleanups);

    // initReveals/guardTimeline keep [data-reveal] content responsive, so they
    // run synchronously. Everything else here
    // (hover/magnetic/spotlight wiring, the canvas particle loop, counters,
    // menu, contact form, scroll listeners) doesn't gate visibility, and
    // running all of it synchronously under CPU throttling is what shows up
    // in CI as a single long main-thread task, so it stays spread across
    // scheduled tasks.
    initReveals();
    guardTimeline();

    runInStages(
      [
        initCounters,
        initMenu,
        initHovers,
        initMagnetic,
        initSpotlight,
        initCanvas,
        initMotionScenes,
        initScroll,
        initContact,
      ],
      cleanups,
    );

    return () => {
      window.cancelAnimationFrame(scrollFrame);
      intersectionObserver?.disconnect();
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [motion, nodeDensity, pathname, preferenceVersion]);

  return null;
}
