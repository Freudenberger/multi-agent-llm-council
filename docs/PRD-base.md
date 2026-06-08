# PRD: Multi-Agent LLM Council

## 1. Project Name

**Multi-Agent LLM Council**

This is a working name for a project focused on multi-perspective analysis using several LLM-based agents.

## 2. Project Goal

The goal of this project is to create an application that allows users to analyze questions, problems, ideas, and decisions using multiple specialized LLM agents.

Each agent represents a different perspective, such as an optimistic perspective, critical perspective, technical perspective, business perspective, risk-oriented perspective, or end-user perspective.

The system collects the agents' responses, compares their viewpoints, identifies areas of agreement and disagreement, and then generates a final synthesized answer.

The project demonstrates that instead of relying on a single response from one language model, users can benefit from a structured, multi-perspective analysis process.

## 3. Problem Statement

A single LLM response may be:

- too one-sided,
- overconfident,
- incomplete,
- logically convincing but incorrect,
- missing important risks,
- not adapted to different user perspectives,
- lacking alternatives or counterarguments.

In many situations, users do not only need a direct answer. They need to understand different points of view before making a decision, evaluating an idea, or improving a solution.

This applies to areas such as:

- business decisions,
- product ideas,
- technical problem-solving,
- learning and education,
- critical analysis of arguments,
- project planning,
- content review,
- strategic thinking.

## 4. Proposed Solution

The project proposes a web application where the user enters a question, problem, idea, or text for analysis.

The user then selects an analysis mode, such as decision analysis, idea evaluation, critical review, learning support, or technical analysis.

Based on the selected mode, the system runs a group of LLM agents. Each agent analyzes the input from a specific perspective. After collecting the agents' responses, a final synthesizer agent creates a structured summary.

Basic flow:

```text
User input
  ↓
Analysis mode selection
  ↓
Multiple LLM agents are executed
  ↓
Independent responses are collected
  ↓
Opinions are compared
  ↓
Final synthesis is generated
  ↓
Result is presented to the user
```

## 5. Target Users

The application can be used by people who want to analyze a topic from several perspectives before making a decision or preparing an answer.

Potential users include:

- students,
- project creators,
- product builders,
- software developers,
- technical teams,
- people learning new topics,
- people validating business ideas,
- people looking for critical feedback,
- people preparing written arguments or project proposals.

## 6. Main Use Cases

### 6.1. Decision Analysis

The user describes a decision they want to make. The system analyzes it from several perspectives, such as benefits, risks, costs, feasibility, and long-term consequences.

Example:

```text
Should we create a mobile app as an extension of our existing web platform?
```

### 6.2. Idea Evaluation

The user describes an idea for a project, product, or initiative. The agents evaluate its potential, risks, implementation difficulty, and possible improvements.

Example:

```text
Evaluate an idea for an AI-powered learning planning application.
```

### 6.3. Critical Review of Text or Argument

The user provides a text, argument, project description, or proposal. The system evaluates clarity, logic, persuasiveness, strengths, weaknesses, and missing elements.

Example:

```text
Review this project description and check whether it is clear and convincing.
```

### 6.4. Technical Analysis

The user describes a technical problem, architecture, or solution. The system evaluates it from the perspective of architecture, security, performance, maintainability, and risk.

Example:

```text
Is this application architecture suitable for a small development team?
```

### 6.5. Learning Support

The user asks an educational question. The agents may act as a teacher, beginner, examiner, and example generator to create a more complete explanation.

Example:

```text
Explain what microservices are and when they should be used.
```

## 7. Council Modes

### 7.1. Decision Council

A mode designed to support decision-making.

Example agents:

- Optimist
- Sceptic
- Risk Analyst
- Pragmatist
- Final Judge

### 7.2. Idea Council

A mode designed to evaluate ideas.

Example agents:

- Creative Thinker
- Market Analyst
- Technical Feasibility Reviewer
- User Perspective
- Final Synthesizer

### 7.3. Critical Review Council

A mode designed to evaluate texts, plans, arguments, and proposals.

Example agents:

