exports.handler = async function (event, context) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const body = JSON.parse(event.body);
    const { cv, job, name, exp, jtype } = body;

    if (!cv || !job) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "CV and job description are required" }),
      };
    }

    const needsMath = jtype === "finance" || jtype === "tech";

    const mathInstruction = needsMath
      ? `"math_questions":[{"question":"<relevant math question for this job>","answer":"<answer>"},{"question":"<q2>","answer":"<a2>"},{"question":"<q3>","answer":"<a3>"},{"question":"<q4>","answer":"<a4>"},{"question":"<q5>","answer":"<a5>"}]`
      : `"math_questions":[]`;

    const prompt = `You are Jobiqa, a professional career advisor for Nepali job seekers.

Candidate Name: ${name || "Job Seeker"}
Experience Level: ${exp || "fresher"}
Job Type: ${jtype || "other"}

CV:
${cv}

Job Description:
${job}

Analyze the CV against the job description carefully and return ONLY valid JSON.
No markdown, no code blocks, no extra text before or after the JSON:

{"score":<integer 0-100 be realistic>,"verdict":"<Strong Match|Good Match|Partial Match|Weak Match|Poor Match>","summary":"<2 honest sentences personalized to the candidate>","missing_skills":["<skill1>","<skill2>","<skill3>","<skill4>"],"tips":[{"title":"<short specific title>","description":"<2 actionable sentences specific to this CV and job>"},{"title":"<title>","description":"<2 sentences>"},{"title":"<title>","description":"<2 sentences>"}],"interview_questions":["<question 1 specific to this exact job and CV>","<question 2>","<question 3>","<question 4>","<question 5>","<question 6>"],${mathInstruction},"roadmap":[{"week":"Wk 1-2","task":"<specific actionable task to improve candidacy>"},{"week":"Wk 3-4","task":"<specific task>"},{"week":"Wk 5-6","task":"<specific task>"},{"week":"Wk 7-8","task":"<specific task>"},{"week":"Wk 9-10","task":"<specific task>"}]}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (response.status === 429 || response.status === 529) {
      return {
        statusCode: 429,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "RATE_LIMIT" }),
      };
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Claude API error:", response.status, errorText);
      return {
        statusCode: 502,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "API_ERROR", status: response.status }),
      };
    }

    const data = await response.json();

    if (!data.content || !data.content[0] || !data.content[0].text) {
      return {
        statusCode: 502,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "EMPTY_RESPONSE" }),
      };
    }

    let raw = data.content[0].text
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/gi, "")
      .trim();

    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");

    if (start === -1 || end === -1) {
      return {
        statusCode: 502,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "NO_JSON" }),
      };
    }

    const result = JSON.parse(raw.substring(start, end + 1));

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: JSON.stringify({ success: true, data: result }),
    };

  } catch (err) {
    console.error("Function error:", err);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "SERVER_ERROR", message: err.message }),
    };
  }
};
