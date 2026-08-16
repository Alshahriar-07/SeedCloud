# Seed Cloud — Development Rules

## Rule 1 — No fake integrations

Do not claim a provider is connected unless the integration actually works.

## Rule 2 — Research before implementation

Before writing a provider adapter, verify its official developer/API documentation and current Terms.

## Rule 3 — Provider isolation

Provider-specific code must stay inside its adapter.

## Rule 4 — Backend secrets only

Provider secrets and privileged credentials never go into frontend JavaScript.

## Rule 5 — Unified abstraction

Frontend code should not need to know provider-specific API details.

## Rule 6 — Capability aware

If a provider does not support an operation, the UI should disable or explain that operation rather than pretending it works.

## Rule 7 — User ownership

Never allow one authenticated user to access another user's file metadata or provider connection.

## Rule 8 — Recoverable failures

A failed upload must not leave misleading metadata that says the file was successfully stored.

## Rule 9 — Observable routing

The router should record enough information to debug why a provider was selected or rejected.

## Rule 10 — Simple UI

Do not sacrifice usability for visual effects.

## Rule 11 — No provider abuse

Do not automate account creation or actions in a way that violates provider policies or anti-abuse systems.

## Rule 12 — Build incrementally

First make one provider work end-to-end. Then create the reusable adapter pattern and expand provider coverage.
