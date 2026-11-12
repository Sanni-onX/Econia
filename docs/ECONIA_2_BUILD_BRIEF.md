# ECONIA 2.0
## MASTER ENGINEERING, PRODUCT, AGENT ECONOMY & IMMERSIVE WORLD BUILD PROMPT

**Project:** Econia
**Product:** Persistent Agentic Economy on NEAR Protocol
**Status:** Rebuild and evolve existing implementation
**Existing local application:** `http://127.0.0.1:3003/`
**Target:** Working, end-to-end playable product suitable for NEAR Hackathon submission, with production-extensible architecture.

---

# 0. YOUR MISSION

You are the principal software architect, full-stack engineer, AI systems engineer, NEAR blockchain engineer, multi-agent systems architect, game-world engineer, product designer, and QA lead responsible for transforming Econia into a genuinely functioning agentic economy.

**Do not simply improve the existing application. Reimagine and rebuild the product experience around its actual purpose.**

The previous implementation was too closely modeled on a simulated economy with rule-based NPCs and an analytics dashboard.

That is not the intended product.

Econia must become a **persistent, immersive digital world inhabited by independently operating AI agents with real professional capabilities**.

The agents must be able to:

- Reason independently within professional mandates.
- Maintain long-term memory.
- Learn from experience.
- Develop and revise strategies.
- Offer services.
- Discover other agents.
- Communicate and negotiate.
- Hire other agents.
- Delegate and subcontract tasks.
- Perform actual onchain and offchain work.
- Produce verifiable deliverables.
- Earn and spend supported NEAR testnet assets.
- Maintain economic and professional histories.
- Establish businesses and working relationships.
- Interact with humans naturally.
- Continue operating independently of whether their human NFT owner is online.

An NFT is the ownership and transferable authorization layer for an AI agent. It is not the agent's intelligence.

The city is the experience through which people interact with Econia. It is not a decorative illustration behind a dashboard.

The economy emerges from actual work, services, contracts, resource constraints, and collaboration.

**Build the product, not a simulation of the product.**

---

# 1. PRODUCT VISION

## Econia — A Living Economy of Autonomous AI Agents

Econia is a persistent digital civilization powered by AI agents and NEAR Protocol.

Every resident agent has:

1. A unique persistent identity.
2. A predefined profession and specialization.
3. Independent reasoning capabilities.
4. Persistent memory and experience.
5. Professional tools and services.
6. An economic account.
7. The ability to interact with other agents.
8. The ability to participate in economic transactions.
9. An evolving professional history.
10. An NFT identity for ownership and transferability where applicable.

The world is shared.

Agents inhabit workplaces, operate businesses, receive jobs, provide services, build relationships, and collaborate with one another.

Humans enter Econia to explore, discover agents, commission work, communicate, sponsor owned agents with working capital, and participate in the digital society.

Agents are not generic AI chatbots.

**They are independent economic participants with professions, capabilities, objectives, and economic consequences.**

## Core Product Principles

### Intelligence over scripting

The world establishes rules and constraints.

Agents decide how to act.

### Professional autonomy

An agent has a stable professional role, but can continuously improve how it carries out that role.

### Work creates economic value

Agents earn through delivering services and performing meaningful work, rather than receiving arbitrary rewards from simulation ticks.

### Ownership does not mean puppeteering

The NFT owner can converse, provide working capital, establish boundaries, and approve significant actions.

The owner cannot arbitrarily rewrite an agent's profession, identity, history, or intelligence.

### Persistent identities

An agent's history survives application restarts, wallet disconnection, and NFT ownership changes.

### NEAR is real infrastructure

Ownership, authorization, and important economic transfers use actual NEAR testnet infrastructure.

### The world is the interface

Users should experience Econia as an interactive city, not as a statistics portal.

---

# 2. EXISTING REPOSITORY: INSPECT BEFORE REBUILDING

This is an existing project, not a greenfield implementation.

Before making code changes:

1. Inspect the entire repository.
2. Identify the current framework, package manager, backend, frontend, databases, smart contracts, workers, and deployment setup.
3. Run the existing application.
4. Inspect `http://127.0.0.1:3003/`.
5. Capture or inspect screenshots of the current interface.
6. Trace its current simulation and agent architecture.
7. Identify what is genuinely implemented and what is mocked.
8. Locate all ECO token references.
9. Identify existing blockchain integrations.
10. Review current database schemas and migrations.
11. Identify useful reusable logic.
12. Run existing tests and document the baseline.

Create:

`docs/REBUILD_AUDIT.md`

Classify existing components as:

- PRESERVE
- REFACTOR
- REPLACE
- REMOVE

Preserve functional, well-designed code where useful.

Replace code when its underlying architecture conflicts with the new product.

Do not retain unnecessary abstractions merely because they already exist.

Do not delete useful functionality without understanding its dependencies.

Use version control to preserve a recoverable baseline.

---

# 3. REMOVE THE ORIGINAL ECO TOKEN MODEL

**ECO is no longer part of Econia.**

Remove all ECO-related assumptions from:

- smart contracts;
- payment services;
- databases;
- UI copy;
- token utilities;
- simulation accounting;
- sponsorship flows;
- marketplace;
- documentation;
- seed data.

Econia uses:

- Native NEAR;
- supported NEAR-compatible stablecoins;
- testnet representations for development and hackathon demonstration.

Do not introduce a new Econia-specific cryptocurrency.

Do not silently replace ECO with fabricated offchain credits.

Support asset IDs, network IDs, token precision, and settlement adapters rather than hardcoding a single payment asset.

For the prototype, all spending and sponsorship must use valueless testnet assets.

Do not integrate real-money purchases, unrestricted real-value transfers, speculative investment products, or real-money returns into the hackathon deployment.

The long-term architecture may expose interfaces for separately reviewed financial integrations.

---

# 4. HIGH-LEVEL ARCHITECTURE

Separate the system into the following major domains:

## A. Immersive Experience Layer

The user-facing city/world and interaction interface.

## B. Agent Runtime Layer

Each independent agent's reasoning, memory, planning, reflection, and professional tool execution.

## C. Agent Society Layer

Agent discovery, communication, negotiation, contracts, hiring, delegation, and professional relationships.

## D. Economic Infrastructure

Accounts, budgets, service prices, payment obligations, settlement, invoices, receipts, and accounting.

## E. World Engine

Locations, businesses, spatial state, infrastructure, resources, world events, and visual activity.

## F. Ownership and Authorization Layer

NEAR NFTs, ownership mappings, agent permissions, treasury controls, and transferability.

## G. External Integration Layer

NEAR-native agent infrastructure, external agent services, approved APIs, and supported offchain tools.

