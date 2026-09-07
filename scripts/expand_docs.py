from pathlib import Path

ROOT = Path('/home/ubuntu/jeston-repo/path/to/docs')

TOPICS = {
    'index': ('Jeston at a glance', 'the framework surface, the runtime contract, and the path from a first route to a production platform', 'rocket'),
    'start/installation': ('Install with confidence', 'supported runtimes, reproducible setup, package boundaries, and the first verification loop', 'download'),
    'start/first-app': ('Build the first complete slice', 'a request moving from route declaration through validation, rendering, and operational feedback', 'wand-magic-sparkles'),
    'start/saas-starter': ('Shape a production SaaS foundation', 'tenancy, identity, billing boundaries, background work, and the minimum operational surface', 'building'),
    'core/architecture': ('Understand the runtime architecture', 'ownership boundaries, request lifecycle, adapters, rendering, and cancellation propagation', 'diagram-project'),
    'core/react-ssr': ('Render React on the server', 'SSR lifecycle, data loading, streaming boundaries, hydration discipline, and failure recovery', 'server'),
    'core/routing': ('Design a route system that scales', 'static routes, dynamic segments, catch-all boundaries, precedence, and route-level contracts', 'route'),
    'core/api-routes': ('Build explicit API contracts', 'method handling, validation, response semantics, cancellation, errors, and idempotency', 'brackets-curly'),
    'core/configuration': ('Configure without hidden behavior', 'environment separation, typed options, secure defaults, and operational overrides', 'sliders'),
    'core/execution-and-streaming': ('Control execution and streaming', 'deadlines, AbortSignal, backpressure, SSE, progressive work, and graceful cancellation', 'stream'),
    'core/react-server-components': ('Evaluate the RSC track responsibly', 'server and client boundaries, serialization, cache ownership, and the current maturity line', 'atom'),
    'platform/sql': ('Build a durable data layer', 'query boundaries, transactions, connection pools, migrations, and failure-aware persistence', 'database'),
    'platform/auth': ('Secure identity and sessions', 'login boundaries, signed sessions, cookies, authorization, rotation, and revocation', 'user-lock'),
    'platform/security': ('Make secure behavior the default', 'trust boundaries, input handling, secrets, browser protections, and incident readiness', 'shield-halved'),
    'platform/cache-jobs-storage': ('Coordinate cache, jobs, and storage', 'freshness, durable work, object lifecycle, bounded resources, and provider portability', 'layer-group'),
    'platform/health-observability': ('Operate what you cannot see', 'health semantics, readiness, metrics, logs, traces, and useful alert signals', 'chart-line'),
    'platform/ai-agents': ('Build dependable AI agent systems', 'model adapters, tool permissions, traces, memory, evaluation, streaming, and training workloads', 'brain'),
    'reference/types': ('Use the type surface deliberately', 'request contexts, handler contracts, result shapes, errors, and provider-neutral composition', 'code'),
    'reference/cli': ('Automate the developer workflow', 'project commands, checks, local operations, release discipline, and CI parity', 'terminal'),
    'reference/http-contracts': ('Treat HTTP as a stable contract', 'status codes, headers, OPTIONS, HEAD, malformed input, caching, and compatibility', 'globe'),
    'reference/adapters': ('Design replaceable adapters', 'capability interfaces, lifecycle ownership, portability, and testing without vendor lock-in', 'puzzle-piece'),
    'reference/compatibility': ('Know the compatibility envelope', 'Node versions, browser assumptions, React behavior, package boundaries, and migration risk', 'scale-balanced'),
    'reference/integrations': ('Extend the ecosystem safely', 'registry metadata, provider catalogs, plugin lifecycle, capability discovery, and governance', 'plug'),
    'operations/deployment': ('Deploy with repeatability', 'build artifacts, environment injection, process topology, probes, and rollback', 'cloud-arrow-up'),
    'operations/production': ('Run Jeston in production', 'capacity, scaling, incidents, security posture, cost controls, and operator runbooks', 'server-stack'),
    'operations/migrations': ('Change systems without surprises', 'schema evolution, compatibility windows, backfills, dual reads, and rollback plans', 'arrows-rotate'),
    'operations/benchmark': ('Benchmark the whole system', 'workload design, percentiles, concurrency, saturation, memory, and honest comparisons', 'gauge-high'),
    'operations/jobs-and-shutdown': ('Finish work gracefully', 'queues, retries, idempotency, signals, draining, and bounded shutdown', 'power-off'),
    'operations/release-checks': ('Ship a release you can trust', 'tests, type checks, packaging, provenance, CI gates, and npm publication readiness', 'circle-check'),
    'operations/ecosystem': ('Grow a professional ecosystem', 'integration quality, documentation, support expectations, compatibility policy, and community scale', 'sitemap'),
}

