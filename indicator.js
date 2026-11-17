
const STATES = {
  IDLE: "idle",
  THINKING: "thinking",
  PLANNING: "planning",
  EXECUTING: "executing",
  READING: "reading",
  WRITING: "writing",
  SEARCHING: "searching",
  SPEAKING: "speaking",
  COMPLETED: "completed",
  ERROR: "error"
};

const STATE_DETAILS = {
  idle: {
    label: "Standing by",
    message: "PRUMIM is waiting.",
    color: "#8b91a5",
    icon: "circle"
  },

  thinking: {
    label: "Thinking",
    message: "Processing your request.",
    color: "#67e8f9",
    icon: "brain"
  },

  planning: {
    label: "Planning",
    message: "Creating an execution plan.",
    color: "#a78bfa",
    icon: "workflow"
  },

  executing: {
    label: "Executing",
    message: "Running an operation.",
    color: "#fbbf24",
    icon: "terminal"
  },

  reading: {
    label: "Reading files",
    message: "Inspecting project files.",
    color: "#38bdf8",
    icon: "file-search"
  },

  writing: {
    label: "Writing files",
    message: "Modifying project files.",
    color: "#c084fc",
    icon: "file-pen"
  },

  searching: {
    label: "Searching",
    message: "Searching for information.",
    color: "#22d3ee",
    icon: "search"
  },

  speaking: {
    label: "Speaking",
    message: "PRUMIM is responding.",
    color: "#4ade80",
    icon: "audio-lines"
  },

  completed: {
    label: "Completed",
    message: "Operation completed successfully.",
    color: "#4ade80",
    icon: "check-circle"
  },

  error: {
    label: "Error",
    message: "Something went wrong.",
    color: "#fb7185",
    icon: "alert-circle"
  }
};

class AgentIndicator {
  constructor() {
    this.state = STATES.IDLE;
    this.task = "";
    this.startedAt = null;
    this.updatedAt = Date.now();
    this.listeners = new Set();
    this.activityLog = [];
    this.maxLogs = 100;
  }

  setState(state, task = "") {
    if (!Object.values(STATES).includes(state)) {
      throw new Error(`Unknown indicator state: ${state}`);
    }

    this.state = state;
    this.task = task;
    this.updatedAt = Date.now();

    if (
      state !== STATES.IDLE &&
      state !== STATES.COMPLETED &&
      state !== STATES.ERROR
    ) {
      if (!this.startedAt) {
        this.startedAt = Date.now();
      }
    }

    if (
      state === STATES.COMPLETED ||
      state === STATES.ERROR ||
      state === STATES.IDLE
    ) {
      this.startedAt = null;
    }

    const event = this.getStatus();

    this.activityLog.unshift(event);
    this.activityLog = this.activityLog.slice(0, this.maxLogs);

    this.notify(event);

    return event;
  }

  getStatus() {
    const details = STATE_DETAILS[this.state];

    return {
      state: this.state,
      label: details.label,
      message: this.task || details.message,
      color: details.color,
      icon: details.icon,
      task: this.task,
      startedAt: this.startedAt,
      updatedAt: this.updatedAt,
      elapsed: this.startedAt
        ? Date.now() - this.startedAt
        : 0
    };
  }

  getHistory() {
    return [...this.activityLog];
  }

  subscribe(callback) {
    if (typeof callback !== "function") {
      throw new Error("Listener must be a function.");
    }

    this.listeners.add(callback);

    callback(this.getStatus());

    return () => {
      this.listeners.delete(callback);
    };
  }

  notify(event) {
    for (const callback of this.listeners) {
      try {
        callback(event);
      } catch (error) {
        console.error("Indicator listener error:", error);
      }
    }
  }

  thinking(task = "Analyzing your request") {
    return this.setState(STATES.THINKING, task);
  }

  planning(task = "Preparing execution plan") {
    return this.setState(STATES.PLANNING, task);
  }

  executing(task = "Executing operation") {
    return this.setState(STATES.EXECUTING, task);
  }

  reading(task = "Reading project files") {
    return this.setState(STATES.READING, task);
  }

  writing(task = "Writing project files") {
    return this.setState(STATES.WRITING, task);
  }

  searching(task = "Searching") {
    return this.setState(STATES.SEARCHING, task);
  }

  speaking(task = "Preparing response") {
    return this.setState(STATES.SPEAKING, task);
  }

  complete(task = "Task completed") {
    return this.setState(STATES.COMPLETED, task);
  }

  error(task = "Operation failed") {
    return this.setState(STATES.ERROR, task);
  }

  reset() {
    return this.setState(STATES.IDLE);
  }
}

const indicator = new AgentIndicator();

export {
  STATES,
  STATE_DETAILS,
  AgentIndicator,
  indicator
};

export default indicator;
    