- Logic Reviewer
- Clarity Reviewer
- Evidence Reviewer
- Sceptic
- Final Editor

### 7.4. Learning Council

A mode designed for learning and explaining concepts.

Example agents:

- Teacher
- Beginner
- Examiner
- Example Generator
- Final Explainer

### 7.5. Technical Council

A mode designed for technical topics and engineering-related decisions.

Example agents:

- Software Architect
- Security Reviewer
- Performance Reviewer
- Maintainability Reviewer
- Final Recommender

## 8. MVP Scope

The MVP should focus on the core mechanism of the system without adding unnecessary advanced features.

### In Scope for MVP

The MVP should include:

- a text input field for the user's question or problem,
- selection of one of several council modes,
- execution of multiple LLM agents,
- display of each agent's individual response,
- generation of a final synthesized answer,
- identification of agreements between agents,
- identification of disagreements between agents,
- final recommendation or summary,
- simple confidence score,
- ability to copy the final result.

### Out of Scope for MVP

The following features should not be included in the MVP:

- user authentication,
- payments,
- multiple workspaces,
- training a custom AI model,
- advanced permission system,
- external integrations,
- advanced document analysis,
- automatic web search,
- mobile application,
- complex analytics dashboard.

## 9. Functional Requirements

### FR-01: User Input

The user should be able to enter a question, problem, idea, or text into a text area.

### FR-02: Analysis Mode Selection

The user should be able to select one of the available analysis modes, such as Decision Council, Idea Council, Critical Review Council, Learning Council, or Technical Council.

### FR-03: Agent Execution

After the user starts the analysis, the system should execute the agents assigned to the selected mode.

### FR-04: Individual Agent Responses

The system should display each agent's response separately, including the agent's name and role.

### FR-05: Final Synthesis

The system should generate a final answer that summarizes the most important conclusions from all agent responses.

### FR-06: Agreement Detection

The system should identify and display areas where the agents agree.

### FR-07: Disagreement Detection

The system should identify and display areas where the agents disagree or present different viewpoints.

### FR-08: Final Recommendation

The system should provide a final recommendation, conclusion, or summary depending on the selected mode.

### FR-09: Confidence Score

The system should show an estimated confidence score, for example on a scale from 1 to 5.

### FR-10: Copy Result

The user should be able to copy the final report.

## 10. Non-Functional Requirements

### NFR-01: Clear User Interface

The interface should be simple and easy to understand. The user should clearly see what each agent does and how the final answer is created.

### NFR-02: Response Time Feedback

The system should inform the user that the analysis is in progress, because running several LLM agents may take longer than generating a single model response.

### NFR-03: Error Handling

If one of the agents fails to return a response, the system should still generate a result based on the remaining agents and inform the user about the issue.

### NFR-04: Modularity

Agent definitions, council modes, and prompts should be separated from the main application logic. This will make it easier to add new modes in the future.

### NFR-05: Transparency

The system should show individual agent responses instead of displaying only the final synthesis. This helps the user understand how the final result was created.

## 11. Suggested Final Report Format

The final report should include:

```text
1. Short summary
2. Key conclusions
3. Areas of agreement between agents
4. Areas of disagreement between agents
5. Risks or limitations
6. Recommended next steps
7. Confidence score
```

## 12. Proposed System Architecture

```text
Frontend
  ↓
Backend API
  ↓
Council Orchestrator
  ↓
LLM Provider
  ↓
Agent Responses
  ↓
Final Synthesizer
  ↓
Result UI
```

### Main Components

#### Frontend

Responsible for:

- user input form,
- council mode selection,
- displaying agent responses,
- displaying the final report.

#### Backend API

Responsible for:

- receiving the user's request,
- calling the council orchestrator,
- returning results to the frontend.

#### Council Orchestrator

Responsible for:

- selecting agents based on the chosen mode,
- preparing prompts,
- running agents in parallel,
- collecting responses,
- passing responses to the final synthesizer.

#### LLM Provider

Responsible for communication with an LLM API or external model provider.

#### Final Synthesizer

Responsible for creating the final report based on all agent responses.

## 13. Example Data Model

