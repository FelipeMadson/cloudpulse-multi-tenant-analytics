# Backend operational status

Run npm ci, npm run build and npm start from this directory using Node 22 or newer. The root SDK stays alongside backend, so retain the complete repository.

Health and authenticated in-process resource APIs run locally. Tenant catalogs are restricted to the token tenant. HTTP workflow execution returns 501 WORKFLOW_EXECUTOR_NOT_CONFIGURED until a reviewed real executor exists. It does not build, test or deploy an application. Webhook simulation is explicitly a preview and does not mark real events delivered.

This backend remains a prototype: resource storage/WAL and migration state are in memory, migration callbacks do not create a real database schema, sample data/credentials are seeded, and there is no configured webhook transport or deployment adapter. Production use requires persistent storage and transactional migrations, credential provisioning and authorization review, an allowlisted webhook transport with retry/timeout/receipts, and reviewed build/deployment adapters with immutable packages and real verification evidence. Passing automated checks does not certify those missing capabilities.