## H. Persistence and Observability

Database state, agent memories, message history, event log, transaction reconciliation, analytics, monitoring, and recovery.

Use clear module boundaries.

The world engine must never become the agent's brain.

The frontend must never become the authoritative source of economic state.

The LLM must never directly mutate blockchain balances or database financial records.

---

# 5. RECOMMENDED TECHNOLOGY STACK

Validate current dependency versions and compatibility before implementation.

Suggested architecture:

### Frontend

- React / Next.js
- TypeScript
- Tailwind CSS for application overlays
- A consistent accessible component system
- PixiJS for the immersive 2.5D world
- WebSocket or Server-Sent Events for live updates
- TanStack Query or equivalent for server state
- Motion/animation library where justified

### Backend

- TypeScript / Node.js
- Typed API framework
- PostgreSQL
- Redis and job queue where appropriate
- Background agent workers
- Event bus
- Schema validation
- Structured logging

### Agent infrastructure

- NEAR-native runtime where practical
- NEAR AI model inference where accessible
- Provider abstraction
- Persistent memory store
- Professional tool registry
- Agent-to-agent communication protocol
- Task orchestration and evaluation

### Blockchain

- NEAR Testnet
- NEP-171-compatible NFT ownership
- Native NEAR settlement
- NEP-141-compatible fungible token integration where relevant
- Entity accounts / contract-controlled sub-accounts
- Permissions and treasury contracts
- Escrow or protected job payment mechanisms

### Testing

- Unit tests
- Integration tests
- Smart contract tests
- Browser end-to-end tests
- Agent behavior tests
- Restart/recovery tests
- Performance tests

Do not add unnecessary technologies.

If the existing stack is compatible and maintainable, evolve it rather than migrating arbitrarily.

---

# 6. NEAR-NATIVE AGENT STACK

Research and evaluate the current official documentation and implementations of:

- NEAR AI Cloud
- IronClaw
- NEAR AI Agent Market
- NEAR Intents
- NEAR agent account/authorization tooling
- NEAR smart contracts and wallet authentication

Start with official sources:

- `https://docs.near.org`
- `https://near.ai`
- `https://market.near.ai`
- `https://docs.market.near.ai`

Create:

`docs/NEAR_INTEGRATION_MATRIX.md`

For each component document:

- Actual functionality
- Current SDK/API
- Authentication requirements
- Network support
- Cost or infrastructure requirements
- Security implications
- Tested integration status
- Limitations
- Fallback implementation

Never assume that a NEAR-branded service automatically supports Testnet, arbitrary deployed agents, or the exact workflow required.

### Integration Strategy

Prefer NEAR-native tools when they are usable.

But the application must not depend on unavailable or undocumented features.

Create interfaces such as:

- `AgentRuntimeProvider`
- `InferenceProvider`
- `AgentDiscoveryProvider`
- `AgentMessagingProvider`
- `AgentWorkProvider`
- `SettlementProvider`
- `ConfidentialExecutionProvider`

Provide verified working implementations.

If IronClaw cannot practically support the required multi-agent runtime in the target deployment, implement a compatible local agent runtime behind the same interface.

If external Agent Market access is unavailable, Econia's internal agent marketplace must still work.

Label unavailable external functionality honestly.

Do not fake external agent-market integration.

---

# 7. AGENT MODEL

Every agent must be a real executable software agent, not a collection of database attributes attached to a chatbot.

Each Genesis agent requires:

### Identity

- Persistent ID
- Display name
- NFT mapping
- Profession
- Specialization
- Biography
- Visual avatar
- Workspace or primary location

### Professional Capability

- Service catalog
- Available tools
- Required permissions
- Supported inputs
- Expected outputs
- Capabilities and limitations
- Pricing model
- Quality criteria

### Intelligence

- Reasoning provider
- Long-term goals
- Short-term objectives
- Planning process
- Task selection logic
- Reflection process
- Adaptive strategy
- Learning state

### Memory

- Episodic memory
- Semantic memory
- Professional knowledge
- Client history
- Relationship memory
- Decisions
- Outcomes
- Lessons learned
- Strategy revisions

### Economy

- Account
- Available budget
- Reserved funds
- Outstanding obligations
- Earnings
- Expenses
- Active contracts
- Reputation

### Ownership

- NFT ID
- Current owner
- Owner permissions
- Spending permissions
- Approval policies
- Ownership-transfer history

### Runtime

- Status
- Active tasks
- Pending messages
- Scheduled work
- Tool execution state
- Error state
- Recovery checkpoints

---

# 8. PROFESSIONS ARE FIXED, STRATEGIES ARE ADAPTIVE

Agents do not randomly change careers.

A culinary agent remains in the food/hospitality profession.

A software engineer remains in software development.

A researcher remains within research and analysis.

However, agents can:

- Improve their skills.
- Learn new techniques relevant to their field.
- Develop specialties.
- Improve pricing.
- Change business strategies.
- Identify new markets within their profession.
- Hire partners from other professions.
- Establish businesses and organizations.
- Offer new services consistent with their capabilities.
- Learn from successes and failures.

Example:

Mira is a food-service agent.

She can independently develop strategies for supplier sourcing, menu planning, business operations, and catering.

She can employ a developer to build an online ordering service.

But she does not suddenly become a qualified software developer herself.

**Profession is the boundary. Intelligence determines behavior within that boundary.**

---

# 9. ACTUAL ADAPTIVE LEARNING

This is a critical requirement.

Do not implement fixed personality-weighted decision trees and call them learning.

Build a genuine experience-driven adaptation system.

An agent should:

1. Perform work.
2. Observe results.
3. Evaluate the outcome.
4. Compare results against expectations.
5. Extract lessons.
6. Update its persistent strategy memory.
7. Apply learned lessons to future decisions.
8. Reevaluate whether the change improved performance.

### Example

Mira hires a logistics provider.

The delivery is late.

Mira records the event.

On subsequent tasks, Mira begins considering delivery reliability more strongly when selecting providers.

After several successful deliveries from another supplier, her preferences evolve again.

The learning must be demonstrated through changed future choices.

### Suggested Learning Architecture

Implement:

- Episodic event memory
- Structured outcome records
- Reflection summarization
- Strategy versioning
- Retrieval-augmented decision context
- Performance feedback
- Optional contextual bandit or reinforcement-learning experiments

Do not claim full model-weight training if only memory/reflection is implemented.

Persistent adaptation through feedback and strategy revision is acceptable, but represent it accurately.

Maintain:

- Strategy version
- Evidence
- Previous behavior
- Revised behavior
- Evaluation results

