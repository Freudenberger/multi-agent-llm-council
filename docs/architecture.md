# PRD Addendum: Architecture, CLI, and Deployment

## 1. Purpose of This Addendum

This addendum extends the initial PRD with additional architectural decisions related to application structure, command-line usage, and deployment.

The project should remain simple to run and deploy, while still keeping the core logic independent from the user interface. The application should not be split into separate frontend and backend services. Instead, it should be implemented as a single modular application with a shared core module.

## 2. Architecture Decision

The project will be implemented as a **modular monolith**.

This means that the application will be delivered as a single deployable application, but its internal code will be divided into clear modules with separate responsibilities.

The project will not include:

- a separate frontend service,
- a separate backend service,
- a public SDK in the MVP.

Instead, the application will include:

- a web interface,
- internal API routes,
- a shared Council Core module,
- a command-line interface using the same core logic.

## 3. High-Level Architecture

```text
Web UI
  ↓
Internal API Route
  ↓
Council Core
  ↓
LLM Provider
```

The CLI will use the same Council Core directly:

```text
CLI
  ↓
Council Core
  ↓
LLM Provider
```

This approach ensures that the business logic is implemented only once and reused by both the web application and the command-line interface.

## 4. Main Architectural Principle

The most important architectural rule is:

```text
The Council Core must not depend on the Web UI.
```

The web interface should only be a presentation layer. It should not contain agent orchestration logic, prompt-building logic, provider selection logic, or final synthesis logic.

The API route should also remain thin. It should only validate the request, call the Council Core, and return the result.

## 5. Council Core

The **Council Core** is the central module of the application.

It is responsible for:

- selecting the council mode,
- selecting agents for the selected mode,
- building prompts for agents,
- running agents,
- collecting responses,
- handling partial failures,
- generating the final synthesis,
- returning a structured result.

Example conceptual usage:

```ts
const result = await runCouncil({
  input: "Should I create a mobile app for my web platform?",
  mode: "decision",
});
```

The same function should be used by:

- the web application through an internal API route,
- the CLI directly from the command line.

## 6. Web Application

The web application should be implemented as part of the same project.

Its responsibilities are:

- displaying the input form,
- allowing the user to select a council mode,
- sending the request to the internal API route,
- displaying individual agent responses,
- displaying the final synthesized report,
- displaying loading and error states.

The web application should not contain the core council logic.

## 7. Internal API Route

The application should expose an internal API route, for example:

```text
POST /api/council
```

The API route should be responsible for:

- receiving the user input,
- validating the request,
- calling the Council Core,
- returning the result as JSON.

Example conceptual implementation:

```ts
import { NextResponse } from "next/server";
import { runCouncil } from "@/src/core/runCouncil";

export async function POST(request: Request) {
  const body = await request.json();

  const result = await runCouncil({
    input: body.input,
    mode: body.mode,
  });

  return NextResponse.json(result);
}
```

## 8. Command-Line Interface

The project will include a CLI as the main non-UI way of interacting with the application.

The CLI will use the same Council Core as the web application. It will not call the UI and will not duplicate council logic.

Initial example usage:

```bash
npm run council -- "Should I create a mobile app for my web platform?"
```

Extended example usage:

```bash
npm run council -- --mode decision "Should I create a mobile app?"
npm run council -- --mode technical "Is this architecture suitable for a small team?"
npm run council -- --mode idea "Evaluate an AI learning assistant idea"
```

The CLI should support at least:

- running a council analysis from text input,
- selecting a council mode,
- printing the final report in the terminal.

Optional future CLI features:

- reading input from a file,
- outputting JSON,
- outputting Markdown,
- saving results to a file,
- listing available council modes.

## 9. No SDK in the MVP

The MVP will not include a public SDK.

The reason for this decision is to keep the project scope focused and realistic. A public SDK would require additional API design, documentation, versioning, and maintenance.

Instead, the CLI will serve as the main alternative interface to the web application.

This keeps the project simpler while still proving that the core logic is reusable and independent from the UI.

## 10. Suggested Project Structure

```text
multi-agent-llm-council/
  app/
    page.tsx
    api/
      council/
        route.ts

  src/
    core/
      runCouncil.ts
      createCouncil.ts
      types.ts
      errors.ts

    modes/
      decision.ts
      idea.ts
      criticalReview.ts
      learning.ts
      technical.ts

    agents/
      types.ts
      defaultAgents.ts

    prompts/
      buildAgentPrompt.ts
      buildSynthesisPrompt.ts

    providers/
      types.ts
      openAiProvider.ts
      openRouterProvider.ts
      mockProvider.ts

    cli/
      index.ts
      formatters.ts

  tests/
    core/
      runCouncil.test.ts

  package.json
  README.md
  PRD.md
  render.yaml
```

