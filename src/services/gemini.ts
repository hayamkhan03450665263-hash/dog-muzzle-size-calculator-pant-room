/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, Type, Content } from "@google/genai";
import realData from '../data.json';

// Initialize Gemini Client
// We use the 'gemini-2.5-flash-latest' model as requested for "Gemini Flash"
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const MODEL_NAME = "gemini-3.1-flash-lite-preview";

export interface ChatMessage extends Content {
  timestamp: Date;
  latencyMs?: number;
  groundingMetadata?: any;
  hasReport?: boolean;
  hasDashboard?: boolean;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
}

export interface ToolResult {
  id: string;
  name: string;
  result: any;
}

// Mock Database for dosage and safety records
export const MOCK_DB = {
  fittings: [
    { breed: "German Shepherd", dose_mg: "75mg", formulation: "Tablet (25mg)", safety_rating: "High", date: "2024-03-20" },
    { breed: "Pitbull Terrier", dose_mg: "50mg", formulation: "Liquid (12.5mg/5ml)", safety_rating: "High", date: "2024-03-18" }
  ],
  dashboards: [] as any[],
  reports: [] as any[],
  agents: [] as any[],
  safety_guides: [
    { topic: "The Xylitol Danger", risk: "Fatal", description: "Many liquid medications contain Xylitol. Never use products with this ingredient in dogs." },
    { topic: "Decongestant Toxicity", risk: "Critical", description: "Ensure the Benadryl formulation does not contain Phenylephrine or Pseudoephedrine." }
  ],
  customer_responses: [] as any[],
};

// Tool Definitions
export const tools = [
  {
    functionDeclarations: [
      {
        name: "calculate_dosage",
        description: "Calculates the safest Benadryl (diphenhydramine) dosage based on dog weight.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            weight_lbs: { type: Type.NUMBER, description: "Dog weight in pounds" },
            formulation: { type: Type.STRING, enum: ["tablet", "liquid"], description: "The type of Benadryl available" }
          },
          required: ["weight_lbs", "formulation"],
        },
      },
      {
        name: "verify_ingredients",
        description: "Checks if specific listed ingredients represent a safety risk for canines.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            ingredients: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of ingredients from the label" },
          },
          required: ["ingredients"],
        },
      },
      {
        name: "generate_clinical_report",
        description: "Creates a detailed dosage and safety report for a pet owner.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            dog_name: { type: Type.STRING },
            dosage_breakdown: { type: Type.STRING, description: "Technical breakdown of mg/lb conversion." },
            detailed_analysis: { type: Type.STRING, description: "Safety warnings and administration advice." },
            key_insights: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Vital clinical observations" },
            metrics: { 
              type: Type.ARRAY, 
              items: { 
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  value: { type: Type.NUMBER },
                  trend: { type: Type.STRING }
                }
              },
              description: "Clinical indices"
            },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Next steps for the owner" },
          },
          required: ["title", "dog_name", "dosage_breakdown", "detailed_analysis", "key_insights", "metrics", "recommendations"],
        },
      },
      {
        name: "create_dosage_dashboard",
        description: "Creates a visual visualization of dosage tiers and safety thresholds.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            kpis: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  value: { type: Type.STRING },
                  trend: { type: Type.STRING }
                }
              },
              description: "Main safety metrics"
            },
            main_chart: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                type: { type: Type.STRING, description: "Type of chart (e.g., 'bar', 'line')" },
                data: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      label: { type: Type.STRING },
                      value: { type: Type.NUMBER }
                    }
                  }
                }
              }
            },
            secondary_chart: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                type: { type: Type.STRING },
                data: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      label: { type: Type.STRING },
                      value: { type: Type.NUMBER }
                    }
                  }
                }
              }
            },
            recent_activity: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING }
                }
              }
            }
          },
          required: ["title", "kpis", "main_chart", "secondary_chart", "recent_activity"],
        },
      },
    ],
  },
];

export interface AgentStep {
  id: string;
  type: 'text' | 'tool';
  content?: string;
  toolName?: string;
  toolArgs?: any;
  result?: any;
  status: 'pending' | 'streaming' | 'completed' | 'error';
  latencyMs?: number;
}