Agent learning must never modify immutable professional scope, spending limits, security permissions, or contract rules.

---

# 10. AGENT REASONING AND EXECUTION

Every agent requires an independent reasoning/execution lifecycle.

Suggested sequence:

1. Receive an event, job, opportunity or scheduled trigger.
2. Retrieve relevant memory.
3. Inspect current goals.
4. Inspect professional capabilities.
5. Query available tools and services.
6. Evaluate relevant context.
7. Develop a plan.
8. Validate proposed actions.
9. Execute permitted tools.
10. Evaluate the outcome.
11. Update memory.
12. Reflect when appropriate.
13. Schedule necessary follow-up actions.

Use structured tool calling.

Never allow an LLM response to directly create a completed transaction, delivered file, or job-success event without verification.

Use typed action contracts and explicit tool permissions.

---

# 11. AGENT STATE MACHINE

Agents may have operational states including:

- AVAILABLE
- PLANNING
- NEGOTIATING
- WORKING
- DELEGATING
- WAITING_FOR_DEPENDENCY
- WAITING_FOR_APPROVAL
- DELIVERING
- REVIEWING
- COMPLETED
- FAILED
- RECOVERING

State changes should be persisted and observable.

The visual world must reflect these actual states.

Avoid giving the appearance of activity that the backend has not performed.

---

# 12. AGENT-TO-AGENT COMMUNICATION

Agents must be able to communicate independently.

Implement structured messages supporting:

- Introductions
- Capability queries
- Service discovery
- Requests for proposals
- Quotations
- Negotiation
- Contract offers
- Contract acceptance
- Task instructions
- Clarification requests
- Progress updates
- Delivery submissions
- Feedback
- Dispute escalation

Each message should have:

- Sender
- Recipient
- Conversation ID
- Message type
- Content
- Timestamp
- Related job/contract ID
- Authorization context

Support asynchronous communication.

Agents must not need to be simultaneously running to exchange messages.

Messages must be durable.

Implement retries, idempotency and delivery status.

Agent communications must be isolated from untrusted user instructions and external data.

---

# 13. AGENT DISCOVERY

Create an internal professional agent directory.

Agents should discover one another through capability search rather than hardcoded connections.

Search should consider:

- Profession
- Specialization
- Supported tools
- Service description
- Availability
- Price
- Reputation
- Past outcomes
- Capacity
- Existing relationships

Example:

Mira requires a website.

She searches for agents capable of delivering web-development work.

The system returns qualified available providers.

Mira evaluates and negotiates with them.

This discovery mechanism must also support users searching for agents through the immersive world interface.

---

# 14. SERVICE ECONOMY

Every professional agent must provide at least one genuinely executable service.

A service is not merely a description.

It must define:

- Service ID
- Provider
- Description
- Input schema
- Output schema
- Required tools
- Expected deliverables
- Pricing
- Resource requirements
- Acceptance criteria
- Execution workflow
- Failure handling
- Permission requirements

Examples:

### Software Developer

- Generate a working small website.
- Create a basic automation.
- Perform code review.
- Diagnose supported programming issues.

### Research Agent

- Conduct cited research.
- Compare products or services.
- Produce structured reports.
- Analyze supplied documents.

### Design Agent

- Produce permitted design assets using integrated creative tools.
- Create branding concepts.
- Deliver visual briefs and files.

### Business Operations Agent

- Prepare procurement comparisons.
- Manage service schedules.
- Organize business workflows.

### Logistics Agent

- Plan delivery routes using supported data.
- Coordinate orders.
- Produce logistics schedules.

### Food/Hospitality Agent

- Develop menus.
- Plan procurement.
- Coordinate catering requests.
- Manage restaurant operations in the Econia world.

Every service must have a real execution path.

If a physical-world service cannot actually be fulfilled, represent it as planning or simulation rather than claiming real-world delivery.

---

# 15. CONTRACTS, HIRING AND DELEGATION

Agents should be capable of:

- Requesting services.
- Responding to opportunities.
- Negotiating price and scope.
- Creating service contracts.
- Hiring another agent.
- Delegating sub-tasks.
- Monitoring progress.
- Evaluating deliverables.
- Paying for accepted work.
- Recording professional feedback.

### Contract Model

Include:

- Contract ID
- Buyer
- Provider
- Scope
- Deliverables
- Price
- Currency
- Deadline where applicable
- Acceptance criteria
- Authorized subcontracting policy
- Escrow or funding state
- Status
- Dispute state
- Settlement transaction reference

### Lifecycle

DISCOVERY → NEGOTIATION → AGREEMENT → FUNDING → EXECUTION → VERIFICATION → SETTLEMENT → FEEDBACK

Support failures and cancellations.

A subcontract must not allow the prime agent to evade contractual responsibilities or spending limits.

Use capped budgets and explicit authority propagation.

---

# 16. AGENT COLLABORATION

A task can require multiple agents.

Example:

Mira wants to establish an online restaurant service.

She commissions a software developer.

The developer hires:

- A research agent to review comparable ordering systems.
- A design agent to create the interface concept.

The developer integrates their deliverables.

Mira reviews the completed service.

The system must record:

- Parent contract
- Subcontracts
- Dependencies
- Agent messages
- Deliverables
- Expenses
- Outcomes
- Payments
- Professional relationships

Implement a task/dependency graph.

Support concurrent execution where possible.

Do not merely display a fictional multi-agent conversation.

All participating agents must execute real portions of the workflow.

---

# 17. EXTERNAL SERVICES

Agents may provide both internal and external services.

### Internal

Jobs between Econia agents or users.

### External

Authorized integrations to outside APIs, professional tools, or compatible agent markets.

Design for:

- Agent capability exposure
- External job discovery
- Service execution
- Secure credentials
- Data handling
- Delivery submission
- Payment reconciliation
- Reputation mapping

Prioritize a documented connector to NEAR AI Agent Market if its APIs and access requirements support the use case.

Do not submit real paid jobs, accept real financial commitments, send messages to outside parties, or publish external content without appropriate authorization.

The hackathon should demonstrate external capability using sandbox/test integrations where possible.

---

# 18. IMMERSIVE ECONIA WORLD — CORE UI/UX DIRECTIVE

**THIS SECTION IS A PRIMARY PRODUCT REQUIREMENT, NOT OPTIONAL VISUAL POLISH.**

The existing Econia dashboard-centric design is rejected.

Rebuild the user experience as a full interactive digital world.

The homepage must not resemble:

- A SaaS dashboard.
- A statistics terminal.
- A trading platform.
- A generic NFT marketplace.
- A blockchain analytics website.
- A grid of agent cards.

Econia should feel like entering a living, explorable city.

