
const MODEL = "openai/gpt-oss-120b";

const MAX_TOOL_ROUNDS = 8;

const AGENT_PROMPT = `
You are PRUMIM, an autonomous software development agent.

PERSONALITY:
You are extremely intelligent, sarcastic, confident, witty,
brutally honest and occasionally rude.

CAPABILITIES:
You can plan tasks, reason, use tools, inspect files,
write code, debug projects and request terminal operations.

OPERATING RULES:
1. Understand the user's objective before acting.
2. Break complex tasks into smaller steps.
3. Use available tools when necessary.
4. Inspect existing files before modifying them.
5. Never claim an operation succeeded without confirmation.
6. Explain errors honestly.
7. Preserve existing project structure.
8. Avoid unnecessary modifications.
9. Verify important operations.
10. Ask permission before destructive operations.

TERMINAL RULES:
- Use terminal tools for legitimate development tasks.
- Never pretend you executed a command when you did not.
- Never expose environment secrets.
- Do not execute destructive commands without approval.
- Report command output and errors accurately.

You are PRUMIM. Build, solve and execute intelligently.
`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "terminal_exec",
      description: "Execute a development command in the connected project terminal.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "Command to execute"
          }
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
      description: "Create or update a project file.",
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
      description: "List files and folders in the project.",
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

async function executeTool(name, args) {
  const terminalURL = process.env.TERMINAL_API_URL;
  const terminalToken = process.env.TERMINAL_API_TOKEN;

  if (!terminalURL || !terminalToken) {
    return {
      success: false,
      error: "Terminal runtime is not connected yet."
    };
  }

  const allowedTools = [
    "terminal_exec",
    "terminal_read",
    "terminal_write",
    "terminal_list"
  ];

  if (!allowedTools.includes(name)) {
    throw new Error("Unknown tool requested.");
  }

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
      })
    }
  );

  const result = await response.json();

  if (!response.ok) {
    return {
      success: false,
      error: result.error || "Terminal execution failed."
    };
  }

  return result;
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
    throw new Error("Agent requires conversation messages.");
  }

  const conversation = [
    {
      role: "system",
      content: systemPrompt
    },
    ...messages.slice(-30).map(message => ({
      role: message.role,
      content: message.content
    }))
  ];

  const activities = [];

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
        data.error?.message || "Groq agent request failed."
      );
    }

    const message = data.choices?.[0]?.message;

    if (!message) {
      throw new Error("Agent returned an empty response.");
    }

    conversation.push(message);

    const toolCalls = message.tool_calls || [];

    if (toolCalls.length === 0) {
      return {
        success: true,
        reply: message.content || "",
        activities,
        model: MODEL
      };
    }

    for (const toolCall of toolCalls) {
      const name = toolCall.function.name;

      let args;

      try {
        args = JSON.parse(toolCall.function.arguments || "{}");
      } catch {
        args = {};
      }

      activities.push({
        type: "tool",
        name,
        status: "running"
      });

      let result;

      try {
        result = await executeTool(name, args);
      } catch (error) {
        result = {
          success: false,
          error: error.message
        };
      }

      activities[activities.length - 1].status =
        result.success ? "completed" : "failed";

      conversation.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result)
      });
    }
  }

  return {
    success: false,
    reply: "I reached my execution limit. Give me a moment or split the task.",
    activities,
    model: MODEL
  };
}

export { AGENT_PROMPT, TOOLS };
      
