import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { callNvidiaAPI } from "../src/nvidia";

async function runAITest() {
    console.log("🤖 Initiating direct test of the Nvidia NIM AI integration...");

    // 1. Extract API Key from .dev.vars
    let apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) {
        try {
            const devVars = readFileSync(resolve(process.cwd(), ".dev.vars"), "utf8");
            const match = devVars.match(/NVIDIA_API_KEY=(.+)/);
            if (match) {
                apiKey = match[1].trim();
            }
        } catch (e) {
            console.error("Could not read .dev.vars file");
        }
    }

    if (!apiKey) {
        console.error("❌ NVIDIA_API_KEY not found.");
        process.exit(1);
    }

    // 2. Mock a realistic CI failure scenario
    const filePath = "src/math.ts";
    const mockLogs = `
=== src/math.ts ===
src/math.ts(5,3): error TS2322: Type 'string' is not assignable to type 'number'.
`;

    const brokenCode = `export function addNumbers(a: number, b: number): number {
  // Developer accidentally returned a string
  return a + b + " is the result";
}
`;

    console.log("📋 Sending the following broken code:");
    console.log("--------------------------------------------------");
    console.log(brokenCode);
    console.log("--------------------------------------------------");
    console.log("🚨 With the following error logs:");
    console.log(mockLogs.trim() + "\n");

    console.log("⏳ Waiting for Nvidia NIM (minimax/minimax-2.5) to generate the fix...\n");

    try {
        const fixedContent = await callNvidiaAPI(apiKey, mockLogs, brokenCode, filePath);

        console.log("✅ AI Fix Received! The raw corrected file content is:");
        console.log("==================================================");
        console.log(fixedContent);
        console.log("==================================================");

        // Evaluate if the AI followed instructions (no markdown fences)
        if (fixedContent.includes("```")) {
            console.warn("⚠️ Warning: The AI included markdown fences despite the prompt explicitly forbidding it.");
        } else if (fixedContent.includes("is the result")) {
            console.warn("⚠️ Warning: The AI didn't actually fix the bug.");
        } else {
            console.log("🎉 SUCCESS! The AI correctly fixed the code without any markdown or extra text.");
        }

    } catch (error) {
        console.error("💥 AI Call Failed:");
        console.error(error);
    }
}

runAITest();
