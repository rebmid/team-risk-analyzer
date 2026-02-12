const { Command } = require("commander");
const analyzeRisk = require("./services/riskAnalyzer");

const program = new Command();

program
  .name("team-risk-analyzer")
  .description("A CLI tool for team risk analysis")
  .version("1.0.0");

program
  .command("analyze")
  .description("Analyze team risk factors")
  .option("--pr-age <days>", "PR age threshold in days", "10")
  .option("--overload <count>", "Overload threshold for assigned items", "5")
  .option("--format <type>", "Output format: console|md", "console")
  .action(async (options) => {
    await analyzeRisk({
      prAge: Number(options.prAge),
      overload: Number(options.overload),
      format: options.format
    });
  });

program.parse(process.argv);
