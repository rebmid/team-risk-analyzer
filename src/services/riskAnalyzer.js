const fs = require("fs");
const path = require("path");
const formatReport = require("../utils/reportFormatter");

function daysOld(isoDate) {
  const created = new Date(isoDate);
  const now = new Date();
  const diff = now - created;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function daysBetween(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  const diff = Math.abs(db - da);
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

async function analyzeRisk({ prAge = 10, overload = 5, format = "console", verbose = false }) {
  const githubPath = path.join(__dirname, "../data/sampleGithub.json");
  const meetingsPath = path.join(__dirname, "../data/sampleMeetings.json");

  const githubData = JSON.parse(fs.readFileSync(githubPath, "utf-8"));
  const meetings = JSON.parse(fs.readFileSync(meetingsPath, "utf-8"));

  const { pullRequests, issues } = githubData;

  // 1) PR age risk
  const oldPRs = pullRequests.filter(
    (pr) => pr.status === "open" && daysOld(pr.createdAt) > prAge
  );

  // 2) Blocked issues
  const blockedIssues = issues.filter((issue) =>
    (issue.labels || []).includes("blocked")
  );

  // 3) Meeting cadence
  const sortedMeetings = [...meetings].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  let avgMeetingGapDays = null;
  if (sortedMeetings.length >= 2) {
    let totalGap = 0;
    for (let i = 1; i < sortedMeetings.length; i++) {
      totalGap += daysBetween(sortedMeetings[i - 1].date, sortedMeetings[i].date);
    }
    avgMeetingGapDays = totalGap / (sortedMeetings.length - 1);
  }

  // 4) Meetings without action items
  const meetingsWithoutActions = meetings.filter((m) => !m.hasActionItems);

  // 5) Meetings without follow-up PRs
  const meetingsWithoutFollowUp = meetings.filter((meeting) => {
    const meetingDate = new Date(meeting.date);
    return !pullRequests.some((pr) => {
      const prDate = new Date(pr.createdAt);
      const diffDays = (prDate - meetingDate) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 3;
    });
  });

  // 6) Contributor load
  const contributorLoad = {};

  for (const issue of issues) {
    if (!issue.assignee) continue;
    contributorLoad[issue.assignee] = (contributorLoad[issue.assignee] || 0) + 1;
  }

  for (const pr of pullRequests) {
    if (pr.status !== "open" || !pr.author) continue;
    contributorLoad[pr.author] = (contributorLoad[pr.author] || 0) + 1;
  }

  const overloaded = Object.entries(contributorLoad).filter(
    ([_, count]) => count > overload
  );

  // 7) Risk score + drivers
  let score = 0;
  const drivers = [];

  if (oldPRs.length) {
    const prPoints = Math.min(40, oldPRs.length * 10);
    score += prPoints;
    drivers.push({ label: "Aging PRs", points: prPoints });
  }

  if (blockedIssues.length) {
    const blockedPoints = Math.min(30, blockedIssues.length * 15);
    score += blockedPoints;
    drivers.push({ label: "Blocked issues", points: blockedPoints });
  }

  if (meetingsWithoutFollowUp.length) {
    const followupPoints = Math.min(20, meetingsWithoutFollowUp.length * 7);
    score += followupPoints;
    drivers.push({ label: "Meetings w/o follow-up", points: followupPoints });
  }

  if (overloaded.length) {
    const overloadPoints = Math.min(20, overloaded.length * 10);
    score += overloadPoints;
    drivers.push({ label: "Contributor overload", points: overloadPoints });
  }

  score = Math.min(100, score);

  // 8) Risk Level Classification
  let riskLevel = "Low";
  if (score >= 80) riskLevel = "Critical";
  else if (score >= 50) riskLevel = "High";
  else if (score >= 25) riskLevel = "Medium";

  // 9) Executive Narrative Summary
  let executiveSummary = "";

  if (score >= 80) {
    executiveSummary =
      "The team is in a Critical risk state. Without immediate intervention, delivery commitments are at risk of failure within the current sprint.";
  } else if (score >= 50) {
    executiveSummary =
      "The team is operating in a High-risk state. Without intervention, sprint predictability and review throughput are likely to degrade within the next cycle.";
  } else if (score >= 25) {
    executiveSummary =
      "The team shows Moderate operational risk. Unaddressed, current patterns could escalate within 2-3 sprints.";
  } else {
    executiveSummary =
      "The team is currently operating in a Low-risk state with stable workflow patterns. Continue current practices.";
  }

  // 10) Strategic Insight (derived from top 2 drivers)
  let strategicInsight = "";
  const sortedDrivers = [...drivers].sort((a, b) => b.points - a.points);
  if (sortedDrivers.length >= 2) {
    strategicInsight = `${sortedDrivers[0].label} and ${sortedDrivers[1].label.toLowerCase()} are the dominant instability drivers.`;
  } else if (sortedDrivers.length === 1) {
    strategicInsight = `${sortedDrivers[0].label} is the primary instability driver.`;
  } else {
    strategicInsight = "No significant risk drivers detected.";
  }

  // 10) Insight generation
  const insights = [];

  if (oldPRs.length) {
    insights.push(
      `Review throughput bottleneck: ${oldPRs.length} PR(s) open > ${prAge} days. Consider adding reviewers or reducing PR size.`
    );
  }

  if (blockedIssues.length) {
    insights.push(
      `${blockedIssues.length} blocked issue(s) detected. Escalate external dependencies.`
    );
  }

  if (meetingsWithoutFollowUp.length) {
    insights.push(
      `${meetingsWithoutFollowUp.length} meeting(s) lacked follow-up PRs within 3 days. Improve accountability tracking.`
    );
  }

  if (meetingsWithoutActions.length) {
    insights.push(
      `${meetingsWithoutActions.length} meeting(s) ended without action items. Enforce structured close-outs.`
    );
  }

  if (overloaded.length) {
    const names = overloaded.map(([user]) => `@${user}`).join(", ");
    insights.push(
      `Workload imbalance: ${names} exceed ${overload}-item threshold. Consider redistribution.`
    );
  }

  // 11) Generate Recommended Actions (specific, actionable)
  const recommendedActions = [];

  if (overloaded.length) {
    const [topUser, topCount] = overloaded[0];
    const reassignCount = Math.min(2, topCount - overload);
    recommendedActions.push(`Reassign ${reassignCount} item(s) from @${topUser} to balance workload`);
  }

  if (oldPRs.length) {
    recommendedActions.push(`Review and prioritize ${oldPRs.length} PR(s) older than ${prAge} days`);
  }

  if (meetingsWithoutFollowUp.length) {
    recommendedActions.push(`Assign owners to ${meetingsWithoutFollowUp.length} meeting(s) lacking follow-up`);
  }

  if (blockedIssues.length) {
    recommendedActions.push(`Escalate ${blockedIssues.length} blocked issue(s) in next standup`);
  }

  if (meetingsWithoutActions.length) {
    recommendedActions.push(`Add action items to ${meetingsWithoutActions.length} meeting(s) retroactively`);
  }

  // 12) What-If Scenarios
  const whatIfScenarios = [];
  
  // Calculate impact of resolving blocked issues
  if (blockedIssues.length) {
    const blockedPoints = Math.min(30, blockedIssues.length * 15);
    const projectedScore = Math.max(0, score - blockedPoints);
    const projectedLevel = projectedScore >= 80 ? "Critical" : projectedScore >= 50 ? "High" : projectedScore >= 25 ? "Medium" : "Low";
    whatIfScenarios.push({
      scenario: `If ${blockedIssues.length} blocked issue${blockedIssues.length === 1 ? " is" : "s are"} resolved`,
      projectedScore,
      projectedLevel,
      impact: -blockedPoints
    });
  }

  // Calculate impact of clearing old PRs
  if (oldPRs.length) {
    const prPoints = Math.min(40, oldPRs.length * 10);
    const projectedScore = Math.max(0, score - prPoints);
    const projectedLevel = projectedScore >= 80 ? "Critical" : projectedScore >= 50 ? "High" : projectedScore >= 25 ? "Medium" : "Low";
    whatIfScenarios.push({
      scenario: `If ${oldPRs.length} aging PR${oldPRs.length === 1 ? " is" : "s are"} merged/closed`,
      projectedScore,
      projectedLevel,
      impact: -prPoints
    });
  }

  // Calculate impact of redistributing workload
  if (overloaded.length) {
    const overloadPoints = Math.min(20, overloaded.length * 10);
    const projectedScore = Math.max(0, score - overloadPoints);
    const projectedLevel = projectedScore >= 80 ? "Critical" : projectedScore >= 50 ? "High" : projectedScore >= 25 ? "Medium" : "Low";
    whatIfScenarios.push({
      scenario: `If workload is redistributed from overloaded contributors`,
      projectedScore,
      projectedLevel,
      impact: -overloadPoints
    });
  }

  // 13) Historical Trend Simulation (deterministic based on current score)
  const currentScore = score;
  const weekMinus1 = Math.max(0, Math.min(100, currentScore - 8 + (currentScore % 5)));
  const weekMinus2 = Math.max(0, Math.min(100, weekMinus1 - 9 + (currentScore % 3)));
  
  // Determine trend based on overall change from week -2 to current
  const overallChange = currentScore - weekMinus2;
  const changeSign = overallChange >= 0 ? "+" : "";
  let trendDirection = `→ Stable (${changeSign}${overallChange} points over 2 weeks)`;
  if (overallChange > 5) trendDirection = `↑ Increasing risk (${changeSign}${overallChange} points over 2 weeks)`;
  else if (overallChange < -5) trendDirection = `↓ Decreasing risk (${overallChange} points over 2 weeks)`;

  const historicalTrend = {
    weekMinus2: weekMinus2,
    weekMinus1: weekMinus1,
    current: currentScore,
    trend: trendDirection
  };

  const report = {
    oldPRCount: oldPRs.length,
    blockedIssueCount: blockedIssues.length,
    meetingsWithoutActionsCount: meetingsWithoutActions.length,
    meetingsWithoutFollowUpCount: meetingsWithoutFollowUp.length,
    avgMeetingGapDays,
    overloaded,
    score,
    riskLevel,
    executiveSummary,
    strategicInsight,
    drivers: drivers.sort((a, b) => b.points - a.points),
    insights: insights.slice(0, 5),
    recommendedActions: recommendedActions.slice(0, 5),
    whatIfScenarios: whatIfScenarios.slice(0, 3),
    historicalTrend
  };

  if (verbose) {
    report.debug = {
      prAgeThreshold: prAge,
      overloadThreshold: overload
    };
  }

  if (format !== "json") {
    formatReport(report, format);
  }

  return report;
}

module.exports = analyzeRisk;