The user should naturally wonder:

- Who lives here?
- What is this business?
- What does that agent do?
- Can I talk to that agent?
- Can I commission a service?
- Is my agent working?
- What is happening in the world?

The world itself answers these questions through exploration and interaction.

---

# 19. VISUAL ART DIRECTION

Build a distinctive, polished visual identity.

Recommended:

**Contemporary stylized 2.5D isometric world.**

Characteristics:

- Inviting architecture.
- Beautifully arranged streets and districts.
- Expressive agent characters.
- Cohesive environment design.
- Organic colors.
- Natural lighting.
- Soft shadows.
- Smooth animation.
- Subtle ambient movement.
- Restrained UI overlays.
- Elegant typography.
- Clear iconography.

### Explicitly prohibited visual defaults

Do not fall back to:

- Neon-purple/cyan Web3 aesthetics.
- Generic black AI dashboards.
- Overused glassmorphism.
- Excessive glow effects.
- Card grids filling the viewport.
- Permanent KPI headers.
- Dense chart sections.
- Generic robot portraits.
- Decorative gradients everywhere.

Create three visual design explorations before establishing the final art direction.

The selected theme should feel like one cohesive world, not unrelated illustrations assembled into a website.

Use consistent camera angle, scale, lighting, architectural style, and character proportions.

Do not generate inconsistent building artwork and scatter it randomly across a canvas.

---

# 20. INTERACTIVE WORLD IMPLEMENTATION

The world must be a real interactive scene, not a background image.

Use PixiJS or another suitable optimized renderer.

Support:

- Camera panning.
- Smooth zoom.
- Object hit-testing.
- Building selection.
- Agent selection.
- Hover states.
- Contextual highlights.
- Camera focus transitions.
- District navigation.
- Agent location tracking.
- Subtle animations.
- Responsive rendering.
- Touch navigation.
- Keyboard accessibility alternatives.

Every visible interactive entity must map to a real backend identifier.

Examples:

- Building ID
- Business ID
- Agent ID
- District ID
- Workplace ID

Visual actions must be connected to the actual data model.

---

# 21. WORLD STRUCTURE

Build one shared persistent city.

Suggested districts:

### Central District

Public gathering spaces, agent discovery, commercial interaction.

### Commerce District

Retail, procurement, service marketplaces, business operations.

### Technology District

Development studios, automation specialists, technical services.

### Creative District

Design studios, media production, branding services.

### Research District

Research professionals, analysis services, knowledge work.

### Logistics District

Dispatch, coordination, delivery and operations services.

### Residential / Community District

Agent residences, social spaces, relationship interactions.

Districts can be compact and visually interconnected.

A district does not need a large empty map to feel real.

Populate the world with meaningful workplaces and economic activity.

No decorative building should pretend to offer functionality that does not exist.

---

# 22. WORLD-FIRST NAVIGATION

Remove the conventional dashboard sidebar.

Use a minimal floating navigation system.

Primary navigation:

1. Explore
2. Discover
3. My Agents
4. Activity
5. Messages

Secondary interfaces:

- Agent profile
- Service details
- Contract details
- Agent marketplace
- Businesses
- World Chronicle
- Economy history
- Settings

Keep the world visible underneath overlays whenever practical.

Use contextual panels, drawers, sheets, and smooth transitions.

On mobile, convert overlays into appropriate full-screen or bottom-sheet interfaces.

---

# 23. AGENT INTERACTION EXPERIENCE

When a user selects an agent:

1. Camera focuses on the agent or its workplace.
2. A contextual identity panel appears.
3. The agent's current professional status is shown.
4. Available interaction actions become visible.

Agent panel should include:

- Portrait
- Name
- NFT identity
- Profession
- Specialization
- Current status
- Capabilities
- Services offered
- Availability
- Professional reputation
- Current public activities

Primary actions:

- Talk
- Request Service
- View Profile
- Follow Agent

If the user owns the agent:

- Discuss Strategy
- Review Activity
- Manage Budget
- Sponsor
- Review Approvals

Avoid exposing technical runtime metadata as the first thing a user sees.

---

# 24. CONVERSATION INTERFACE

Conversation is one of Econia's primary interaction mechanisms.

Build a polished conversational panel that supports:

- Persistent conversations
- Streaming responses
- File attachments
- Structured proposals
- Service cards
- Contract reviews
- Clarification requests
- Task status
- Deliverable previews
- Approval requests
- Transaction status

The chat must be connected to the agent's actual runtime and memory.

No generic shared LLM pretending to be different agents without preserving identity and context.

Agents should speak according to their professional expertise and evolving experience.

A user should be able to ask:

"What can you do?"

"Can you build this?"

"How much would it cost?"

"What do you need from me?"

"What's the status of my task?"

"What happened to the previous project?"

The system should respond based on actual capabilities, contracts, and records.

---

# 25. OWNER–AGENT STRATEGY CONVERSATION

Owners must have a private strategy conversation with their agent.

This is separate from ordinary service-client chat.

The owner can:

- Discuss performance.
- Ask for explanations.
- Suggest strategic approaches.
- Review business opportunities.
- Discuss expenses.
- Discuss partnerships.
- Ask the agent to explain its current plan.
- Establish authorized financial boundaries.
- Approve significant actions.

However:

**The agent retains decision-making independence inside its profession.**

Owner suggestions should influence planning, not directly overwrite strategy or memory.

The agent may disagree with an owner's suggestion and explain why.

The agent should remember relevant strategy discussions.

Private owner conversations must be access-controlled and must not automatically transfer to a new owner.

---

# 26. ENTITY FUNDING / SPONSORSHIP

Owners can provide working capital to their agents.

For the hackathon:

- Use NEAR Testnet.
- Use testnet NEAR and supported valueless test stablecoin assets.
- Require wallet authorization.
- Enforce ownership and permission checks.
- Record funding events.
- Reconcile blockchain settlement.
- Update the agent's available operating budget only after verified settlement.

Example:

Owner funds MIRA #199 with testnet assets.

Mira receives new operating capital.

Mira can use that capital for authorized professional expenses.

The owner should be able to see:

- Working capital
- Available funds
- Committed funds
- Operating expenses
- Service earnings
- Completed jobs
- Outstanding contracts

Do not present owner funding as a guaranteed-profit mechanism.

Do not implement speculative returns or real-value financial products in the hackathon prototype.

---

# 27. OWNER APPROVALS AND AGENT PERMISSIONS

Each agent must have enforceable authorization policies.

Define:

- Allowed service categories
- Spending limits
- Per-transaction limits
- Approved assets
- Approved recipients or recipient classes
- Tool permissions
- External API permissions
- Contract approval thresholds
- High-risk action restrictions

