
/**
 * PRUMIM AI — LIVE AGENT INDICATOR
 * File: components/agent-indicator.js
 *
 * Production-ready browser activity indicator.
 * Compatible with vanilla HTML and JavaScript.
 */

const STATES = Object.freeze({
  idle: {
    label: "Standing by",
    icon: "●",
    color: "#8585a3"
  },
  thinking: {
    label: "Thinking",
    icon: "◉",
    color: "#a78bfa"
  },
  planning: {
    label: "Planning",
    icon: "⌘",
    color: "#38bdf8"
  },
  executing: {
    label: "Executing",
    icon: "⚡",
    color: "#fbbf24"
  },
  reading: {
    label: "Reading files",
    icon: "◫",
    color: "#38bdf8"
  },
  writing: {
    label: "Writing files",
    icon: "✎",
    color: "#a78bfa"
  },
  searching: {
    label: "Searching",
    icon: "⌕",
    color: "#22d3ee"
  },
  speaking: {
    label: "Responding",
    icon: "◉",
    color: "#c084fc"
  },
  completed: {
    label: "Completed",
    icon: "✓",
    color: "#4ade80"
  },
  error: {
    label: "Something went wrong",
    icon: "!",
    color: "#fb7185"
  }
});

class PRUMIMAgentIndicator {
  constructor(options = {}) {
    this.containerId =
      options.containerId || "prumim-agent-status";

    this.currentState = "idle";
    this.detail = "";
    this.listeners = new Set();
    this.destroyed = false;
    this.createdContainer = false;

    this.handleActivity = this.handleActivity.bind(this);

    this.injectStyles();
    this.mount();

    window.addEventListener(
      "prumim:activity",
      this.handleActivity
    );
  }

  injectStyles() {
    if (document.getElementById("prumim-indicator-styles")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "prumim-indicator-styles";

    style.textContent = `
      .prumim-agent-status {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 9px 13px;
        border: 1px solid rgba(167,139,250,.16);
        border-radius: 14px;
        background: rgba(20,18,36,.82);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
        color: #d8d5e8;
        font-family: Inter, system-ui, sans-serif;
        transition: all .25s ease;
        max-width: 100%;
      }

      .prumim-agent-status .status-orb {
        width: 9px;
        height: 9px;
        min-width: 9px;
        border-radius: 50%;
        background: var(--status-color);
        box-shadow: 0 0 12px var(--status-color);
      }

      .prumim-agent-status.is-active .status-orb {
        animation: prumim-status-pulse 1.2s infinite ease-in-out;
      }

      .prumim-agent-status .status-content {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }

      .prumim-agent-status .status-label {
        font-size: 12px;
        font-weight: 700;
        letter-spacing: .2px;
        color: #f1efff;
      }

      .prumim-agent-status .status-detail {
        font-size: 10px;
        color: #9993b5;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 210px;
      }

      .prumim-agent-status .status-icon {
        font-size: 14px;
        color: var(--status-color);
      }

      @keyframes prumim-status-pulse {
        0%, 100% {
          opacity: 1;
          transform: scale(1);
        }
        50% {
          opacity: .45;
          transform: scale(.75);
        }
      }

      @media (max-width: 600px) {
        .prumim-agent-status {
          padding: 7px 10px;
          gap: 8px;
        }

        .prumim-agent-status .status-detail {
          max-width: 130px;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .prumim-agent-status .status-orb {
          animation: none !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  mount() {
    let container = document.getElementById(this.containerId);

    if (!container) {
      container = document.createElement("div");
      container.id = this.containerId;

      container.style.position = "fixed";
      container.style.top = "16px";
      container.style.right = "16px";
      container.style.zIndex = "9999";

      document.body.appendChild(container);
      this.createdContainer = true;
    }

    this.container = container;
    this.render();
  }

  handleActivity(event) {
    const data = event.detail || {};

    this.setState(
      data.state || "idle",
      data.detail || ""
    );
  }

  setState(state, detail = "") {
    if (this.destroyed) return null;

    if (!STATES[state]) {
      console.warn(
        "PRUMIM: Unknown indicator state:",
        state
      );
      state = "idle";
    }

    this.currentState = state;
    this.detail = String(detail);

    this.render();

    const status = this.getStatus();

    this.listeners.forEach((listener) => {
      try {
        listener(status);
      } catch (error) {
        console.error(
          "PRUMIM indicator listener error:",
          error
        );
      }
    });

    return status;
  }

  render() {
    if (!this.container) return;

    const config = STATES[this.currentState];

    const active = ![
      "idle",
      "completed",
      "error"
    ].includes(this.currentState);

    const wrapper = document.createElement("div");
    wrapper.className =
      `prumim-agent-status ${active ? "is-active" : ""}`;

    wrapper.style.setProperty(
      "--status-color",
      config.color
    );

    wrapper.setAttribute("role", "status");
    wrapper.setAttribute("aria-live", "polite");

    const orb = document.createElement("span");
    orb.className = "status-orb";

    const content = document.createElement("div");
    content.className = "status-content";

    const label = document.createElement("span");
    label.className = "status-label";
    label.textContent = config.label;

    const detail = document.createElement("span");
    detail.className = "status-detail";
    detail.textContent = this.detail || "PRUMIM AI";

    const icon = document.createElement("span");
    icon.className = "status-icon";
    icon.textContent = config.icon;

    content.append(label, detail);
    wrapper.append(orb, content, icon);

    this.container.replaceChildren(wrapper);
  }

  getStatus() {
    return {
      state: this.currentState,
      label: STATES[this.currentState].label,
      detail: this.detail,
      active: ![
        "idle",
        "completed",
        "error"
      ].includes(this.currentState)
    };
  }

  subscribe(callback) {
    if (typeof callback !== "function") {
      throw new TypeError(
        "Listener must be a function."
      );
    }

    this.listeners.add(callback);

    return () => this.listeners.delete(callback);
  }

  destroy() {
    if (this.destroyed) return;

    this.destroyed = true;

    window.removeEventListener(
      "prumim:activity",
      this.handleActivity
    );

    this.listeners.clear();

    if (this.container) {
      this.container.replaceChildren();

      if (this.createdContainer) {
        this.container.remove();
      }
    }
  }
}

// Prevent duplicate initialization.
const existing = window.__PRUMIM_INDICATOR_INSTANCE__;

const prumimIndicator =
  existing && !existing.destroyed
    ? existing
    : new PRUMIMAgentIndicator();

window.__PRUMIM_INDICATOR_INSTANCE__ =
  prumimIndicator;

// Public browser API.
window.PRUMIMIndicator = {
  setState: (state, detail) =>
    prumimIndicator.setState(state, detail),

  getStatus: () =>
    prumimIndicator.getStatus(),

  subscribe: (callback) =>
    prumimIndicator.subscribe(callback),

  states: STATES,

  destroy: () =>
    prumimIndicator.destroy()
};

// Announce readiness.
window.dispatchEvent(
  new CustomEvent("prumim:indicator-ready")
);

export {
  PRUMIMAgentIndicator,
  STATES
};

export default prumimIndicator;
    
