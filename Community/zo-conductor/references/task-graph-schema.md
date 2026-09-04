# Task graph schema

The validator accepts a JSON object with:

```json
{
  "objective": "string",
  "success_criteria": ["string"],
  "nodes": [
    {
      "id": "string",
      "purpose": "string",
      "dependencies": ["node-id"],
      "ownership": "files, service, or responsibility",
      "expected_output": "string",
      "verification": "string",
      "stop_condition": "string",
      "risk": "low | medium | high",
      "agent": "string"
    }
  ]
}
```

Rules:

- `objective` and `success_criteria` must be non-empty.
- Node ids must be unique and dependencies must reference existing nodes.
- The dependency graph must be acyclic.
- Every node must define ownership, verification, and a stop condition.
- `risk` must be `low`, `medium`, or `high`.
- At least one node must be present.
- Integration nodes must not be implied; include one when multiple nodes change work or when acceptance is required.
