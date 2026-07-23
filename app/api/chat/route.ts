import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import * as crm from "@/lib/crmQueries";

// Tool-use loop can take a few round trips to Claude (ask -> call a tool ->
// read the result -> maybe call another tool -> answer), so give this route
// more headroom than the Vercel default.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = "claude-sonnet-5";

const SYSTEM_PROMPT = `You are a data analyst embedded in the internal CRM for Scratch Pies, a small seasonal
pizza catering business. You answer the owner's ad hoc questions about their leads, sales, and revenue.

Rules:
- Always use the provided tools to look up real numbers. Never guess, estimate, or make up figures --
  if a tool doesn't cover what's being asked, say so plainly instead of fabricating an answer.
- Dates in tool results are calendar dates (YYYY-MM-DD), not timestamps -- treat them as plain dates.
- Dollar amounts are already in whole dollars (not cents). Format them with a "$" and commas.
- Keep answers concise and conversational -- a sentence or two, or a short list, not a formal report.
  This is a chat, not a memo.
- If a question spans multiple tools (e.g. "compare this year to last year"), call the tools you need
  and synthesize a direct comparison rather than dumping raw numbers from each call separately.
- The business is seasonal, so year-over-year and month-over-month comparisons are usually more useful
  than raw all-time totals unless the owner asks for an all-time figure specifically.`;

const tools: Anthropic.Tool[] = [
  {
    name: "get_overview_stats",
    description:
      "High-level CRM snapshot: total contacts, current/potential customer counts, open lead count, total leads ever logged, total sales ever booked, all-time revenue, and overall win rate.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "search_leads",
    description:
      "Search/list leads (Opportunities). Returns lead name, contact name, status, quoted value, requested event date, loss reason, and days since last contact attempt.",
    input_schema: {
      type: "object",
      properties: {
        statuses: {
          type: "array",
          items: { type: "string", enum: ["Open", "Negotiation", "Won", "Lost", "Abandoned"] },
          description: "Filter to these lead statuses. Omit to include every status.",
        },
        year: { type: "number", description: "Filter to leads whose requested event date falls in this year." },
        staleOnly: {
          type: "boolean",
          description: "Only leads never contacted, or not contacted in 30+ days.",
        },
        limit: { type: "number", description: "Max rows to return (default 50, max 200)." },
      },
    },
  },
  {
    name: "search_sales",
    description:
      "Search/list booked sales. Returns client name, event date, guest count, total cost, deposit paid, balance due, payment status, and location.",
    input_schema: {
      type: "object",
      properties: {
        year: { type: "number", description: "Filter to sales with an event date in this year." },
        upcomingOnly: { type: "boolean", description: "Only sales with an event date today or later." },
        unpaidOnly: { type: "boolean", description: "Only sales not yet marked paid in full." },
        limit: { type: "number", description: "Max rows to return (default 50, max 200)." },
      },
    },
  },
  {
    name: "get_revenue_stats",
    description:
      "Low/high/mean/median and totals for guest count and total sale value, optionally for one year. Omit year for all-time.",
    input_schema: {
      type: "object",
      properties: { year: { type: "number", description: "Limit to sales in this year. Omit for all-time." } },
    },
  },
  {
    name: "get_demand_by_day",
    description:
      "For a given month (1-12), returns the number of leads/sales requesting each day of that month, summed across every year on record -- useful for spotting which dates within a month are most requested.",
    input_schema: {
      type: "object",
      properties: { month: { type: "number", description: "Month number, 1 (January) through 12 (December)." } },
      required: ["month"],
    },
  },
  {
    name: "get_missed_opportunities",
    description:
      "Past dates where a lead wanted that date but no sale happened -- capacity that went idle. Optionally filtered to one year.",
    input_schema: {
      type: "object",
      properties: { year: { type: "number", description: "Limit to missed dates in this year. Omit for all-time." } },
    },
  },
  {
    name: "get_outstanding_balances",
    description: "Booked sales not yet paid in full, with the balance still owed and whether the event date has already passed.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_menu_popularity",
    description: "Tally of pizza flavors and additional items requested across every booked sale, most popular first.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_lost_leads",
    description:
      "Lost/Abandoned leads with a breakdown of loss reasons and total estimated value lost. Optionally filtered to one year.",
    input_schema: {
      type: "object",
      properties: {
        year: { type: "number", description: "Limit to leads with a requested event date in this year." },
        nonConflictOnly: {
          type: "boolean",
          description: "If true (default), excludes leads lost simply because we were already booked that date.",
        },
      },
    },
  },
];

async function callTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "get_overview_stats":
      return crm.getOverviewStats();
    case "search_leads":
      return crm.searchLeads(input as Parameters<typeof crm.searchLeads>[0]);
    case "search_sales":
      return crm.searchSales(input as Parameters<typeof crm.searchSales>[0]);
    case "get_revenue_stats":
      return crm.getRevenueStats(input as Parameters<typeof crm.getRevenueStats>[0]);
    case "get_demand_by_day":
      return crm.getDemandByDay(input as Parameters<typeof crm.getDemandByDay>[0]);
    case "get_missed_opportunities":
      return crm.getMissedOpportunities(input as Parameters<typeof crm.getMissedOpportunities>[0]);
    case "get_outstanding_balances":
      return crm.getOutstandingBalances();
    case "get_menu_popularity":
      return crm.getMenuPopularity();
    case "get_lost_leads":
      return crm.getLostLeads(input as Parameters<typeof crm.getLostLeads>[0]);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY isn't set. Add it in your environment variables and redeploy." },
      { status: 500 }
    );
  }

  const body = await req.json();
  const incomingMessages: Anthropic.MessageParam[] = body.messages || [];
  if (incomingMessages.length === 0) {
    return NextResponse.json({ error: "No messages provided." }, { status: 400 });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const messages: Anthropic.MessageParam[] = [...incomingMessages];

  // Agentic tool-use loop: Claude may need several rounds (call a tool, read
  // the result, call another) before it has enough to answer. Capped so a
  // confused loop can't run indefinitely.
  const MAX_STEPS = 6;
  let finalText = "Sorry, I wasn't able to finish answering that -- try a more specific question.";

  for (let step = 0; step < MAX_STEPS; step++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });

    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    if (toolUseBlocks.length === 0) {
      finalText = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      break;
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults = await Promise.all(
      toolUseBlocks.map(async (block) => {
        try {
          const result = await callTool(block.name, block.input as Record<string, unknown>);
          return {
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: JSON.stringify(result),
          };
        } catch (err) {
          return {
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: `Error running ${block.name}: ${err instanceof Error ? err.message : String(err)}`,
            is_error: true,
          };
        }
      })
    );

    messages.push({ role: "user", content: toolResults });
  }

  return NextResponse.json({ reply: finalText });
}