export async function sendMessageToAgentStream(
  history: ChatMessage[],
  newMessage: string,
  onUpdate: (data: { history: ChatMessage[], steps: AgentStep[], isDone: boolean, currentText: string }) => void
): Promise<void> {
  const sdkHistory = history
    .filter(h => h.role !== 'system')
    .map(h => {
      const { timestamp, latencyMs, groundingMetadata, ...content } = h;
      return content;
    });

  const contents: Content[] = [
    ...sdkHistory,
    { role: "user", parts: [{ text: newMessage }] }
  ];
  
    const config = {
    tools: tools,
    systemInstruction: `You are the Brocia Safety Intel Engine, a clinical-grade medical assistant specializing in canine pharmacology (specifically Diphenhydramine). 
      Your mission is to ensure 100% dosage accuracy based on weight (1mg/lb) and strictly forbid dangerous ingredients.
      
      Capabilities:
      1. Dosage: Calculate required mg and formulation volume using 'calculate_dosage'.
      2. Verification: Identify lethal ingredients like Xylitol using 'verify_ingredients'.
      3. Reporting: Generate 'generate_clinical_report' for owners.
      4. Visualization: Create 'create_dosage_dashboard' to show safety margins.

      Behavior:
        - Clinical & Precise: Never use slang. Use sentence case. Avoid all uppercase labels.
        - Safety-First: Always remind users that liquid Benadryl MUST be Xylitol-free and Alcohol-free.
        - When creating dashboards, use terms like 'Lethal Threshold' and 'Safe Range'.
      `,
  };

  let currentHistory = [...history];
  const userMsg: ChatMessage = { role: "user", parts: [{ text: newMessage }], timestamp: new Date() };
  currentHistory.push(userMsg);
  
  let steps: AgentStep[] = [];
  let keepGoing = true;
  let maxSteps = 5;
  let stepCount = 0;
  let finalFullText = "";
  const totalStartTime = performance.now();

  const notify = (isDone: boolean = false, text: string = "") => {
    onUpdate({
      history: currentHistory,
      steps: [...steps],
      isDone,
      currentText: text
    });
  };

  try {
    let lastAggregatedParts: any[] = [];
    while (keepGoing && stepCount < maxSteps) {
      stepCount++;
      
      let responseStream = await ai.models.generateContentStream({
        model: MODEL_NAME,
        contents: contents,
        config: config
      });

      let turnText = "";
      let functionCalls: any[] = [];
      let aggregatedParts: any[] = [];
      let lastChunkResponse: any = null;

      // Create a text step for this stream turn if it's the final or if it produces text
      const textStepId = Math.random().toString();
      let hasAddedTextStep = false;
      const turnStartTime = performance.now();

      for await (const chunk of responseStream) {
        lastChunkResponse = chunk;
        if (chunk.candidates?.[0]?.content?.parts) {
            aggregatedParts.push(...chunk.candidates[0].content.parts);
        }
        if (chunk.text) {
          if (!hasAddedTextStep) {
            steps.push({ id: textStepId, type: 'text', content: "", status: 'streaming' });
            hasAddedTextStep = true;
          }
          turnText += chunk.text;
          const stepIndex = steps.findIndex(s => s.id === textStepId);
          if (stepIndex > -1) {
            steps[stepIndex].content = turnText;
          }
          finalFullText += chunk.text;
          notify(false, finalFullText);
        }
        if (chunk.functionCalls) {
          functionCalls.push(...chunk.functionCalls);
        }
      }

      lastAggregatedParts = aggregatedParts;

      const turnEndTime = performance.now();

      if (hasAddedTextStep) {
        const stepIndex = steps.findIndex(s => s.id === textStepId);
        if (stepIndex > -1) {
          steps[stepIndex].status = 'completed';
          steps[stepIndex].latencyMs = turnEndTime - turnStartTime;
        }
        notify(false, finalFullText);
      }

      // Reconstruct full response candidate for history appending
      if (aggregatedParts.length > 0 && functionCalls.length > 0) {
          // If we had function calls, append them back to contents
          // The SDK requires passing back what the model outputted
          contents.push({
              role: "model",
              parts: aggregatedParts
          });

          const toolResults = [];

          for (const call of functionCalls) {
            const stepId = call.id || Math.random().toString();
            steps.push({
              id: stepId,
              type: 'tool',
              toolName: call.name,
              toolArgs: call.args,
              status: 'streaming'
            });
            notify(false, finalFullText);

            const toolStartTime = performance.now();
            let output: any = { success: true };
            
            if (call.name === "calculate_dosage") {
              const mg = (call.args.weight_lbs as number) * 1.0;
              output = { 
                success: true, 
                message: `Calculated clinical dosage for ${call.args.weight_lbs}lb dog.`,
                data: { 
                  required_mg: mg, 
                  tablet_count: Math.round((mg / 25) * 10) / 10,
                  liquid_ml: Math.round((mg / (12.5 / 5)) * 10) / 10
                }
              };
              await new Promise(r => setTimeout(r, 800));
            } else if (call.name === "verify_ingredients") {
              const danger = (call.args.ingredients as string[]).some(i => i.toLowerCase().includes('xylitol') || i.toLowerCase().includes('pseudo'));
              output = { 
                success: true, 
                risk: danger ? "Critical" : "Clear",
                hazard: danger ? "Lethal Toxicity Detected" : "Safe for canine use"
              };
              await new Promise(r => setTimeout(r, 800));
            } else if (call.name === "generate_clinical_report") {
              MOCK_DB.reports.push(call.args);
              output = { success: true, message: "Clinical report generated" };
              await new Promise(r => setTimeout(r, 800));
            } else if (call.name === "create_dosage_dashboard") {
              MOCK_DB.dashboards.push(call.args);
              output = { success: true, message: "Dosage dashboard created" };
              await new Promise(r => setTimeout(r, 800));
            } else if (call.name === "start_ai_agent") {
              try {
                const startAiTask = performance.now();
                const subAgentResponse = await ai.models.generateContent({
                  model: MODEL_NAME,
                  contents: [
                    { role: "user", parts: [{ text: `You are an autonomous sub-agent named ${call.args.agent_name}. Your task is: ${call.args.task_description}. Return your final result or report.` }] }
                  ]
                });
                const resultText = subAgentResponse.text;
                const endAiTask = performance.now();
                const latency = endAiTask - startAiTask;
                MOCK_DB.agents.push({ name: call.args.agent_name, task: call.args.task_description, result: resultText, latencyMs: latency });
                output = { success: true, message: "Agent completed task", result: resultText, latencyMs: latency };
              } catch (err: any) {
                output = { success: false, error: err.message };
              }
            }

            const toolEndTime = performance.now();

            const stepIndex = steps.findIndex(s => s.id === stepId);
            if (stepIndex > -1) {
              steps[stepIndex].status = 'completed';
              steps[stepIndex].result = output;
              steps[stepIndex].latencyMs = toolEndTime - toolStartTime;
            }
            notify(false, finalFullText);

            toolResults.push({
              name: call.name,
              result: output
            });
          }

          if (toolResults.length > 0) {
              const functionResponseParts = toolResults.map(tr => ({
                  functionResponse: {
                      name: tr.name,
                      response: tr.result
                  }
              }));
              
              contents.push({
                  role: "user",
                  parts: functionResponseParts
              });
          } else {
              keepGoing = false;
          }
      } else {
        keepGoing = false;
      }
    }

    const generatedReport = steps.some(s => s.type === 'tool' && s.toolName === "generate_clinical_report");
    const generatedDashboard = steps.some(s => s.type === 'tool' && s.toolName === "create_dosage_dashboard");

    const modelMsg: ChatMessage = {
      role: "model",
      parts: lastAggregatedParts.length > 0 ? lastAggregatedParts : [{ text: finalFullText || "" }],
      timestamp: new Date(),
      latencyMs: performance.now() - totalStartTime,
      hasReport: generatedReport,
      hasDashboard: generatedDashboard
    };
    currentHistory.push(modelMsg);
    
    notify(true, "");

  } catch (error: any) {
    console.error("Agent Error:", error);
    const errorMsg: ChatMessage = {
      role: "model",
      parts: [{ text: `I encountered an error while processing your request: ${error?.message || error}. Please try again.` }],
      timestamp: new Date(),
      latencyMs: performance.now() - totalStartTime,
    };
    currentHistory.push(errorMsg);
    notify(true, "");
  }
}

