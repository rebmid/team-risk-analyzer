const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod");
const analyzeRisk = require("../src/services/riskAnalyzer");

const server = new McpServer({
  name: "team-risk-analyzer",
  version: "1.0.0"
});

server.tool(
  "analyze_team_risk",
  "Analyzes team risk factors including PR age, blocked issues, meeting follow-ups, and contributor workload. Returns a risk score (0-100) with detailed breakdown.",
  {
    prAge: z.number().default(10).describe("PR age threshold in days"),
    overload: z.number().default(5).describe("Overload threshold for assigned items")
  },
  async ({ prAge, overload }) => {
    const report = await analyzeRisk({
      prAge,
      overload,
      format: "json",
      verbose: false
    });

    const driverLines = report.drivers
      .map(d => `• ${d.label}: +${d.points}`)
      .join("\n");

    const overloadedLines = report.overloaded.length
      ? report.overloaded.map(([user, count]) => `• @${user} (${count} items)`).join("\n")
      : "• None";

    const insightLines = report.insights?.length
      ? report.insights.map((insight, i) => `${i + 1}. ${insight}`).join("\n")
      : "No specific recommendations.";

    return {
      content: [
        {
          type: "text",
          text: `
🚨 Team Risk Analysis

Risk Score: ${report.score}/100

Old PRs (> threshold): ${report.oldPRCount}
Blocked Issues: ${report.blockedIssueCount}
Meetings w/o Action Items: ${report.meetingsWithoutActionsCount}
Meetings w/o Follow-up: ${report.meetingsWithoutFollowUpCount}
Average Meeting Gap: ${report.avgMeetingGapDays ?? "N/A"} days

Overloaded Contributors:
${overloadedLines}

Top Risk Drivers:
${driverLines}

💡 Recommendations:
${insightLines}
`
        }
      ]
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