CATEGORY = {
    'start': ('Start here', 'Move from an empty directory to a verified, maintainable application.'),
    'core': ('Runtime foundations', 'Understand the request path before adding platform complexity.'),
    'platform': ('Platform capabilities', 'Add persistence, identity, caching, observability, and AI with explicit boundaries.'),
    'reference': ('Reference surface', 'Use stable contracts and extension points as the source of implementation truth.'),
    'operations': ('Production operations', 'Turn a working application into a system that can be measured, released, and recovered.'),
    'index': ('Orientation', 'Use this map to choose the right depth for the problem in front of you.'),
}


def category_for(rel: str) -> str:
    return rel.split('/')[0] if '/' in rel else 'index'


def page_links(rel: str) -> str:
    cat = category_for(rel)
    links = {
        'start': [('/start/installation', 'Installation', 'download'), ('/start/first-app', 'First app', 'rocket'), ('/start/saas-starter', 'SaaS starter', 'building')],
        'core': [('/core/architecture', 'Architecture', 'diagram-project'), ('/core/routing', 'Routing', 'route'), ('/core/api-routes', 'API routes', 'brackets-curly')],
        'platform': [('/platform/sql', 'SQL', 'database'), ('/platform/auth', 'Authentication', 'user-lock'), ('/platform/ai-agents', 'AI agents', 'brain')],
        'reference': [('/reference/types', 'Types', 'code'), ('/reference/http-contracts', 'HTTP contracts', 'globe'), ('/reference/adapters', 'Adapters', 'puzzle-piece')],
        'operations': [('/operations/deployment', 'Deployment', 'cloud-arrow-up'), ('/operations/benchmark', 'Benchmarking', 'gauge-high'), ('/operations/release-checks', 'Release checks', 'circle-check')],
        'index': [('/start/installation', 'Start here', 'rocket'), ('/core/architecture', 'Architecture', 'diagram-project'), ('/operations/production', 'Production', 'server-stack')],
    }
    return '\n'.join(f'  <Card title="{name}" icon="{icon}" href="{href}" horizontal>{"Open the guide and continue from here."}</Card>' for href, name, icon in links[cat])