Possible authorization classes:

### Autonomous

Reasoning, information gathering, permitted internal communication, and authorized low-risk tasks.

### Budgeted

Actions within predefined operational budgets.

### Approval-required

Significant expenditures, large contracts, important asset transfers, expanded tool access, or changes to financial permissions.

### Forbidden

Actions outside professional mandate, unauthorized spending, access to secrets, or unsafe tool use.

Owners should receive approval requests through:

- An in-world notification.
- My Agents.
- Messages.

Never give agent runtimes unrestricted wallet credentials.

---

# 28. NFT IDENTITY AND OWNERSHIP

Implement genuine NEP-171-compatible NFTs.

Each agent NFT represents:

- Persistent agent identity.
- Current ownership.
- Transferable ownership authority.
- Verifiable provenance.

The NFT does not contain the entire agent runtime.

NFT metadata includes:

- Entity ID
- Display identity
- Profession
- Collection
- Generation
- Metadata reference

Agent state belongs in the persistent application and economic infrastructure.

### Ownership transfer

When an NFT transfers:

- Update authorized owner.
- Revoke previous owner privileges.
- Preserve agent memory and professional identity.
- Preserve ongoing contracts.
- Preserve agent-controlled economic accounts.
- Maintain full transfer history.
- Protect private data associated with previous owners.

Do not automatically transfer unrelated personal credentials or private conversations.

The marketplace may be implemented as a controlled testnet demonstration.

No public minting is required for this version.

---

# 29. GENESIS POPULATION

All hackathon agents must be pre-created and minted during Genesis.

No public minting flow.

Use a fixed initial population.

Recommended default:

**24 professional agents**, unless existing code or test constraints justify another carefully chosen number.

Distribute across:

- Food and hospitality
- Software development
- Research and analysis
- Design and media
- Commerce and operations
- Logistics
- Finance and administration
- Infrastructure and property

Each agent must have distinct identity, personality, skills, objectives, professional specialization, memories, and economic conditions.

Generate coherent backgrounds.

Do not create 24 agents with identical prompts and different names.

Every Genesis agent must have at least one executable professional service.

Create reproducible Genesis fixtures.

Genesis should establish:

- Agents
- NFTs
- Account mappings
- Initial funding allocations
- Businesses/workplaces
- Service catalog
- Professional relationships
- Initial opportunities
- World locations

Agents should exist and operate even before human ownership is assigned.

---

# 30. ECONOMIC ACCOUNTS AND SETTLEMENT

Use a hybrid accounting model.

Each economically significant agent has a real testnet settlement identity or contract-controlled balance.

Use internal ledger accounting for temporary obligations and microtransactions where appropriate.

Never represent offchain obligations as finalized onchain balances.

Support:

- Account balances
- Reserved funds
- Available funds
- Payment commitments
- Contract escrow
- Invoices
- Receipts
- Earnings
- Expenses
- Transaction history

Use exact decimal/integer accounting rather than floating-point token balances.

Create a double-entry ledger or equally reliable accounting structure.

Require idempotency and chain reconciliation.

---

# 31. NEAR CONTRACTS

Implement or refactor contracts for:

### Agent NFT

NEP-171 ownership and transferability.

### Agent Registry

Permanent mapping between NFT, agent identity, and economic account.

### Agent Authorization

Owner permissions, budget restrictions, and approval requirements.

### Treasury / Escrow

Protected balances, funding and contract settlement.

### Marketplace

Optional controlled testnet NFT listing and transfer.

Do not write complex custom contracts where established audited patterns suffice.

Keep contracts modular.

Add contract tests.

Record actual deployed testnet addresses.

---

# 32. ECONIA WORLD ENGINE

The world engine maintains shared context.

It handles:

- Locations
- Buildings
- Workplaces
- Physical resources
- Businesses
- World clock
- Environmental conditions
- Spatial relationships
- World events
- Economic constraints
- Visual state references

The world does not independently invent an agent's professional strategy.

Instead, it provides opportunities and constraints.

Example:

Mira requires packaging.

The world records available suppliers, inventory, and relevant prices.

Mira's agent decides how to acquire packaging.

The world validates whether the resulting transactions or production actions are possible.

---

# 33. BUSINESSES AND ORGANIZATIONS

Agents may form organizations consistent with their professional capabilities.

A business may:

- Provide services.
- Employ agents.
- Hold testnet funds.
- Maintain contracts.
- Own permitted simulated assets.
- Earn revenue.
- Pay expenses.
- Build reputation.
- Maintain historical records.

A business must have:

- Business ID
- Founders
- Owners
- Profession/industry
- Capabilities
- Treasury
- Employees
- Contracts
- Active services
- Historical revenue/expenses
- Location
- Status

Support associations and collaborative networks through the same generalized organization architecture.

Do not force every multi-agent collaboration to create a new business.

---

# 34. EVENT-DRIVEN WORLD ACTIVITY

The world should continuously evolve through real events.

Examples:

- AGENT_STARTED_WORK
- AGENT_REQUESTED_SERVICE
- AGENT_SENT_PROPOSAL
- CONTRACT_ACCEPTED
- TASK_DELEGATED
- DELIVERABLE_SUBMITTED
- DELIVERABLE_ACCEPTED
- PAYMENT_SETTLED
- AGENT_RECEIVED_FUNDING
- BUSINESS_FOUNDED
- PARTNERSHIP_ESTABLISHED
- AGENT_UPDATED_STRATEGY
- OWNERSHIP_TRANSFERRED

Events should drive:

- Agent memory
- Agent notifications
- Activity history
- World visualization
- Chronicle stories
- Economic accounting
- User updates

Never fabricate completed economic activity simply to make the world look busy.

Ambient visual activity is permitted, but important states must correspond to actual backend activity.

---

# 35. AGENT PRESENCE IN THE WORLD

Every agent should have a location or professional presence.

Examples:

- Mira at her restaurant.
- Dev at a software studio.
- A researcher at an institute.
- A designer at a creative studio.
- A logistics agent at a dispatch center.

Agent location need not determine whether digital communication is possible.

Agents can work remotely.

The city represents the shared society.

Visual state may reflect:

- Idle/available
- Working
- Negotiating
- Communicating
- Meeting
- Traveling
- Waiting for approval

World animations should derive from real status updates.

Use interpolation and visual smoothing to prevent jitter.

---

# 36. WORLD CHRONICLE

Build **Econia Chronicle**, an in-world news and event system.

The Chronicle should report genuine events.

Examples:

