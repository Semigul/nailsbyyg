# Workflow diagram

```mermaid
flowchart TD
    A[Idea / feature request] --> B[Create issue]
    B --> C[Add label: needs-refinement]
    C --> D[Refinement completes]
    D --> E[Add label: ready-for-dev]
    E --> F[Open draft PR]
    F --> G[Implement change]
    G --> H[Add label: ready-for-review]
    H --> I[Review + tests]
    I --> J{Changes needed?}
    J -- Yes --> K[Add label: needs-changes]
    K --> G
    J -- No --> L[Add label: ready-for-staging]
    L --> M[Validate in staging]
    M --> N[Human approval]
    N --> O[Release to production]
```

## Notes

- The flow is intentionally simple and lightweight.
- The draft PR is the main working artifact during implementation.
- Staging is the main pre-production environment.
- Production release is manual and deliberate.
