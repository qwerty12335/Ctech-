
/**
 * PRUMIM AI — TERMINAL CLIENT
 * File: components/terminal-client.js
 *
 * Connects the browser agent to the terminal API.
 */

class PRUMIMTerminal {
  constructor(options = {}) {
    this.endpoint = options.endpoint || "/api/terminal";
    this.timeout = options.timeout || 35000;
    this.busy = false;
  }

  setActivity(state, detail = "") {
    window.dispatchEvent(
      new CustomEvent("prumim:activity", {
        detail: { state, detail }
      })
    );
  }

  async request(payload) {
    if (this.busy) {
      throw new Error("PRUMIM terminal is already busy.");
    }

    this.busy = true;

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.timeout
    );

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || `Terminal request failed: ${response.status}`
        );
      }

      return data;

    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("Terminal request timed out.");
      }

      throw error;

    } finally {
      clearTimeout(timeoutId);
      this.busy = false;
    }
  }

  async execute(command, args = []) {
    if (typeof command !== "string" || !command.trim()) {
      throw new Error("A valid command is required.");
    }

    if (!Array.isArray(args) ||
        !args.every(arg => typeof arg === "string")) {
      throw new Error("Invalid command arguments.");
    }

    this.setActivity(
      "executing",
      `Running ${command}...`
    );

    try {
      const result = await this.request({
        action: "execute",
        command,
        args
      });

      this.setActivity(
        "completed",
        "Command executed successfully."
      );

      return result;

    } catch (error) {
      this.setActivity("error", error.message);
      throw error;
    }
  }

  async readFile(filePath) {
    if (typeof filePath !== "string" || !filePath.trim()) {
      throw new Error("A valid file path is required.");
    }

    this.setActivity(
      "reading",
      `Reading ${filePath}...`
    );

    try {
      const result = await this.request({
        action: "read",
        filePath
      });

      this.setActivity(
        "completed",
        `Read ${filePath}`
      );

      return result.content;

    } catch (error) {
      this.setActivity("error", error.message);
      throw error;
    }
  }
}

// Create one shared terminal instance.
const prumimTerminal = new PRUMIMTerminal();

// Browser API.
window.PRUMIMTerminal = prumimTerminal;

export {
  PRUMIMTerminal
};

export default prumimTerminal;
    