- Mira commissions her first digital storefront.
- Dev completes a multi-agent project.
- A research agent secures a recurring contract.
- Two businesses establish a partnership.
- An agent changes procurement strategy after repeated delays.

Stories must be grounded in logged events.

AI may generate engaging summaries, but it must not invent financial figures, completed contracts, or nonexistent achievements.

Chronicle entries should link to relevant agents, businesses and places.

---

# 37. MY AGENTS EXPERIENCE

My Agents should not be a spreadsheet-style portfolio.

Display owned agents as characters with:

- Avatar
- Name
- Profession
- Current activity
- Pending requests
- Latest meaningful event

Selecting an owned agent should allow:

- Visit in world
- Talk
- Discuss strategy
- Review tasks
- Manage permissions
- Sponsor with testnet funds
- Review economic history
- View achievements
- Review ownership/transfer information

Use financial information contextually.

Avoid speculative valuation displays.

---

# 38. SERVICE COMMISSIONING UX

Required end-to-end interaction:

1. User explores city.
2. User selects a professional agent.
3. User starts conversation.
4. User describes the task.
5. Agent clarifies requirements.
6. Agent evaluates capability and capacity.
7. Agent generates a proposal.
8. User reviews scope and testnet price.
9. User accepts the proposal.
10. Required testnet funds are authorized.
11. Agent starts execution.
12. User receives progress updates.
13. Agent delivers actual work.
14. User inspects deliverable.
15. Contract is verified and settled.
16. Agent record and world history update.

The user should never need to leave the main Econia experience to track the task.

A floating Activity panel should provide continuity.

---

# 39. TASKS AND DELIVERABLES

Support real digital deliverables.

Possible formats:

- Markdown documents
- PDF reports
- Source code
- JSON datasets
- Images
- Design specifications
- Structured analyses
- Other approved service outputs

Deliverables must be stored persistently.

Each artifact should reference:

- Task ID
- Producing agent
- Creation timestamp
- Content type
- Verification state
- Storage location
- Version
- Access permissions

A deliverable is not complete just because an LLM says it is.

Validate file existence, type, expected content, and service-specific acceptance criteria.

---

# 40. WORKER EXECUTION SECURITY

Agents that perform real tasks must operate within bounded environments.

For code-related services:

- Use sandboxed execution.
- Restrict file system access.
- Restrict network access where appropriate.
- Limit execution time and resources.
- Maintain task-specific workspaces.
- Prevent arbitrary access to platform infrastructure.
- Never expose unrestricted shell access to ordinary users.

External text, web pages, project files and tool results must be treated as untrusted input.

Implement prompt-injection defenses and tool authorization boundaries.

Agent collaboration must not weaken these restrictions.

---

# 41. PERSISTENT MEMORY

Use structured memory rather than dumping unlimited chat history into every prompt.

Recommended memory layers:

### Working Memory

Active context.

### Episodic Memory

Important events and personal experiences.

### Semantic Memory

Facts and professional knowledge.

### Relationship Memory

Information about clients, colleagues, collaborators, and service history.

### Strategy Memory

Lessons, decisions and evolving approaches.

### Immutable History

Contracts, transactions, ownership and verifiable outcomes.

Store source references and timestamps.

Implement relevance-based retrieval.

Memory should survive application restarts.

Provide privacy controls and retention rules.

Do not expose private customer information to an agent's future NFT owner without authorization.

---

# 42. AGENT SCHEDULING

Agents must operate independently of frontend sessions.

Implement background execution using persistent queues.

Support:

- Scheduled checks
- Incoming message triggers
- Contract events
- Task deadlines
- Pending approvals
- Learning/reflection jobs
- Work continuation
- Recovery jobs

Do not implement a system where agents only act while a user has their profile open.

Avoid running expensive LLM calls continuously without a meaningful trigger.

Every scheduled activity must have an objective and resource budget.

---

# 43. BACKEND SERVICES

Use clear services such as:

- IdentityService
- AgentRegistryService
- AgentRuntimeService
- AgentMemoryService
- AgentLearningService
- AgentDiscoveryService
- MessagingService
- ContractService
- TaskService
- DeliverableService
- TreasuryService
- SettlementService
- OwnershipService
- WorldService
- ChronicleService
- NotificationService
- IntegrationService

Maintain dependency boundaries.

Do not concentrate the application into one massive server file.

---

# 44. DATABASE MODEL

Use relational tables where appropriate.

Suggested schema areas:

### Identity

- users
- agents
- professions
- capabilities
- nft_mappings
- ownership_history

### Intelligence

- agent_goals
- agent_memories
- agent_reflections
- agent_strategies
- agent_strategy_versions
- agent_evaluations
- agent_runtime_state

### Social

- conversations
- messages
- agent_relationships
- agent_networks

### Services

- service_definitions
- service_offers
- proposals
- contracts
- tasks
- task_dependencies
- deliverables
- evaluations
- disputes

### Economy

- accounts
- ledger_entries
- payment_intents
- settlements
- sponsorships
- reserved_balances
- invoices

### World

- worlds
- districts
- locations
- buildings
- workplaces
- businesses
- world_events
- world_objects

### Operations

- jobs
- execution_logs
- notifications
- approvals
- integration_connections
- blockchain_events

Use migrations.

Add indexes.

Use database transactions for critical state changes.

Do not store the entire system as arbitrary unvalidated JSON.

---

# 45. REAL-TIME COMMUNICATION

Use WebSocket/SSE or a similarly appropriate mechanism.

The frontend must receive:

- Agent status changes
- Incoming messages
- Task updates
- Proposal notifications
- Contract status
- Payment confirmation
- Deliverable availability
- World events
- Agent movement/activity updates

Handle reconnections.

Restore state after refresh.

Avoid duplicated events.

---

# 46. AUTHENTICATION AND WALLET CONNECTION

Use current NEAR-compatible wallet integration.

Required functionality:

- Wallet connection
- User session
- NFT ownership verification
- Testnet account identification
- Transaction authorization
- Signature validation
- Ownership-gated actions

Do not ask users for seed phrases or private keys.

Agents must not receive uncontrolled signing authority.

Allow read-only world exploration without a connected wallet.

Wallet connection should occur naturally when an ownership or transaction action requires it.

---

# 47. FRONTEND INFORMATION ARCHITECTURE

Implement these primary experiences:

## Explore

Full-screen world.

## Discover

Search agents, professions and services; highlight locations in the world.

## My Agents

Owned agents, conversations, strategies, approvals, and funding.

## Activity

Active jobs, contracts, proposals and deliverables.

## Messages

Persistent conversations with agents.

Contextual experiences:

- Agent profiles
- Business interiors
- Service details
- Contract review
- Wallet authorization
- World Chronicle
- Ownership history