def rich_block(rel: str, focus: str, icon: str) -> str:
    cat = category_for(rel)
    cat_title, cat_desc = CATEGORY[cat]
    if cat == 'core':
        diagram = '''```mermaid placement="top-right"\nflowchart LR\n    request[Request] --> route[Route contract]\n    route --> context[Request context]\n    context --> work[Domain work]\n    work --> response[Response or stream]\n    response --> signal[Logs metrics traces]\n```'''
        lens = 'runtime behavior, lifecycle ownership, cancellation, and HTTP correctness'
    elif cat == 'platform':
        diagram = '''```mermaid placement="top-right"\nflowchart LR\n    app[Application policy] --> adapter[Provider adapter]\n    adapter --> resource[(External resource)]\n    resource --> telemetry[Health and telemetry]\n    telemetry --> recovery[Recovery path]\n```'''
        lens = 'provider boundaries, resource limits, security posture, and operational signals'
    elif cat == 'operations':
        diagram = '''```mermaid placement="top-right"\nflowchart LR\n    change[Change] --> verify[Verify]\n    verify --> release[Release]\n    release --> observe[Observe]\n    observe --> recover[Recover or improve]\n    recover --> change\n```'''
        lens = 'repeatability, measurable behavior, controlled change, and recovery'
    elif cat == 'reference':
        diagram = '''```mermaid placement="top-right"\nflowchart LR\n    input[Input] --> contract[Contract]\n    contract --> implementation[Implementation]\n    implementation --> provider[Provider]\n    provider --> result[Stable result]\n```'''
        lens = 'stable inputs, explicit outputs, compatibility, and replacement seams'
    else:
        diagram = '''```mermaid placement="top-right"\nflowchart LR\n    install[Install] --> build[Build a slice]\n    build --> validate[Validate behavior]\n    validate --> operate[Operate safely]\n    operate --> evolve[Evolve deliberately]\n```'''
        lens = 'orientation, safe defaults, fast feedback, and a clear path to production'

    return f'''\n\n---\n\n## {cat_title}\n\n> **Reading lens** — Use this page to reason about {focus}. The goal is not to memorize APIs. The goal is to make a boundary explicit enough to implement, test, operate, and replace.\n\n<Columns cols={{2}}>\n  <Card title="What you will decide" icon="{icon}" type="check">\n    Choose the ownership boundary, the smallest useful implementation, and the signal that proves it works.\n  </Card>\n\n  <Card title="Why it matters" icon="circle-question" type="note">\n    {cat_desc} Keep policy in the application and keep provider mechanics behind adapters.\n  </Card>\n</Columns>\n\n### The shape of the system\n\n{diagram}\n\n<Info>\n**Professional documentation is a decision aid.** Every example on this page should answer four questions: what enters the boundary, what leaves it, what can fail, and how an operator knows.\n</Info>\n\n---\n\n## Implementation path\n\n<Steps titleSize="h3">\n  <Step title="Name the boundary" icon="crosshairs">\n    Define the input, output, owner, authentication requirement, deadline, and side effects before writing the integration.\n  </Step>\n  <Step title="Build one vertical slice" icon="layers-3">\n    Connect the route or command to real domain behavior, one stable response, and one structured signal. Keep the first slice intentionally small.\n  </Step>\n  <Step title="Add the uncomfortable paths" icon="triangle-exclamation">\n    Specify malformed input, missing identity, timeout, dependency outage, duplicate delivery, client disconnect, and process shutdown.\n  </Step>\n  <Step title="Prove and operate it" icon="flask-conical">\n    Add contract tests, latency measurements, limits, a dashboard signal, and a short recovery procedure.\n  </Step>\n</Steps>\n\n## Choose your working mode\n\n<Tabs>\n  <Tab title="Learn" icon="book-open">\n    Start with the smallest example and read the adjacent reference page when a symbol or contract becomes important. Keep the feedback loop short.\n  </Tab>\n  <Tab title="Build" icon="hammer">\n    Implement a vertical slice. Prefer explicit contracts, bounded resources, and provider-neutral domain functions over clever abstractions.\n  </Tab>\n  <Tab title="Operate" icon="chart-line">\n    Measure the complete path. Add request IDs, health semantics, useful percentiles, and a recovery path before optimizing.\n  </Tab>\n</Tabs>\n\n---\n\n## Practical reference\n\n| Concern | Default posture | Review question |\n| --- | --- | --- |\n| Boundary | Explicit and narrow | Can a new contributor name the owner? |\n| Input | Validated at the edge | What happens before side effects begin? |\n| Time | Deadline plus dependency budgets | Can work stop when the client leaves? |\n| Failure | Stable public shape | Can the operator find the cause without secrets? |\n| Change | Tested and reversible | Is there a rollback or compatibility window? |\n\n### A small, observable contract\n\n```ts title="A Jeston handler with a clear boundary"\nimport type {{ ApiHandler }} from '@hedronjs/jeston';\n\nexport const POST: ApiHandler = async ({{ body, signal, requestId, deadline }}) => {{\n  const input = validateInput(body);\n  const result = await domainOperation(input, {{ signal, requestId, deadline }});\n\n  return {{\n    status: 201,\n    json: {{ data: result, requestId }},\n  }};\n}};\n```\n\n> **Jeston design principle**\n>\n> A framework contract is useful only when its success path and failure path are both documented.\n\n<Note>\nThe code is intentionally provider-neutral. Replace `domainOperation` with an application-owned function or a tested adapter. Do not hide retries, credentials, unbounded work, or provider-specific errors inside the route.\n</Note>\n\n---\n\n## Review notes\n\n<AccordionGroup>\n  <Accordion title="What should be visible to a reviewer?" icon="eye">\n    The boundary, the input schema, the response shape, the deadline, the cancellation path, the side effects, and the test that proves the failure mode. If any of these are implicit, the design is harder to maintain than it needs to be.\n  </Accordion>\n  <Accordion title="What should be visible to an operator?" icon="binoculars">\n    Request or job identifiers, latency percentiles, dependency labels, health state, error category, and the next recovery action. Avoid dashboards that show volume without showing saturation or failure.\n  </Accordion>\n  <Accordion title="What belongs in the next page?" icon="arrow-right">\n    Follow the links below for the neighboring layer. Keep this page focused on its own boundary and use the reference pages for exact API details.\n  </Accordion>\n</AccordionGroup>\n\n## Continue with the right tool\n\n<Columns cols={{3}}>\n{page_links(rel)}\n</Columns>\n\n<Check>\nYou are ready to continue when the page has produced one implementation decision, one executable example, one failure test, and one operational signal.\n</Check>\n'''

for path in sorted(ROOT.rglob('*.mdx')):
    rel = path.relative_to(ROOT).with_suffix('').as_posix()
    if rel == 'untitled-page' or rel not in TOPICS:
        continue
    text = path.read_text()
    marker = '\n## References\n'
    references = ''
    if marker in text:
        text, references = text.split(marker, 1)
        references = marker + references
    generated_marker = '\n---\n\n## '
    if generated_marker in text:
        text = text.split(generated_marker, 1)[0].rstrip()
    # Keep the original explanation available, but make the new page lead with
    # a concise visual orientation instead of a long uninterrupted preamble.
    if '\n## ' in text:
        hero, legacy = text.split('\n## ', 1)
        legacy = '## ' + legacy
        text = hero.rstrip() + '\n\n<Accordion title="Background and detailed explanation" icon="book-open">\n\n' + legacy.strip() + '\n\n</Accordion>\n'
    title, focus, icon = TOPICS[rel]
    text = text.rstrip() + rich_block(rel, focus, icon) + '\n' + references.lstrip('\n')
    # Add a page-level icon while preserving the existing title and subtitle.
    if '\nicon:' not in text.split('---', 2)[1]:
        frontmatter_end = text.find('---', 4)
        text = text[:frontmatter_end] + f'icon: {icon}\n' + text[frontmatter_end:]
    path.write_text(text)

print(f'Rebuilt {sum(1 for p in ROOT.rglob("*.mdx") if p.relative_to(ROOT).with_suffix("").as_posix() in TOPICS)} pages')
