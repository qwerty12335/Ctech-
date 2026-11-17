
/**
 * PRUMIM AI — TERMINAL ENGINE
 * File: api/terminal.js
 *
 * Secure server-side terminal execution.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs/promises";

const executeFile = promisify(execFile);

const PROJECT_ROOT = process.cwd();

const BLOCKED_COMMANDS = [
  "sudo",
  "su",
  "shutdown",
  "reboot",
  "mkfs",
  "fdisk",
  "dd",
  "mount",
  "umount"
];

const ALLOWED_COMMANDS = [
  "pwd",
  "ls",
  "cat",
  "head",
  "tail",
  "find",
  "grep",
  "wc",
  "echo",
  "whoami",
  "node",
  "npm",
  "npx",
  "git",
  "python",
  "python3"
];

function send(res, status, data) {
  return res.status(status).json(data);
}

function isSafePath(filePath) {
  const resolved = path.resolve(PROJECT_ROOT, filePath);

  return (
    resolved === PROJECT_ROOT ||
    resolved.startsWith(PROJECT_ROOT + path.sep)
  );
}

async function runCommand(command, args = []) {
  if (!ALLOWED_COMMANDS.includes(command)) {
    throw new Error("Command is not permitted.");
  }

  if (BLOCKED_COMMANDS.includes(command)) {
    throw new Error("Dangerous command blocked.");
  }

  const result = await executeFile(
    command,
    args,
    {
      cwd: PROJECT_ROOT,
      timeout: 30000,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
      shell: false,
      env: {
        PATH: process.env.PATH || "",
        HOME: process.env.HOME || "",
        NODE_ENV: process.env.NODE_ENV || "production"
      }
    }
  );

  return {
    stdout: result.stdout,
    stderr: result.stderr
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return send(res, 405, {
      success: false,
      error: "Method not allowed."
    });
  }

  try {
    const {
      action,
      command,
      args = [],
      filePath
    } = req.body || {};

    if (action === "execute") {
      if (
        typeof command !== "string" ||
        !Array.isArray(args) ||
        !args.every(arg => typeof arg === "string")
      ) {
        return send(res, 400, {
          success: false,
          error: "Invalid command arguments."
        });
      }

      const result = await runCommand(command, args);

      return send(res, 200, {
        success: true,
        action: "execute",
        command,
        ...result
      });
    }

    if (action === "read") {
      if (
        typeof filePath !== "string" ||
        !isSafePath(filePath)
      ) {
        return send(res, 400, {
          success: false,
          error: "Invalid file path."
        });
      }

      const content = await fs.readFile(
        path.resolve(PROJECT_ROOT, filePath),
        "utf8"
      );

      return send(res, 200, {
        success: true,
        action: "read",
        filePath,
        content
      });
    }

    return send(res, 400, {
      success: false,
      error: "Unknown terminal action."
    });

  } catch (error) {
    console.error("PRUMIM Terminal Error:", error);

    return send(res, 500, {
      success: false,
      error: error.message || "Terminal execution failed."
    });
  }
  }
    