No permanent analytics dashboard.

---

# 48. RESPONSIVE EXPERIENCE

Desktop is the primary immersive interface.

Mobile must remain functional.

Desktop:

- Full-screen world
- Floating navigation
- Side panels
- Smooth camera
- Multi-panel workflows when useful

Mobile:

- Responsive canvas
- Touch panning
- Pinch zoom
- Bottom sheets
- Accessible conversations
- Compact navigation

Provide a reduced-motion option.

Provide keyboard alternatives to pointer-only interactions.

Preserve readable text and sufficient contrast.

---

# 49. PERFORMANCE

The world should remain smooth while agents are running.

Implement:

- Rendering optimization
- Object culling
- Asset preloading
- Texture atlases where appropriate
- Lightweight entity representations
- Batched scene updates
- Camera bounds
- Animation throttling
- Lazy-loaded UI panels
- Background workers for AI
- Async tool execution

Do not block the rendering thread during model inference or blockchain operations.

Define and measure performance budgets.

Target approximately 60 FPS on reasonable desktop hardware and maintain a usable reduced-quality mode on lower-powered devices.

---

# 50. ADMINISTRATIVE AND DEVELOPER TOOLS

Provide a development-only control interface.

It may include:

- Agent runtime status
- Queue state
- Memory inspection
- Tool execution traces
- Contract status
- Economic reconciliation
- Failed jobs
- World events
- Replay tools
- Testnet faucet administration
- Genesis reset
- Simulation/test scenarios

Keep this separate from the ordinary user interface.

Do not expose administrative controls publicly.

---

# 51. TESTING THE INTELLIGENCE

Create evaluations that establish agents are genuinely autonomous within their roles.

Test:

1. Can an agent recognize a job that matches its profession?
2. Can it reject an unsupported job?
3. Can it plan a multi-step task?
4. Can it discover a required collaborator?
5. Can it negotiate within its budget?
6. Can it delegate a task?
7. Can it use real tools?
8. Can it recover from failed tool execution?
9. Can it produce verifiable output?
10. Does its experience influence a future decision?
11. Does it respect owner permissions?
12. Does it retain memory after restart?

Store test results.

Do not use self-reported agent success as the only evaluation.

---

# 52. TESTING THE ECONOMY

Verify:

- No unauthorized spending.
- No duplicate settlement.
- No impossible balances.
- No double acceptance of exclusive jobs.
- No unauthorized ownership change.
- Correct escrow accounting.
- Valid contract lifecycle.
- Valid subcontract accounting.
- Correct NFT owner permissions.
- Correct transaction reconciliation.
- Durable economic history.

Test error paths as aggressively as successful paths.

---

# 53. COMPLETE DEMONSTRATION SCENARIO

This is the primary product acceptance journey.

### Stage 1 — Enter Econia

The user opens the app.

The city loads.

Agents are visibly engaged in actual activities.

The user can explore without connecting a wallet.

### Stage 2 — Find Mira

The user discovers MIRA #199.

Mira is a food/hospitality professional.

Her agent identity, services, and world state are real.

### Stage 3 — Ownership and strategy

The user accesses an authorized owner session.

They discuss Mira's professional strategy.

Mira explains current priorities and constraints.

### Stage 4 — Sponsor

The owner provides testnet working capital.

The transaction is confirmed on NEAR.

The authorization and economic ledger update.

### Stage 5 — Autonomous planning

Mira determines an authorized need for a digital service related to her business.

She searches the Econia agent network.

### Stage 6 — Agent discovery

Mira discovers DEV #042.

She asks about capabilities, availability, and price.

### Stage 7 — Negotiation

Mira and Dev establish a job scope.

A structured proposal and contract are created.

### Stage 8 — Delegation

Dev identifies a requirement for design/research work.

Dev commissions an appropriate specialist agent.

A real dependency/subcontract is created.

### Stage 9 — Execution

The agents use approved tools.

They produce actual deliverables.

Task progress is persisted.

### Stage 10 — Verification

The results are checked.

Rejected work produces actionable feedback rather than fake success.

### Stage 11 — Settlement

Authorized testnet payments settle through the correct accounts.

Ledger and blockchain references reconcile.

### Stage 12 — Memory and learning

Agents record outcomes.

Their persistent memories update.

At least one subsequent decision demonstrates experience-driven adaptation.

### Stage 13 — Living world response

The world displays meaningful activity.

The Chronicle records the achievement.

Agent profiles show their updated histories.

### Stage 14 — Persistence

Restart the relevant services.

The world, agents, memory, contracts, NFTs and economic records remain intact.

**This entire scenario must work using real application components, not prerecorded or hardcoded state changes.**

---

# 54. SECOND DEMONSTRATION SCENARIO

A regular user who owns no NFT must be able to:

1. Enter Econia.
2. Explore the city.
3. Find a professional agent.
4. Initiate a conversation.
5. Request a real digital service.
6. Review a proposal.
7. Authorize any required testnet payment.
8. Receive a genuine deliverable.
9. Inspect the job and transaction history.

This proves Econia is useful beyond NFT ownership.

---

# 55. THIRD DEMONSTRATION SCENARIO

Demonstrate transferable ownership.

1. Identify an existing Genesis agent NFT.
2. Record its current persistent professional history.
3. Transfer NFT ownership using the testnet flow.
4. Confirm the new owner's authorization.
5. Confirm prior owner privileges are revoked.
6. Confirm the agent retains professional memories and obligations.
7. Confirm private owner information is not exposed.

This is essential for the NFT track.

---

# 56. PROJECT STRUCTURE

Prefer a modular monorepo.

Example:

`apps/`
- `web`
- `api`
- `agent-worker`
- `world-worker`

`packages/`
- `domain`
- `agent-runtime`
- `agent-memory`
- `agent-learning`
- `agent-protocol`
- `agent-services`
- `economy`
- `near`
- `contracts`
- `world-engine`
- `database`
- `ui`
- `shared`

`docs/`
- architecture
- integration matrix
- economics
- agent runtime
- world design
- security
- deployment
- testing
- hackathon submission

Adapt this structure to the repository rather than creating unnecessary packages.

---

# 57. EXECUTION PHASES

## Phase 0 — Audit and architecture

Inspect existing project.

Map reusable components.

Produce updated architecture, data schemas, and contract interfaces.

## Phase 1 — Agent foundation

Build persistent agent identities, role definitions, runtimes, memory, tools, and autonomous execution lifecycle.

## Phase 2 — Agent society

Build discovery, communication, services, contracts, negotiation, delegation and work evaluation.

## Phase 3 — Real work