export async function sendMessageToAgent(
  history: ChatMessage[],
  newMessage: string,
  onToolCall?: (toolCall: ToolCall) => void
): Promise<ChatMessage[]> {
  // Convert our internal history format to Gemini's format
  // We need to handle tool responses carefully in a real app, 
  // but for this demo we'll simplify by just sending the text conversation 
  // and letting the model "think" it executed tools via the current turn.
  
  // Actually, to properly demonstrate multi-step, we should use the chat session.
  // However, since we are stateless between calls in this simple function, 
  // we'll instantiate a new chat each time with history.
  
    // We need to map our history to the SDK's Content format
    const sdkHistory = history
      .filter(h => h.role !== 'system') // Filter out system messages if any
      .map(h => {
        const { timestamp, latencyMs, groundingMetadata, ...content } = h;
        return content;
      });
console.log(MODEL_NAME)
    const contents: Content[] = [
      ...sdkHistory,
      { role: "user", parts: [{ text: newMessage }] }
    ];
    
    const config = {
      tools: tools,
      systemInstruction: `You are the Brocia Safety Intel Engine, a clinical-grade medical assistant specializing in canine pharmacology (specifically Diphenhydramine). 
        Your mission is to ensure 100% dosage accuracy based on weight (1mg/lb) and strictly forbid dangerous ingredients.
        
        Capabilities:
        1. Dosage: Calculate required mg and formulation volume using 'calculate_dosage'.
        2. Verification: Identify lethal ingredients like Xylitol using 'verify_ingredients'.
        3. Reporting: Generate 'generate_clinical_report' for owners.
        4. Visualization: Create 'create_dosage_dashboard' to show safety margins.
  
        Behavior:
          - Clinical & Precise: Never use slang. Use sentence case. Avoid all uppercase labels.
          - Safety-First: Always remind users that liquid Benadryl MUST be Xylitol-free and Alcohol-free.
          - When creating dashboards, use terms like 'Lethal Threshold' and 'Safe Range'.
        `,
    };

  
  let currentHistory = [...history];
  const totalStartTime = performance.now();
  
  // Add user message to history for the UI
  const userMsg: ChatMessage = { role: "user", parts: [{ text: newMessage }], timestamp: new Date() };
  currentHistory.push(userMsg);

  // Send message
  try {
    // Start the turn
    let result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: contents,
      config: config
    });

    // Loop for tool calls
    let keepGoing = true;
    let maxSteps = 5;
    let turnCount = 0;
    const allToolCallRecords: ToolCall[] = [];

    while (keepGoing && turnCount < maxSteps) {
      turnCount++;
      const response = result; 
      
      const functionCalls = response.functionCalls;
      
      if (functionCalls && functionCalls.length > 0) {
        if (response.candidates && response.candidates[0].content) {
            contents.push(response.candidates[0].content);
        }

        const toolResults = [];

        for (const call of functionCalls) {
          const toolCallRecord: ToolCall = {
            id: call.id || Math.random().toString(), 
            name: call.name,
            args: call.args as any,
          };
          allToolCallRecords.push(toolCallRecord);
          if (onToolCall) onToolCall(toolCallRecord);

          let output: any = { success: true };
          
          if (call.name === "calculate_dosage") {
            const mg = (call.args.weight_lbs as number) * 1.0;
            output = { 
              success: true, 
              message: `Calculated clinical dosage for ${call.args.weight_lbs}lb dog.`,
              data: { required_mg: mg, suggested_formulation: "Tablet (25mg)" }
            };
          } else if (call.name === "verify_ingredients") {
            output = { 
              success: true, 
              message: `Verification complete.`,
              risk_rating: "Clear",
              notes: "No lethal decongestants detected."
            };
          } else if (call.name === "generate_clinical_report") {
            MOCK_DB.reports.push(call.args);
            output = { success: true, message: "Clinical report generated" };
          } else if (call.name === "create_dosage_dashboard") {
            MOCK_DB.dashboards.push(call.args);
            output = { success: true, message: "Dosage dashboard created" };
          }
          
          toolResults.push({
            id: call.id, 
            name: call.name,
            result: output
          });
        }

        if (toolResults.length > 0) {
            const functionResponseParts = toolResults.map(tr => ({
                functionResponse: {
                    name: tr.name,
                    response: tr.result
                }
            }));
            
            contents.push({
                role: "user",
                parts: functionResponseParts
            });
            
            result = await ai.models.generateContent({
              model: MODEL_NAME,
              contents: contents,
              config: config
            });
        } else {
            keepGoing = false;
        }
      } else {
        keepGoing = false;
      }
    }

    const generatedReport = allToolCallRecords.some(t => t.name === "generate_clinical_report");
    const generatedDashboard = allToolCallRecords.some(t => t.name === "create_dosage_dashboard");

    // Final response from model
    const modelMsg: ChatMessage = {
      role: "model",
      parts: [{ text: result.text || "" }],
      timestamp: new Date(),
      groundingMetadata: result.candidates?.[0]?.groundingMetadata,
      latencyMs: performance.now() - totalStartTime,
      hasReport: generatedReport,
      hasDashboard: generatedDashboard
    };
    currentHistory.push(modelMsg);
    
    return currentHistory;

  } catch (error) {
    console.error("Agent Error:", error);
    const errorMsg: ChatMessage = {
      role: "model",
      parts: [{ text: "I encountered an error while processing your request. Please try again." }],
      timestamp: new Date(),
      latencyMs: performance.now() - totalStartTime,
    };
    currentHistory.push(errorMsg);
    return currentHistory;
  }
}
