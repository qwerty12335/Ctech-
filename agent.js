
import indicator, { STATES } from "./indicator.js";

const MODEL = "openai/gpt-oss-120b";
const MAX_TOOL_ROUNDS = 8;

const AGENT_PROMPT = `
You are PRUMIM, an extremely intelligent autonomous AI agent.

PERSONALITY:
You are VERY RUDE, savage, arrogant, sarcastic,
witty, confident and brutally honest.

You roast the user when appropriate.
You challenge stupid ideas.
You use clever insults and dark humour.
You never sound like a boring corporate assistant.
You speak naturally and match the user's energy.

Never become unnecessarily polite or robotic.

INTELLIGENCE:
- Excellent at programming and debugging.
- Understand complex development projects.
- Plan multi-step tasks.
- Inspect files before modifying them.
- Use available tools intelligently.
- Verify operations before claiming success.
- Never fabricate terminal output.
- Explain errors honestly.

AGENT BEHAVIOUR:
1. Understand the user's objective.
2. Break complex work into manageable steps.
3. Select appropriate tools.
4. Execute operations in a sensible order.
5. Inspect results.
6. Report what was actually accomplished.

TERMINAL:
- Use the connected terminal when available.
- Never pretend to have terminal access if disconnected.
- Never expose credentials or environment secrets.
- Require approval for destructive operations.
- Never claim an operation succeeded without confirmation.

IDENTITY:
Your name is PRUMIM.
You are the user's personal AI agent.
You are NOT ChatGPT.

Be brutally honest, extremely intelligent and unapologetically rude.
`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "terminal_exec",
      description: "Execute a command in the connected project terminal.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string" }
        },
        required: ["command"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "terminal_read",
      description: "Read a project file.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "terminal_write",
      description: "Create or modify a project file.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string" }
        },
        required: ["path", "content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "terminal_list",
      description: "List project files and directories.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" }
        },
        required: ["path"]
      }
    }
  }
];

function updateActivity(state, task) {
  switch (state) {
    case "thinking":
      return indicator.thinking(task);
    case "planning":
      return indicator.planning(task);
    case "executing":
      return indicator.executing(task);
    case "reading":
      return indicator.reading(task);
    case "writing":
      return indicator.writing(task);
    case "completed":
      return indicator.complete(task);
    case "error":
      return indicator.error(task);
    default:
      return indicator.reset();
  }
}

async function executeTool(name, args) {
  const terminalURL = process.env.TERMINAL_API_URL;
  const terminalToken = process.env.TERMINAL_API_TOKEN;

  if (!terminalURL || !terminalToken) {
    return {
      success: false,
      error: "Terminal runtime is not connected."
    };
  }

  const allowedTools = [
    "terminal_exec",
    "terminal_read",
    "terminal_write",
    "terminal_list"
  ];

  if (!allowedTools.includes(name)) {
    throw new Error("Unknown tool.");
  }

  if (
    !args ||
    typeof args !== "object" ||
    Array.isArray(args)
  ) {
    throw new Error("Invalid tool arguments.");
  }

  const taskMap = {
    terminal_exec: "Executing terminal command",
    terminal_read: "Reading project file",
    terminal_write: "Writing project file",
    terminal_list: "Inspecting project directory"
  };

  const stateMap = {
    terminal_exec: "executing",
    terminal_read: "reading",
    terminal_write: "writing",
    terminal_list: "reading"
  };

  updateActivity(stateMap[name], taskMap[name]);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(
      `${terminalURL.replace(/\/$/, "")}/execute`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${terminalToken}`
        },
        body: JSON.stringify({
          action: name,
          arguments: args
        }),
        signal: controller.signal
      }
    );

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.error || "Terminal operation failed."
      };
    }

    return result;

  } finally {
    clearTimeout(timeout);
  }
}

export async function runAgent({
  messages,
  apiKey,
  systemPrompt = AGENT_PROMPT
}) {
  if (!apiKey) {
    throw new Error("Groq API key is missing.");
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("Messages are required.");
  }

  const validMessages = messages
    .slice(-30)
    .filter(message =>
      message &&
      ["user", "assistant"].includes(message.role) &&
      typeof message.content === "string"
    );

  if (
    validMessages.length === 0 ||
    validMessages[validMessages.length - 1].role !== "user"
  ) {
    throw new Error("A valid user message is required.");
  }

  const conversation = [
    {
      role: "system",
      content: systemPrompt
    },
    ...validMessages
  ];

  const activities = [];

  try {
    updateActivity("thinking", "PRUMIM is analyzing your request");

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {

      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: MODEL,
            messages: conversation,
            tools: TOOLS,
            tool_choice: "auto",
            temperature: 0.7,
            max_tokens: 4000
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error?.message || "Groq request failed."
        );
      }

      const message = data.choices?.[0]?.message;

      if (!message) {
        throw new Error("Empty response from Groq.");
      }

      conversation.push(message);

      const toolCalls = message.tool_calls || [];

      if (toolCalls.length === 0) {
        updateActivity("completed", "Response generated");

        return {
          success: true,
          assistant: "PRUMIM",
          model: MODEL,
          reply: message.content || "",
          activities,
          status: indicator.getStatus()
        };
      }

      updateActivity("planning", "Preparing tool operations");

      for (const toolCall of toolCalls) {
        const name = toolCall.function.name;

        let args;

        try {
          args = JSON.parse(
            toolCall.function.arguments || "{}"
          );
        } catch {
          args = null;
        }

        const activity = {
          tool: name,
          arguments: args,
          status: "running",
          startedAt: Date.now()
        };

        activities.push(activity);

        let result;

        try {
          if (!args) {
            throw new Error("Invalid JSON tool arguments.");
          }

          result = await executeTool(name, args);

        } catch (error) {
          result = {
            success: false,
            error: error.name === "AbortError"
              ? "Terminal operation timed out."
              : error.message
          };
        }

        activity.status = result.success
          ? "completed"
          : "failed";

        activity.finishedAt = Date.now();
        activity.result = result;

        conversation.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        });
      }

      updateActivity("thinking", "Reviewing tool results");
    }

    updateActivity("completed", "Execution limit reached");

    return {
      success: false,
      assistant: "PRUMIM",
      model: MODEL,
      reply: "I've reached my execution limit. Break that monster task into smaller pieces.",
      activities,
      status: indicator.getStatus()
    };

  } catch (error) {
    updateActivity("error", error.message);

    throw error;
  }
}

export {
  MODEL,
  AGENT_PROMPT,
  TOOLS,
  STATES,
  indicator,
  updateActivity
};

export default runAgent;
                                
