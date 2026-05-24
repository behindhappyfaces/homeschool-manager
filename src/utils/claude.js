const Anthropic = require('@anthropic-ai/sdk');

let client = null;

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

async function suggestLessons(student, subject, masteryScore) {
  const ai = getClient();
  if (!ai) return { available: false, message: 'AI features require ANTHROPIC_API_KEY in .env' };

  const grade = student.currentGrade;
  const reviewGrade = student.reviewGrade;

  const response = await ai.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 800,
    system: 'You are a homeschool curriculum assistant helping a family on a working farm. Give practical, engaging lesson suggestions. Be concise and actionable.',
    messages: [{
      role: 'user',
      content: `Student is in grade ${grade} reviewing grade ${reviewGrade === 0 ? 'Kindergarten' : reviewGrade} material.
Subject: ${subject}
Current mastery score: ${masteryScore}%

Suggest 3 specific lesson activities to improve mastery. Keep suggestions short and practical for a farm-based homeschool environment.`
    }]
  });

  return { available: true, suggestions: response.content[0].text };
}

async function generateAssessmentFeedback(studentName, grade, results) {
  const ai = getClient();
  if (!ai) return { available: false, message: 'AI features require ANTHROPIC_API_KEY in .env' };

  const summary = results.sections.map(s =>
    `${s.subject}: ${s.score}% (${s.correct}/${s.total} correct)`
  ).join(', ');

  const response = await ai.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    system: 'You are a supportive homeschool assessment advisor. Give encouraging, actionable feedback. Keep it concise.',
    messages: [{
      role: 'user',
      content: `Assessment results for ${studentName} (Grade ${grade}):
${summary}

Provide:
1. A brief encouraging summary (2 sentences)
2. Top 2 priority areas to focus on
3. One celebration/strength to highlight`
    }]
  });

  return { available: true, feedback: response.content[0].text };
}

async function generateDailyPlan(students) {
  const ai = getClient();
  if (!ai) return { available: false, message: 'AI features require ANTHROPIC_API_KEY in .env' };

  const studentSummaries = students.map(s => {
    const lowSubjects = Object.entries(s.subjects)
      .filter(([, d]) => d.mastery < 70)
      .map(([name]) => name)
      .join(', ');
    return `${s.name} (Grade ${s.currentGrade}): needs work on ${lowSubjects || 'all subjects at good level'}`;
  }).join('\n');

  const response = await ai.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    system: 'You are a homeschool daily planner for a farm family. Keep suggestions practical and farm-integrated where possible.',
    messages: [{
      role: 'user',
      content: `Create a simple daily school plan for today for these students:\n${studentSummaries}\n\nKeep it to a morning schedule, max 4 hours total.`
    }]
  });

  return { available: true, plan: response.content[0].text };
}

module.exports = { suggestLessons, generateAssessmentFeedback, generateDailyPlan };
