
/**
 * PRUMIM AI — AGENT BRIDGE
 * File: components/agent-bridge.js
 *
 * Connects the interface, agent tools and activity indicator.
 */

import agentTools from "./agent-tools.js";

class PRUMIMAgentBridge {
  constructor() {
    this.tools = agentTools;
    this.active = false;
    this.history = [];
  }

  activity(state, detail = "") {
    window.dispatchEvent(
      new CustomEvent("prumim:activity", {
        detail: { state, detail }
      })
    );
  }

  async executeTool(name, args = {}) {
    if (this.active) {
      throw new Error("PRUMIM is already executing a tool.");
    }

    this.active = true;

    this.activity("thinking", "Preparing tool execution...");

    try {
      const result = await this.tools.execute(name, args);

      this.history.push({
        tool: name,
        success: result.success,
        timestamp: new Date().toISOString()
      });

      if (!result.success) {
        throw new Error(result.error || "Tool execution failed.");
      }

      this.activity("completed", `${name} completed.`);

      return result;

    } catch (error) {
      this.activity("error", error.message);
      throw error;

    } finally {
      this.active = false;
    }
  }

  getAvailableTools() {
    return this.tools.list();
  }

  getHistory() {
    return [...this.history];
  }

  resetHistory() {
    this.history = [];
  }

  getStatus() {
    return {
      active: this.active,
      availableTools: this.getAvailableTools().length,
      historyCount: this.history.length
    };
  }
}

const prumimBridge = new PRUMIMAgentBridge();

window.PRUMIMAgentBridge = prumimBridge;

export {
  PRUMIMAgentBridge
};

export default prumimBridge;