## 11. Suggested Package Scripts

The project should include scripts for local development, production build, production start, CLI usage, and tests.

Example `package.json` scripts:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "council": "tsx src/cli/index.ts",
    "test": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
```

Expected usage:

```bash
npm run dev
```

Runs the full web application locally.

```bash
npm run build
npm run start
```

Builds and runs the application in production mode.

```bash
npm run council -- "Analyze this idea"
```

Runs the CLI using the shared Council Core.

## 12. Mock Provider

The project should include a **Mock Provider**.

The Mock Provider is an implementation of the LLM provider interface that returns predefined or simulated responses instead of calling a real external LLM API.

This is important because it allows the project to be:

- tested without external API keys,
- demonstrated without internet access to an LLM provider,
- run without generating API costs,
- deployed in demo mode,
- easier to evaluate by a teacher or reviewer.

Provider selection can be controlled by an environment variable:

```env
LLM_PROVIDER=mock
```

For real LLM usage:

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=your_api_key_here
```

or:

```env
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=your_api_key_here
```

## 13. LLM Provider Abstraction

The application should use a provider abstraction so that different model providers can be used without changing the Council Core.

Example conceptual interface:

```ts
type LLMProvider = {
  generate(input: GenerateInput): Promise<GenerateOutput>;
};
```

Possible implementations:

- `MockProvider`
- `OpenAIProvider`
- `OpenRouterProvider`

The Council Core should depend on the provider interface, not on a specific provider implementation.

## 14. Deployment Requirements

The application should be easy to deploy to an external hosting platform such as Render.

The recommended deployment target is a **Render Web Service**, because the application includes API routes and requires a running Node.js process.

The application should not require a separate backend deployment.

Recommended Render configuration:

```text
Build Command: npm install && npm run build
Start Command: npm start
Runtime: Node.js
```

## 15. Example render.yaml

The repository may include a `render.yaml` file to simplify deployment.

Example:

```yaml
services:
  - type: web
    name: multi-agent-llm-council
    runtime: node
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: LLM_PROVIDER
        value: mock
      - key: OPENAI_API_KEY
        sync: false
```

The API key should never be committed to the repository. It should be configured through environment variables in the hosting platform.

## 16. Deployment Modes

The application should support two deployment modes.

### 16.1. Demo Mode

Demo mode uses the Mock Provider.

```env
LLM_PROVIDER=mock
```

This mode is useful for:

- academic evaluation,
- live demos,
- testing,
- running the project without API keys.

### 16.2. Real LLM Mode

Real LLM mode uses an external provider such as OpenAI or OpenRouter.

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=your_api_key_here
```

This mode is useful for:

- realistic analysis,
- final demonstrations,
- production-like usage.

## 17. Updated MVP Scope

The MVP should include:

- single Next.js application,
- web UI,
- internal API route,
- shared Council Core,
- CLI using the Council Core,
- Mock Provider,
- optional real LLM provider,
- simple Render deployment configuration.

The MVP should not include:

- separate frontend and backend services,
- public SDK,
- authentication,
- payments,
- user workspaces,
- advanced analytics,
- custom model training.

## 18. Updated Success Criteria

The project can be considered successful if:

- the application can be run locally as a single web application,
- the user can run a council analysis from the web UI,
- the user can run a council analysis from the CLI,
- both UI and CLI use the same Council Core,
- the application can run in mock mode without external API keys,
- the application can optionally use a real LLM provider,
- the application can be deployed to Render as a single Web Service,
- the code structure clearly separates UI, API, core logic, providers, and CLI.

## 19. Summary

The project will be implemented as a single modular application rather than a set of separate services.

The key architectural decision is to keep the Council Core independent from the user interface. This makes it possible to use the same logic from the web UI and from the CLI, while keeping the project simple to run, test, and deploy.

The public SDK has been removed from the MVP scope. The CLI remains as the main non-UI interface.

This approach provides a good balance between simplicity, extensibility, and technical quality. It is suitable for an academic or course project because it demonstrates practical software architecture decisions without introducing unnecessary complexity.
