const chalk = require("chalk");

function renderRiskBar(score, riskLevel) {
  const totalBlocks = 20;
  const filled = Math.round((score / 100) * totalBlocks);
  const empty = totalBlocks - filled;

  const filledBar = "█".repeat(filled);
  const emptyBar = "░".repeat(empty);

  // Color the filled portion based on risk level (traffic light)
  let coloredFilled;
  if (riskLevel === "Critical") {
    coloredFilled = chalk.red.bold(filledBar);
  } else if (riskLevel === "High") {
    coloredFilled = chalk.keyword("orange")(filledBar);
  } else if (riskLevel === "Medium") {
    coloredFilled = chalk.yellow(filledBar);
  } else {
    coloredFilled = chalk.green(filledBar);
  }

  return `[${coloredFilled}${chalk.gray(emptyBar)}] ${score}%`;
}

function formatDrivers(drivers, format) {
  if (!drivers?.length) return format === "md" ? "_None_" : "None";

  if (format === "md") {
    return drivers.map((d) => `  - ${d.label} (+${d.points})`).join("\n");
  }

  return drivers.map((d) => `  • ${d.label} (+${d.points})`).join("\n");
}

function getRiskLevel(score) {
  if (score >= 80) return { label: "Critical", color: "red" };
  if (score >= 50) return { label: "High", color: "yellow" };
  if (score >= 25) return { label: "Medium", color: "cyan" };
  return { label: "Low", color: "green" };
}

function formatReport(report, format = "console") {
  if (format === "md") {
    const riskLevel = getRiskLevel(report.score);
    console.log(`# 🚨 Risk Report\n`);
    console.log(`**Risk score:** ${report.score}/100`);
    console.log(`**Risk level:** ${riskLevel.label}\n`);
    console.log(`- ${report.oldPRCount} PRs older than threshold`);
    console.log(`- ${report.blockedIssueCount} Issues marked blocked`);
    console.log(`- ${report.meetingsWithoutActionsCount} Meetings without action items`);
    console.log(`- ${report.meetingsWithoutFollowUpCount} Meetings without follow-up actions/PRs`);

    if (typeof report.avgMeetingGapDays === "number") {
      console.log(`- Avg meeting gap: ${report.avgMeetingGapDays.toFixed(1)} days`);
    }

    if (report.overloaded?.length) {
      report.overloaded.forEach(([user, count]) => {
        console.log(`- Contributor @${user} assigned ${count} items (capacity risk)`);
      });
    } else {
      console.log(`- No contributors flagged for overload`);
    }

    console.log(`\n## Top drivers\n`);
    console.log(formatDrivers(report.drivers, "md"));
    console.log("");
    return;
  }

  const riskLevel = getRiskLevel(report.score);
  
  // Status Banner
  const statusIcon = report.riskLevel === "Critical" ? "🔴" : 
                     report.riskLevel === "High" ? "🟠" : 
                     report.riskLevel === "Medium" ? "🟡" : "🟢";
  
  console.log("");
  console.log(chalk.bold("═".repeat(50)));
  console.log(chalk[riskLevel.color].bold(`${statusIcon} TEAM HEALTH STATUS: ${report.riskLevel.toUpperCase()} RISK`));
  console.log(chalk.gray(`   Risk Index: ${report.score}/100`));
  console.log(chalk.bold("═".repeat(50)));
  console.log("");
  
  // Risk Meter
  console.log(`Risk Meter: ${renderRiskBar(report.score, report.riskLevel)}`);
  console.log("");
  
  // Executive Summary
  if (report.executiveSummary) {
    console.log(chalk.bold.underline("Executive Summary"));
    console.log(chalk.italic(report.executiveSummary));
    console.log("");
  }

  // Key Metrics
  console.log(chalk.bold.underline("Key Metrics"));
  console.log(`- ${report.oldPRCount} PRs older than threshold`);
  console.log(`- ${report.blockedIssueCount} Issues marked blocked`);
  console.log(`- ${report.meetingsWithoutActionsCount} Meetings without action items`);
  console.log(`- ${report.meetingsWithoutFollowUpCount} Meetings without follow-up actions/PRs`);

  if (typeof report.avgMeetingGapDays === "number") {
    console.log(`- Avg meeting gap: ${report.avgMeetingGapDays.toFixed(1)} days`);
  }

  if (report.overloaded?.length) {
    report.overloaded.forEach(([user, count]) => {
      console.log(`- Contributor @${user} assigned ${count} items (capacity risk)`);
    });
  } else {
    console.log(`- No contributors flagged for overload`);
  }

  console.log(chalk.bold("\nTop Risk Drivers"));
  console.log(formatDrivers(report.drivers, "console"));
  
  // Recommended Actions
  if (report.recommendedActions?.length) {
    console.log(chalk.bold.underline("\nRecommended Actions"));
    report.recommendedActions.forEach((action, i) => {
      console.log(chalk.green(`  ${i + 1}. ${action}`));
    });
  }

  // What-If Scenarios
  if (report.whatIfScenarios?.length) {
    console.log(chalk.bold.underline("\n📊 Simulation Mode"));
    report.whatIfScenarios.forEach((scenario) => {
      const levelColor = scenario.projectedLevel === "Critical" ? "red" :
                         scenario.projectedLevel === "High" ? "yellow" :
                         scenario.projectedLevel === "Medium" ? "cyan" : "green";
      console.log(chalk.white(`  ${scenario.scenario}:`));
      console.log(chalk[levelColor](`    → Projected Score: ${scenario.projectedScore} (${scenario.projectedLevel})`));
      console.log(chalk.green(`    → Impact: ${scenario.impact} points`));
    });
  }

  // Historical Trend
  if (report.historicalTrend) {
    const trend = report.historicalTrend;
    const trendColor = trend.trend.includes("Increasing") ? "red" :
                       trend.trend.includes("Decreasing") ? "green" : "yellow";
    console.log(chalk.bold.underline("\n📈 Risk Trend (Last 3 Weeks)"));
    console.log(`  Week -2: ${trend.weekMinus2}`);
    console.log(`  Week -1: ${trend.weekMinus1}`);
    console.log(`  Current: ${trend.current}`);
    console.log(chalk[trendColor].bold(`  Trend:   ${trend.trend}`));
  }

  // Strategic Insight
  if (report.strategicInsight) {
    console.log("");
    console.log(chalk.bold.cyan(`🎯 Operational Signal: `) + chalk.white(report.strategicInsight));
  }
  
  console.log("");
  console.log(chalk.gray("─".repeat(50)));
  console.log(chalk.gray(`Report generated: ${new Date().toLocaleString()}`));
  console.log("");
}

module.exports = formatReport;