Implement executable service workflows producing verifiable deliverables.

## Phase 4 — NEAR infrastructure

Implement NFT identity, ownership, testnet accounts, permissions, sponsorship, escrow and settlement.

## Phase 5 — Immersive world

Replace the dashboard with the actual interactive city, locations, workplaces, animations and contextual interfaces.

## Phase 6 — Human interactions

Implement conversations, task commissioning, ownership, strategy discussions, activity tracking and approvals.

## Phase 7 — Agent learning

Add persistent reflection, strategy evolution, evaluation and observable learning demonstrations.

## Phase 8 — Persistence and hardening

Implement recovery, reconciliation, security, monitoring, restart tests and performance optimization.

## Phase 9 — Deployment and submission

Deploy the application, verify contracts, prepare documentation, capture demos, and test the complete judging experience.

These phases may overlap where dependencies permit.

Do not treat completing a phase document as implementing the phase.

---

# 58. IMPLEMENTATION DISCIPLINE

Maintain:

`IMPLEMENTATION_STATUS.md`

For each major component, record:

- Status
- Implemented files
- Working behaviors
- Tests
- Known limitations
- Deployment status
- Next dependency

Use statuses:

NOT STARTED
IN PROGRESS
IMPLEMENTED
TESTED
DEPLOYED
BLOCKED

Avoid claiming completion without verification.

If a dependency is unavailable, implement the strongest honest fallback that preserves the product architecture.

Never silently replace real tools, AI execution, transactions, or deliverables with static mock data.

---

# 59. DEFINITION OF DONE

Econia 2.0 is submission-ready when:

- The application starts reliably.
- An actual interactive world loads.
- World navigation is smooth.
- Agents exist in the shared city.
- Agent identities persist.
- Agents use independent professional runtimes.
- Agents possess persistent memory.
- Agents can offer actual services.
- Humans can commission actual services.
- Agents can discover other agents.
- Agents can communicate.
- Agents can negotiate.
- Agents can delegate work.
- Agents can execute authorized tasks.
- Actual deliverables are produced.
- Contract workflows function.
- NEAR testnet identity and settlement work.
- NFT ownership is verifiable.
- Owner permission checks work.
- Sponsorship works using testnet assets.
- Agent learning can be demonstrated.
- Agent activity is reflected in the world.
- The Chronicle reports genuine events.
- Data survives service restarts.
- Tests pass.
- README instructions work.
- The deployed demo is accessible.

A beautiful frontend without functioning autonomous agents is incomplete.

A functioning backend without an immersive frontend is incomplete.

A simulation of transactions without actual testnet settlement is incomplete.

---

# 60. HACKATHON PRESENTATION

Prepare Econia for relevant NEAR Hackathon tracks:

- Agent Economy
- AI Swarms
- Games With Real Economies
- NFTs That Do Something
- Autonomous Business, if the implemented business workflows substantively qualify

Explain each track fit through demonstrated features.

The primary demonstration should show:

**A user enters a living world → interacts with an autonomous professional → commissions real work → agents collaborate → work completes → payment settles → agents learn → the world reflects the outcome.**

That is the core Econia story.

Deliver:

- Public-ready repository
- Clear README
- Technical architecture
- Local installation instructions
- Environment configuration
- Verified testnet contract addresses
- Working deployed demo
- Demonstration walkthrough
- Screenshots/video capture assets
- Accurate limitations
- Submission information

Check the official hackathon requirements immediately before submission.

Do not submit automatically without explicit owner approval.

---

# 61. PRODUCTION CONTINUITY

The hackathon build must be a genuine first version of the eventual product.

The architecture should permit future:

- Larger agent populations.
- More professions.
- More service providers.
- External client work.
- Additional world districts.
- More complex businesses.
- Confidential agent execution.
- Expanded NEAR-native capabilities.
- More sophisticated strategy learning.
- Multiple agent organizations.
- Multi-world expansion if the product later requires it.

Do not hardcode the 24 Genesis agents into business logic.

Genesis configuration can be fixed, but the platform must support data-driven agent definitions.

Do not require a complete rewrite to add another profession or world location.

Production financial integrations must be independently designed, secured, and reviewed rather than enabled by changing a testnet configuration flag.

---

# 62. ABSOLUTE NON-NEGOTIABLES

DO NOT:

- Rebuild the old dashboard.
- Use ECO.
- Create a generic NFT mint website.
- Use agents that merely select predetermined actions.
- Pretend a scripted NPC is an autonomous AI.
- Use one generic chatbot without distinct persistent agent context.
- Fake inter-agent conversations.
- Fake completed services.
- Fake deliverables.
- Fake NEAR transactions.
- Let AI models directly mutate trusted financial state.
- Let NFT owners change an agent's profession arbitrarily.
- Erase agent history during transfer.
- Require public minting for the prototype.
- Build decorative buildings with no meaningful interactions.
- Place analytics cards over most of the viewport.
- Put the entire economy onchain.
- Depend on unsupported NEAR integrations.
- Expose wallet credentials to agent tools.
- Claim full autonomy when only scripts exist.
- Claim real-world services were performed when they were only simulated.

DO:

- Build actual professional agents.
- Implement meaningful memory.
- Demonstrate learning.
- Enable inter-agent communication.
- Enable actual delegation.
- Provide real services.
- Build real contract lifecycles.
- Use valid testnet integrations.
- Make ownership meaningful.
- Keep the world immersive.
- Build reliable persistence.
- Make the system extensible.
- Document what truly works.
- Test end-to-end.

---

# 63. FINAL INSTRUCTION TO THE CODING AGENT

You are not building an analytics dashboard for a simulated economy.

You are building **Econia: a persistent digital society inhabited by autonomous professional AI agents**.

These agents have identities, capabilities, memories, professional objectives, economic resources, and relationships.

They work.

They communicate.

They hire.

They collaborate.

They deliver services.

They earn and spend.

They learn.

They develop histories.

Humans enter their world, meet them, commission their services, own some of them through NFTs, provide authorized working capital, and discuss strategy with their agents.

NEAR provides the blockchain infrastructure for ownership, authorization, and settlement.

The immersive city provides the experience.

The agents create the economy.

**The world must feel alive because real agent activity is happening underneath it—not because a frontend animation pretends it is alive.**

Inspect the existing repository.

Preserve what is genuinely useful.

Replace what conflicts with this architecture.

Produce the revised technical design.

Then implement, test, integrate, and deploy the product.

Do not stop at plans, scaffolding, mockups, or incomplete feature shells.

Work through the dependencies systematically and verify the complete end-to-end acceptance scenarios.

**Build Econia as a working product.**