```ts
type CouncilMode = {
  id: string;
  name: string;
  description: string;
  agents: CouncilAgent[];
};

type CouncilAgent = {
  id: string;
  name: string;
  role: string;
  systemPrompt: string;
};

type CouncilRun = {
  id: string;
  modeId: string;
  userInput: string;
  agentResponses: AgentResponse[];
  finalReport: FinalReport;
  createdAt: string;
};

type AgentResponse = {
  agentId: string;
  content: string;
  confidence: number;
};

type FinalReport = {
  summary: string;
  agreements: string[];
  disagreements: string[];
  risks: string[];
  recommendations: string[];
  confidence: number;
};
```

## 14. Example User Scenario

1. The user opens the application.
2. The user enters the following problem:

```text
Should we create a mobile app for an existing web platform?
```

3. The user selects the `Decision Council` mode.
4. The user clicks `Run Council`.
5. The system runs the following agents:
   - Optimist,
   - Sceptic,
   - Risk Analyst,
   - Pragmatist.
6. Each agent generates an independent response.
7. The system displays the individual responses.
8. The Final Synthesizer creates the final report.
9. The user receives a recommendation, risks, disagreements, and confidence score.
10. The user copies the result or saves it locally.

## 15. Success Criteria

The project can be considered successful if:

- the user can enter a problem and receive a multi-agent analysis,
- each agent provides a clearly different perspective,
- the system generates a final synthesized answer,
- the result shows agreements and disagreements,
- the application is understandable for the user,
- the project can be demonstrated using several example prompts,
- the code is modular and allows adding new council modes.

## 16. Project Risks

### Risk 1: Scope Too Broad

The project may become too general and difficult to finish.

**Mitigation:** The MVP should support a limited number of predefined modes instead of trying to support every possible use case.

### Risk 2: High LLM API Costs

Running several agents requires several model calls.

**Mitigation:** For the project version, one model can be used with different role prompts, and the number of agents can be limited.

### Risk 3: Long Response Time

Multiple LLM calls may increase waiting time.

**Mitigation:** Agent calls should be executed in parallel whenever possible.

### Risk 4: False Sense of Reliability

The system may appear more reliable only because several agents were used.

**Mitigation:** The application should clearly communicate that the council does not guarantee correctness. It supports analysis by showing multiple perspectives.

### Risk 5: Similar Agent Responses

Different agents may still produce similar responses.

**Mitigation:** Agent prompts should clearly differentiate their tasks, evaluation criteria, and analysis style.

## 17. System Limitations

The system should not be treated as a source of truth. Its purpose is to support thinking, show different perspectives, and organize arguments.

Limitations:

- responses may contain errors,
- agents may repeat the same assumptions,
- output quality depends on prompt quality,
- the system does not replace human expert judgment,
- lack of access to current data may limit answer quality,
- consensus does not automatically mean correctness.

## 18. Suggested Technology Stack

Example stack:

- Frontend: React or Next.js
- Backend: Node.js / TypeScript
- LLM API: OpenAI API, OpenRouter, or another provider
- Data validation: Zod
- Database for history: SQLite or PostgreSQL
- Styling: Tailwind CSS
- Export format: Markdown

## 19. Roadmap

### Version 0.1

- user input form,
- one analysis mode,
- three agents,
- final synthesis,
- Markdown result.

### Version 0.2

- several council modes,
- separate agent responses,
- agreements and disagreements,
- confidence score.

### Version 0.3

- analysis history,
- copy result button,
- improved report view,
- basic error handling.

### Version 0.4

- custom agent configuration,
- report export,
- saved council mode settings.

### Version 0.5

- result comparison,
- usage statistics,
- ability to choose different LLM models.

## 20. Summary

Multi-Agent LLM Council is an application that demonstrates a practical use of multi-agent systems based on large language models.

The project is not intended to replace human decision-making. Instead, it helps users analyze problems from multiple perspectives, organize arguments, identify risks, and generate structured recommendations.

This project is suitable as an academic or course assignment because it combines a current AI-related topic with practical application architecture, LLM integration, data flow design, prompt design, and user interface design.
