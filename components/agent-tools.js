
/**
 * PRUMIM AI — AGENT TOOLS
 * File: components/agent-tools.js
 *
 * Central registry for agent capabilities.
 */

import terminal from "./terminal-client.js";

const tools = {
  terminal_execute: {
    name: "terminal_execute",
    description: "Execute an allowed terminal command.",
    parameters: {
      command: "string",
      args: "string[]"
    },

    async execute({ command, args = [] }) {
      return terminal.execute(command, args);
    }
  },

  file_read: {
    name: "file_read",
    description: "Read a project file.",
    parameters: {
      filePath: "string"
    },

    async execute({ filePath }) {
      return terminal.readFile(filePath);
    }
  }
};

class PRUMIMTools {
  constructor() {
    this.registry = new Map();
    this.registerDefaults();
  }

  registerDefaults() {
    Object.values(tools).forEach(tool => {
      this.register(tool);
    });
  }

  register(tool) {
    if (!tool.name || typeof tool.execute !== "function") {
      throw new Error("Invalid agent tool.");
    }

    this.registry.set(tool.name, tool);
  }

  get(name) {
    return this.registry.get(name) || null;
  }

  list() {
    return Array.from(this.registry.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }));
  }

  async execute(name, args = {}) {
    const tool = this.get(name);

    if (!tool) {
      throw new Error(`Unknown PRUMIM tool: ${name}`);
    }

    if (!args || typeof args !== "object" || Array.isArray(args)) {
      throw new Error("Tool arguments must be an object.");
    }

    try {
      window.dispatchEvent(
        new CustomEvent("prumim:activity", {
          detail: {
            state: "executing",
            detail: `Using ${name}`
          }
        })
      );

      const result = await tool.execute(args);

      return {
        success: true,
        tool: name,
        result
      };

    } catch (error) {
      return {
        success: false,
        tool: name,
        error: error.message
      };
    }
  }
}

const prumimTools = new PRUMIMTools();

window.PRUMIMTools = prumimTools;

export {
  PRUMIMTools,
  tools
};

export default prumimTools;
      
